package linker

// Beyond ESBuild: declarations of reassigned exports. See "cjs_assign_exports.go"
// for the contract. A binding that became a property of the free "exports"
// object no longer has a local declaration, so its statement is rewritten.

import (
	"github.com/evanw/esbuild/internal/ast"
	"github.com/evanw/esbuild/internal/js_ast"
	"github.com/evanw/esbuild/internal/logger"
)

func (c *linkerContext) bindingHasAssignedExport(binding js_ast.Binding) (some bool, all bool) {
	all = true
	var visit func(js_ast.Binding)
	visit = func(binding js_ast.Binding) {
		switch b := binding.Data.(type) {
		case *js_ast.BIdentifier:
			if c.isAssignedExportProperty(b.Ref) {
				some = true
			} else {
				all = false
			}
		case *js_ast.BArray:
			for _, item := range b.Items {
				visit(item.Binding)
			}
		case *js_ast.BObject:
			for _, property := range b.Properties {
				visit(property.Value)
			}
		}
	}
	visit(binding)
	return
}

// "let count = 0" => "exports.count = 0" for bindings that became properties
func (c *linkerContext) convertLocalForAssignedExports(stmt js_ast.Stmt, s *js_ast.SLocal) ([]js_ast.Stmt, bool) {
	converts := false
	for _, decl := range s.Decls {
		if some, _ := c.bindingHasAssignedExport(decl.Binding); some {
			converts = true
			break
		}
	}
	if !converts {
		return nil, false
	}

	var stmts []js_ast.Stmt
	for _, decl := range s.Decls {
		some, all := c.bindingHasAssignedExport(decl.Binding)
		if !some {
			stmts = append(stmts, js_ast.Stmt{Loc: stmt.Loc, Data: &js_ast.SLocal{Kind: s.Kind, Decls: []js_ast.Decl{decl}}})
			continue
		}

		// A pattern can mix exported properties with ordinary bindings. Declare
		// the ordinary ones first because the pattern becomes an assignment.
		if !all {
			kind := js_ast.LocalLet
			if s.Kind == js_ast.LocalVar {
				kind = js_ast.LocalVar
			}
			var decls []js_ast.Decl
			js_ast.ForEachIdentifierBinding(decl.Binding, func(loc logger.Loc, b *js_ast.BIdentifier) {
				if !c.isAssignedExportProperty(b.Ref) {
					decls = append(decls, js_ast.Decl{Binding: js_ast.Binding{Loc: loc, Data: b}})
				}
			})
			stmts = append(stmts, js_ast.Stmt{Loc: stmt.Loc, Data: &js_ast.SLocal{Kind: kind, Decls: decls}})
		}

		value := decl.ValueOrNil
		if value.Data == nil {
			// "var" without an initializer does not reset an earlier assignment
			if s.Kind == js_ast.LocalVar {
				continue
			}
			value = js_ast.Expr{Loc: decl.Binding.Loc, Data: js_ast.EUndefinedShared}
		}
		target := js_ast.ConvertBindingToExpr(decl.Binding, func(loc logger.Loc, ref ast.Ref) js_ast.Expr {
			return js_ast.Expr{Loc: loc, Data: &js_ast.EIdentifier{Ref: ref}}
		})
		stmts = append(stmts, js_ast.Stmt{Loc: stmt.Loc, Data: &js_ast.SExpr{Value: js_ast.Assign(target, value)}})
	}
	return stmts, true
}
