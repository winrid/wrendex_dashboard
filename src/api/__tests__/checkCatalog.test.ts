// Integrity test for the static check catalog. The catalog must contain
// exactly one entry per AlertType union literal; if the backend ships a new
// AlertType, this test fails until the catalog is extended. Mirrors
// AGENTS.md "Repo layout" - the catalog is the single source of truth for
// description / how-to-fix / category.
//
// AlertType lives in src/api/generated/wrendex-models.ts now; the typescript-
// generator-maven-plugin emits it on every BE codegen run, and types.ts re-
// exports it from there. We scrape the generated file (single-line union)
// rather than the re-export so the literal extraction stays trivial.

import { describe, expect, it } from "vitest"
// eslint-disable-next-line import/no-unresolved
import generatedSource from "../generated/wrendex-models.ts?raw"
import {
  getAllCategories,
  getAllChecks,
  getCheck,
  getChecksInCategory,
} from "../checkCatalog"

function extractAlertTypeLiterals(): string[] {
  // The generator emits AlertType as a single-line `export type AlertType =
  // "A" | "B" | ...;` definition. Grab everything between the `=` and the
  // closing semicolon, then pull out the quoted literals.
  const start = generatedSource.indexOf("export type AlertType")
  if (start < 0) {
    throw new Error("AlertType export not found in generated/wrendex-models.ts")
  }
  const eq = generatedSource.indexOf("=", start)
  const semi = generatedSource.indexOf(";", eq)
  if (eq < 0 || semi < 0) {
    throw new Error("Could not locate AlertType union body in generated file")
  }
  const region = generatedSource.slice(eq, semi)
  const literals: string[] = []
  const re = /"([A-Z0-9_]+)"/g
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
