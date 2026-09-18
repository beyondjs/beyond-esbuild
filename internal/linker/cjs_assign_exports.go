package linker

// Beyond ESBuild: assigned CommonJS exports.
//
// By default esbuild converts the exports of an ESM entry point to CommonJS by
// defining getters on a new object and replacing "module.exports" with it:
//
//   __export(entry_exports, { count: () => count });
//   module.exports = __toCommonJS(entry_exports);
//
// Beyond evaluates each internal module as "creator(require, exports)". There
// is no "module" object, the runtime owns the "exports" object, it observes
// every export through property assignment, and it deletes and refills the
// exports when a creator is replaced. Getters on a replacement object satisfy
// none of those requirements. When "CJSAssignExports" is enabled the exports
// are instead written on the free "exports" object:
//
//   Object.defineProperty(exports, "__esModule", { value: true });
//   exports.increment = increment;   // Hoisted functions are assigned first
//   exports.count = 0;               // Was "export let count = 0"
//   function increment() { exports.count++; }
//   exports.fixed = fixed;           // Everything else is assigned last
//
// An exported binding that may be reassigned becomes a property of "exports"
// so every mutation is an observable assignment. Re-exported imports use the
// accessor form that TypeScript emits, and "export *" uses "__exportStar", so
// static CommonJS analyzers report the same names for both compilers.

import (
	"sort"

	"github.com/evanw/esbuild/internal/ast"
	"github.com/evanw/esbuild/internal/config"
	"github.com/evanw/esbuild/internal/graph"
	"github.com/evanw/esbuild/internal/helpers"
	"github.com/evanw/esbuild/internal/js_ast"
)

// Assigned exports apply to unwrapped ESM entry points in the CommonJS format
func (c *linkerContext) assignsCJSExports(sourceIndex uint32) bool {
	if !c.options.CJSAssignExports || c.options.OutputFormat != config.FormatCommonJS {
		return false
	}
	file := &c.graph.Files[sourceIndex]
	repr, ok := file.InputFile.Repr.(*graph.JSRepr)
	return ok && file.IsEntryPoint() && repr.Meta.ForceIncludeExportsForEntryPoint && repr.Meta.Wrap == graph.WrapNone
}

// This must run serially before exports are created in parallel because it
// changes how every reference to the aliased symbols is printed.
func (c *linkerContext) aliasMutableCJSExports() {
	if !c.options.CJSAssignExports {
		return
	}
	for _, entryPoint := range c.graph.EntryPoints() {
		sourceIndex := entryPoint.SourceIndex
		if !c.assignsCJSExports(sourceIndex) {
			continue
		}
		repr := c.graph.Files[sourceIndex].InputFile.Repr.(*graph.JSRepr)
		aliases := make([]string, 0, len(repr.Meta.ResolvedExports))
		for alias := range repr.Meta.ResolvedExports {
			aliases = append(aliases, alias)
		}
		sort.Strings(aliases)

		// Prefer the alias that matches the local name of the binding
		sort.SliceStable(aliases, func(i int, j int) bool {
			isLocalName := func(alias string) bool {
				export := repr.Meta.ResolvedExports[alias]
				return c.graph.Symbols.Get(ast.FollowSymbols(c.graph.Symbols, export.Ref)).OriginalName == alias
			}
			return isLocalName(aliases[i]) && !isLocalName(aliases[j])
		})

		for _, alias := range aliases {
			export := repr.Meta.ResolvedExports[alias]
			if export.SourceIndex != sourceIndex {
				continue
			}
			if _, ok := repr.Meta.ImportsToBind[export.Ref]; ok {
				continue
			}
			symbol := c.graph.Symbols.Get(ast.FollowSymbols(c.graph.Symbols, export.Ref))
			if symbol.NamespaceAlias != nil || !symbol.Flags.Has(ast.CouldPotentiallyBeMutated) {
				continue
			}

			// Function and class declarations keep their local binding. Only
			// "var" and "let" declarations are turned into properties.
			if symbol.Kind != ast.SymbolHoisted && symbol.Kind != ast.SymbolOther {
				continue
			}
			symbol.NamespaceAlias = &ast.NamespaceAlias{NamespaceRef: c.unboundExportsRef, Alias: alias}
		}
	}
}

func (c *linkerContext) isAssignedExportProperty(ref ast.Ref) bool {
	alias := c.graph.Symbols.Get(ast.FollowSymbols(c.graph.Symbols, ref)).NamespaceAlias
	return alias != nil && alias.NamespaceRef == c.unboundExportsRef
}

// The declaration of this symbol was rewritten to assign "exports[alias]"
func (c *linkerContext) isDeclaredAsExportProperty(symbol *ast.Symbol, alias string) bool {
	return symbol.NamespaceAlias != nil && symbol.NamespaceAlias.NamespaceRef == c.unboundExportsRef &&
		symbol.NamespaceAlias.Alias == alias
}

func (c *linkerContext) assignedExportTarget(alias string) js_ast.Expr {
	exports := js_ast.Expr{Data: &js_ast.EIdentifier{Ref: c.unboundExportsRef}}
	if js_ast.IsIdentifier(alias) {
		return js_ast.Expr{Data: &js_ast.EDot{Target: exports, Name: alias}}
	}
	return js_ast.Expr{Data: &js_ast.EIndex{
		Target: exports,
		Index:  js_ast.Expr{Data: &js_ast.EString{Value: helpers.StringToUTF16(alias)}},
	}}
}

// "Object.defineProperty(exports, name, { ... })"
func (c *linkerContext) defineAssignedExport(name string, properties []js_ast.Property) js_ast.Stmt {
	return js_ast.Stmt{Data: &js_ast.SExpr{Value: js_ast.Expr{Data: &js_ast.ECall{
		Kind: js_ast.TargetWasOriginallyPropertyAccess,
		Target: js_ast.Expr{Data: &js_ast.EDot{
			Target: js_ast.Expr{Data: &js_ast.EIdentifier{Ref: c.unboundObjectRef}},
			Name:   "defineProperty",
		}},
		Args: []js_ast.Expr{
			{Data: &js_ast.EIdentifier{Ref: c.unboundExportsRef}},
			{Data: &js_ast.EString{Value: helpers.StringToUTF16(name)}},
			{Data: &js_ast.EObject{Properties: properties, IsSingleLine: true}},
		},
	}}}}
}

func (c *linkerContext) assignedExportProperty(key string, value js_ast.Expr) js_ast.Property {
	return js_ast.Property{
		Key:        js_ast.Expr{Data: &js_ast.EString{Value: helpers.StringToUTF16(key)}},
		ValueOrNil: value,
	}
}

// This returns the export statements for either the start of the file, where
// only hoisted function declarations can be referenced safely, or for the end
// of the file where every other binding has been initialized.
func (c *linkerContext) assignedCJSExportStmts(sourceIndex uint32, atStart bool) (stmts []js_ast.Stmt) {
	repr := c.graph.Files[sourceIndex].InputFile.Repr.(*graph.JSRepr)

	if atStart {
		stmts = append(stmts, c.defineAssignedExport("__esModule", []js_ast.Property{
			c.assignedExportProperty("value", js_ast.Expr{Data: &js_ast.EBoolean{Value: true}}),
		}))
	}

	for _, alias := range repr.Meta.SortedAndFilteredExportAliases {
		export := repr.Meta.ResolvedExports[alias]
		if importData, ok := c.graph.Files[export.SourceIndex].InputFile.Repr.(*graph.JSRepr).Meta.ImportsToBind[export.Ref]; ok {
			export.Ref = importData.Ref
			export.SourceIndex = importData.SourceIndex
		}
		ref := ast.FollowSymbols(c.graph.Symbols, export.Ref)
		symbol := c.graph.Symbols.Get(ref)

		// "exports.name = void 0;" because a "var" binding exists from the start
		if atStart && symbol.Kind == ast.SymbolHoisted && c.isDeclaredAsExportProperty(symbol, alias) {
			stmts = append(stmts, js_ast.AssignStmt(c.assignedExportTarget(alias), js_ast.Expr{Data: js_ast.EUndefinedShared}))
			continue
		}

		isHoistedFunction := symbol.NamespaceAlias == nil && export.SourceIndex == sourceIndex &&
			(symbol.Kind == ast.SymbolHoistedFunction || symbol.Kind == ast.SymbolGeneratorOrAsyncFunction)
		if isHoistedFunction != atStart {
			continue
		}

		// A reassigned binding that could not become a property, such as one from
		// another bundled file or a function declaration, stays live through the
		// accessor below. Everything else is a plain assignment.
		if symbol.NamespaceAlias == nil && !symbol.Flags.Has(ast.CouldPotentiallyBeMutated) {
			// "exports.name = name;"
			stmts = append(stmts, js_ast.AssignStmt(c.assignedExportTarget(alias),
				js_ast.Expr{Data: &js_ast.EIdentifier{Ref: export.Ref}}))
			continue
		}

		// The declaration of this binding already assigns this property
		if c.isDeclaredAsExportProperty(symbol, alias) {
			continue
		}

		// "Object.defineProperty(exports, name, { enumerable: true, get: function () { return ns.name; } });"
		var value js_ast.Expr
		if symbol.NamespaceAlias == nil || symbol.NamespaceAlias.NamespaceRef == c.unboundExportsRef {
			value = js_ast.Expr{Data: &js_ast.EIdentifier{Ref: export.Ref}}
		} else {
			value = js_ast.Expr{Data: &js_ast.EImportIdentifier{Ref: export.Ref}}
		}
		getter := js_ast.Expr{Data: &js_ast.EFunction{Fn: js_ast.Fn{Body: js_ast.FnBody{Block: js_ast.SBlock{
			Stmts: []js_ast.Stmt{{Data: &js_ast.SReturn{ValueOrNil: value}}},
		}}}}}
		stmts = append(stmts, c.defineAssignedExport(alias, []js_ast.Property{
			c.assignedExportProperty("enumerable", js_ast.Expr{Data: &js_ast.EBoolean{Value: true}}),
			c.assignedExportProperty("get", getter),
		}))
	}
	return
}

// This replaces the "__export" and "__toCommonJS" part of the default output.
// The dependencies keep the declarations of all exports alive during tree
// shaking, exactly as the getters of the default output do.
func (c *linkerContext) createAssignedExportsForFile(sourceIndex uint32) {
	repr := c.graph.Files[sourceIndex].InputFile.Repr.(*graph.JSRepr)
	dependencies := []js_ast.Dependency{}
	symbolUses := make(map[ast.Ref]js_ast.SymbolUse)

	for _, alias := range repr.Meta.SortedAndFilteredExportAliases {
		export := repr.Meta.ResolvedExports[alias]
		if importData, ok := c.graph.Files[export.SourceIndex].InputFile.Repr.(*graph.JSRepr).Meta.ImportsToBind[export.Ref]; ok {
			export.Ref = importData.Ref
			export.SourceIndex = importData.SourceIndex
			dependencies = append(dependencies, importData.ReExports...)
		}
		symbolUses[export.Ref] = js_ast.SymbolUse{CountEstimate: 1}
		for _, partIndex := range c.graph.Files[export.SourceIndex].InputFile.Repr.(*graph.JSRepr).TopLevelSymbolToParts(export.Ref) {
			dependencies = append(dependencies, js_ast.Dependency{SourceIndex: export.SourceIndex, PartIndex: partIndex})
		}
	}

	// A file that imports its own namespace still refers to its internal exports
	// object. "var entry_exports = exports" keeps that reference valid.
	var stmts []js_ast.Stmt
	var declaredSymbols []js_ast.DeclaredSymbol
	if c.graph.Symbols.Get(repr.AST.ExportsRef).UseCountEstimate > 0 {
		stmts = append(stmts, js_ast.Stmt{Data: &js_ast.SLocal{Decls: []js_ast.Decl{{
			Binding:    js_ast.Binding{Data: &js_ast.BIdentifier{Ref: repr.AST.ExportsRef}},
			ValueOrNil: js_ast.Expr{Data: &js_ast.EIdentifier{Ref: c.unboundExportsRef}},
		}}}})
		declaredSymbols = append(declaredSymbols, js_ast.DeclaredSymbol{Ref: repr.AST.ExportsRef, IsTopLevel: true})
	}

	repr.AST.Parts[js_ast.NSExportPartIndex] = js_ast.Part{
		Stmts:                append(stmts, c.assignedCJSExportStmts(sourceIndex, true)...),
		SymbolUses:           symbolUses,
		Dependencies:         dependencies,
		DeclaredSymbols:      declaredSymbols,
		CanBeRemovedIfUnused: true,
		ForceTreeShaking:     true,
	}
}
