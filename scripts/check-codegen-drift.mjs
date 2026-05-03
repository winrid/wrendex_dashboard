#!/usr/bin/env node
// Drift gate for the typescript-generator output. Snapshots the checked-in
// generated/wrendex-models.ts, re-runs the BE codegen via scripts/codegen.mjs,
// and diffs the new content against the snapshot. Exits 1 (with a diff
// preview) if the file changed; otherwise exits 0.
//
// CI / pre-commit can invoke this as `pnpm codegen:check`. Local dev runs
// `pnpm codegen` to regenerate and commit the file.
//
// Implementation notes:
//   - We use createHash + raw bytewise compare; the generated file has a
//     "Generated using ... on <timestamp>" header that DOES change between
//     runs (the date stamp), so we strip the leading comment block before
//     hashing. Everything below the first blank line is the actual content.
//   - We write the snapshot to a temp file and clean it up regardless.

import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dashboardRoot = resolve(__dirname, "..")
const generatedFile = resolve(
  dashboardRoot,
  "src",
  "api",
  "generated",
  "wrendex-models.ts",
)
const codegenScript = resolve(__dirname, "codegen.mjs")

if (!existsSync(generatedFile)) {
  console.error(
    `[codegen:check] no checked-in file at ${generatedFile}; run \`pnpm codegen\` first`,
  )
  process.exit(2)
}

const tmp = mkdtempSync(`${tmpdir()}/wrendex-codegen-drift-`)
const snapshot = resolve(tmp, "wrendex-models.before.ts")
copyFileSync(generatedFile, snapshot)

let driftDetected = false
let exitCode = 0

try {
  const result = spawnSync(process.execPath, [codegenScript], {
    cwd: dashboardRoot,
    stdio: "inherit",
  })
  if (result.error) {
    console.error(`[codegen:check] failed to run codegen: ${result.error.message}`)
    process.exit(2)
  }
  if (result.status !== 0) {
    console.error(
      `[codegen:check] codegen exited with status ${result.status}; aborting drift check`,
    )
    process.exit(result.status ?? 1)
  }

  const before = stripHeader(readFileSync(snapshot, "utf8"))
  const after = stripHeader(readFileSync(generatedFile, "utf8"))

  if (before !== after) {
    driftDetected = true
    console.error("")
    console.error(
      "[codegen:check] DRIFT DETECTED: src/api/generated/wrendex-models.ts " +
        "would change after `pnpm codegen`.",
    )
    console.error("")
    console.error("Top of the diff (first 40 lines of unified diff):")
    console.error("")
    printShortDiff(before, after, 40)
    console.error("")
    console.error(
      "Run `pnpm codegen` from the dashboard root, review the change, and " +
        "commit src/api/generated/wrendex-models.ts.",
    )
    exitCode = 1
  } else {
    console.log("[codegen:check] OK: generated file is up to date")
  }
} finally {
  // Restore the snapshot if drift was detected so the working tree is
  // unchanged after the check (the user's `pnpm codegen` flow is the
  // explicit way to commit a regenerated file).
  if (driftDetected) {
    copyFileSync(snapshot, generatedFile)
  }
  rmSync(tmp, { recursive: true, force: true })
}

process.exit(exitCode)

/**
 * Strips the leading auto-generated header comments (the typescript-generator
 * stamps the current timestamp into the first line, which would otherwise
 * always trigger drift). Anything before the first blank line is dropped.
 */
function stripHeader(src) {
  const blank = src.indexOf("\n\n")
  return blank < 0 ? src : src.slice(blank + 2)
}

/**
 * Prints a tiny line-diff summary. Not a full unified diff; enough for the
 * user to grok what changed without dragging in a diff dependency.
 */
function printShortDiff(beforeText, afterText, limit) {
  const a = beforeText.split("\n")
  const b = afterText.split("\n")
  const max = Math.max(a.length, b.length)
  let printed = 0
  for (let i = 0; i < max && printed < limit; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) {
        console.error(`- ${a[i]}`)
        printed++
      }
      if (b[i] !== undefined && printed < limit) {
        console.error(`+ ${b[i]}`)
        printed++
      }
    }
  }
}
