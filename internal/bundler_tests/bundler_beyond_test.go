package bundler_tests

// Beyond ESBuild: regression coverage for fork-specific compiler behavior.
// Upstream suites and their snapshots are not modified by these tests.

import (
	"testing"

	"github.com/evanw/esbuild/internal/config"
)

var beyond_suite = suite{
	name: "beyond",
}

// Each Beyond internal module is transformed alone into "creator(require, exports)"
func TestBeyondCJSAssignExportsConvertFormat(t *testing.T) {
	beyond_suite.expectBundled(t, bundled{
		files: map[string]string{
			"/entry.ts": `
				import Thing, { other } from './thing'
				import * as ns from './ns'
				export * from './star'
				export { other, ns }
				export { renamed as alias } from './thing'
				export let count = 0
				export var legacy
				export let { a, b: [c] } = { a: 1, b: [2] }
				let hidden = 5, shown = 6
				export { shown, shown as second }
				export const fixed = 1
				export function increment() { count++; shown += hidden; a = c; return { count, fixed } }
				export async function later() { legacy = () => 1; return legacy() }
				export class Box {}
				export default class extends Thing {}
				export enum Color { Red }
			`,
		},
		entryPaths: []string{"/entry.ts"},
		options: config.Options{
			Mode:             config.ModeConvertFormat,
			OutputFormat:     config.FormatCommonJS,
			AbsOutputFile:    "/out.js",
			CJSAssignExports: true,
		},
	})
}

// Exports that are never reassigned stay local and are assigned once
func TestBeyondCJSAssignExportsBundle(t *testing.T) {
	beyond_suite.expectBundled(t, bundled{
		files: map[string]string{
			"/entry.js": `
				import { helper } from './internal'
				export * from './values'
				export { external } from 'public/module'
				export let total = 0
				export function run() { total += helper(); return total }
			`,
			"/internal.js": `
				export function helper() { return 1 }
			`,
			"/values.js": `
				export let shared = 1
				export function bump() { shared++ }
			`,
		},
		entryPaths: []string{"/entry.js"},
		options: config.Options{
			Mode:             config.ModeBundle,
			OutputFormat:     config.FormatCommonJS,
			AbsOutputFile:    "/out.js",
			CJSAssignExports: true,
			ExternalSettings: config.ExternalSettings{
				PreResolve: config.ExternalMatchers{Exact: map[string]bool{
					"public/module": true,
				}},
			},
		},
	})
}

// The option only changes ESM entry points in the CommonJS output format
func TestBeyondCJSAssignExportsLeavesCommonJSSource(t *testing.T) {
	beyond_suite.expectBundled(t, bundled{
		files: map[string]string{
			"/entry.js": `
				exports.value = require('./other').value
			`,
			"/other.js": `
				export let value = 1
				value++
			`,
		},
		entryPaths: []string{"/entry.js"},
		options: config.Options{
			Mode:             config.ModeBundle,
			OutputFormat:     config.FormatCommonJS,
			AbsOutputFile:    "/out.js",
			CJSAssignExports: true,
		},
	})
}
