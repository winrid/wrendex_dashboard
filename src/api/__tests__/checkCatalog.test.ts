// Integrity test for the static check catalog. The catalog must contain
// exactly one entry per AlertType union literal in src/api/types.ts; if the
// backend ships a new AlertType, this test fails until the catalog is
// extended. Mirrors AGENTS.md "Repo layout" - the catalog is the single
// source of truth for description / how-to-fix / category.
//
// We extract the literal list out of types.ts at build time using Vite's
// `?raw` query (Vitest supports the same query). Going through ?raw avoids
// having to depend on @types/node in the app tsconfig just for one test.

import { describe, expect, it } from "vitest"
// eslint-disable-next-line import/no-unresolved
import typesSource from "../types.ts?raw"
import {
  getAllCategories,
  getAllChecks,
  getCheck,
  getChecksInCategory,
} from "../checkCatalog"

function extractAlertTypeLiterals(): string[] {
  const start = typesSource.indexOf("export type AlertType")
  if (start < 0) throw new Error("AlertType export not found in types.ts")
  const after = typesSource.slice(start)
  // Stop once we hit a blank line; the union ends there.
  const stopIdx = after.search(/\n\n/)
  const region = stopIdx > 0 ? after.slice(0, stopIdx) : after
  const literals: string[] = []
  const re = /^\s*\|\s*"([A-Z0-9_]+)"$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(region)) !== null) {
    literals.push(match[1]!)
  }
  return literals
}

describe("checkCatalog integrity", () => {
  it("has an entry for every AlertType union literal", () => {
    const literals = extractAlertTypeLiterals()
    expect(literals.length).toBeGreaterThan(0)
    const missing: string[] = []
    for (const lit of literals) {
      if (!getCheck(lit)) missing.push(lit)
    }
    expect(missing).toEqual([])
  })

  it("has no duplicate entries", () => {
    const types = getAllChecks().map((e) => e.type)
    const set = new Set(types)
    expect(set.size).toBe(types.length)
  })

  it("entries point at known categories", () => {
    const cats = new Set(getAllCategories())
    for (const entry of getAllChecks()) {
      expect(cats.has(entry.category)).toBe(true)
    }
  })

  it("getChecksInCategory returns only matching entries", () => {
    for (const cat of getAllCategories()) {
      const inCat = getChecksInCategory(cat)
      expect(inCat.length).toBeGreaterThan(0)
      for (const entry of inCat) expect(entry.category).toBe(cat)
    }
  })

  it("entry counts match the AlertType union size", () => {
    const literals = extractAlertTypeLiterals()
    expect(getAllChecks().length).toBe(literals.length)
  })
})
