#!/usr/bin/env node
// Regenerates dashboard/src/api/generated/wrendex-models.ts from the Java
// model classes under com.bigbug.model.*. Drives the
// cz.habarta.typescript-generator-maven-plugin in the backend repo (see
// backend/pom.xml). Invoke via `pnpm codegen` from the dashboard root.
//
// We deliberately use Node + spawnSync rather than a shell script: the
// global rule "no bash scripts; Python or Node only" applies. We pin
// JAVA_HOME (the project requires JDK 25 and the user has SDKMAN-managed
// JDK at the path below); override with the WRENDEX_JAVA_HOME env var when
// running on a host that puts JDK 25 elsewhere.

import { spawnSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dashboardRoot = resolve(__dirname, "..")
const backendRoot = resolve(dashboardRoot, "..", "backend")
const generatedFile = resolve(
  dashboardRoot,
  "src",
  "api",
  "generated",
  "wrendex-models.ts",
)

// The project requires JDK 25; the user's shell-level JAVA_HOME may point at
// a different JDK (the SDKMAN `current` symlink rotates with `sdk use`). We
// hard-pin to the SDKMAN-managed JDK 25 unless the caller explicitly
// overrides via WRENDEX_JAVA_HOME. Falling back to JAVA_HOME would silently
// produce class-version mismatches on machines where `current` is not 25.
const defaultJavaHome = "/home/winrid/.sdkman/candidates/java/25.0.2-open"
const javaHome = process.env.WRENDEX_JAVA_HOME || defaultJavaHome

if (!existsSync(javaHome)) {
  console.error(
    `[codegen] JAVA_HOME path does not exist: ${javaHome}. ` +
      "Set WRENDEX_JAVA_HOME or JAVA_HOME to a JDK 25 install.",
  )
  process.exit(2)
}

if (!existsSync(backendRoot)) {
  console.error(
    `[codegen] backend repo not found at ${backendRoot}. The dashboard ` +
      "expects the backend checkout to live alongside it (../backend).",
  )
  process.exit(2)
}

const pathPrefix = `${javaHome}/bin`
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${pathPrefix}:${process.env.PATH || ""}`,
}

console.log(
  `[codegen] running mvn typescript-generator:generate in ${backendRoot}`,
)
console.log(`[codegen] JAVA_HOME=${javaHome}`)

const result = spawnSync(
  "mvn",
  ["-q", "typescript-generator:generate"],
  {
    cwd: backendRoot,
    env,
    stdio: "inherit",
  },
)

if (result.error) {
  console.error(`[codegen] failed to spawn mvn: ${result.error.message}`)
  process.exit(2)
}
if (result.status !== 0) {
  console.error(`[codegen] mvn exited with status ${result.status}`)
  process.exit(result.status ?? 1)
}

if (!existsSync(generatedFile)) {
  console.error(
    `[codegen] generator did not produce ${generatedFile}; check the BE pom`,
  )
  process.exit(2)
}
const size = statSync(generatedFile).size
if (size <= 0) {
  console.error(`[codegen] generated file is empty: ${generatedFile}`)
  process.exit(2)
}

console.log(`[codegen] OK -> ${generatedFile} (${size} bytes)`)
