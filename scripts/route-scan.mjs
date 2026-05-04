#!/usr/bin/env node
// Lightweight smoke-test: walk every authenticated dashboard route, capture
// console errors and 4xx/5xx API responses, flag any route that renders
// blank. Useful as a pre-deploy check or after a wire-shape change.
//
// Requires the stack to be running locally:
//   - dashboard at http://127.0.0.1:5173
//   - backend  at http://localhost:7070
// And a known test user. Override via env:
//   ROUTE_SCAN_BASE=http://127.0.0.1:5173 \
//   ROUTE_SCAN_EMAIL=test@wrendex.local \
//   ROUTE_SCAN_PASSWORD=wrendex-test-2026 \
//   ROUTE_SCAN_TENANT=<id> ROUTE_SCAN_SITE=<id> \
//   node scripts/route-scan.mjs
//
// Exits non-zero if any route renders blank or surfaces console / network
// errors so this can drive CI alongside vitest.

// playwright is intentionally NOT a dashboard devDep -- it pulls a
// chromium binary that bloats every install. Run this script after a
// scratch playwright install, pointing PLAYWRIGHT_DIR at the install
// root so we can dynamic-import from it:
//   mkdir -p /tmp/wrendex-pw && cd /tmp/wrendex-pw && \
//     npm init -y && npm i -D playwright && npx playwright install chromium
//   PLAYWRIGHT_DIR=/tmp/wrendex-pw \
//     ROUTE_SCAN_TENANT=<id> ROUTE_SCAN_SITE=<id> \
//     node scripts/route-scan.mjs
import path from 'node:path'
import { pathToFileURL } from 'node:url'
let chromium
try {
  if (process.env.PLAYWRIGHT_DIR) {
    const url = pathToFileURL(
      path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright', 'index.mjs'),
    ).href
    ;({ chromium } = await import(url))
  } else {
    ({ chromium } = await import('playwright'))
  }
} catch {
  console.error(
    'playwright not resolvable. See header comment for one-line setup. ' +
      'Set PLAYWRIGHT_DIR to a directory whose node_modules has playwright.',
  )
  process.exit(2)
}

const BASE = process.env.ROUTE_SCAN_BASE || 'http://127.0.0.1:5173'
const EMAIL = process.env.ROUTE_SCAN_EMAIL || 'test@wrendex.local'
const PASSWORD = process.env.ROUTE_SCAN_PASSWORD || 'wrendex-test-2026'
const TENANT = process.env.ROUTE_SCAN_TENANT
const SITE = process.env.ROUTE_SCAN_SITE

if (!TENANT) {
  console.error('ROUTE_SCAN_TENANT must be set to a tenant id')
  process.exit(1)
}

// SITE-scoped routes are only included when ROUTE_SCAN_SITE is set; otherwise
// we scan only the tenant-level routes.
const ROUTES = [
  '/sites',
  '/inbox',
  '/notifications/log',
  '/reports',
  '/catalog',
  '/schedule',
  '/team',
  '/billing',
  '/settings',
]
if (SITE) {
  ROUTES.push(
    '/sites/' + SITE,
    '/sites/' + SITE + '/crawls',
    '/sites/' + SITE + '/pages',
    '/sites/' + SITE + '/health-history',
    '/sites/' + SITE + '/compare',
    '/sites/' + SITE + '/settings',
    '/sites/' + SITE + '/spot-audit',
  )
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

let consoleErrCount = 0
let netFailCount = 0

page.on('console', m => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (/React Router Future Flag|DevTools|Recharts|width\(-1\)/i.test(t)) return
  consoleErrCount++
  console.log('[CONSOLE-ERR]', t.slice(0, 200))
})
page.on('pageerror', e => { consoleErrCount++; console.log('[PAGEERR]', e.message) })
page.on('response', async r => {
  if (r.status() >= 400 && r.url().includes('/api/')) {
    netFailCount++
    console.log('[NET-FAIL]', r.status(), r.url())
  }
})

await page.goto(BASE + '/')
await page.locator('input[type="email"]').waitFor({ timeout: 15000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').click()
await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 })

const results = []
for (const route of ROUTES) {
  consoleErrCount = 0; netFailCount = 0
  await page.goto(BASE + '/t/' + TENANT + route)
  let ok = false
  for (let i = 0; i < 10; i++) {
    const t = await page.locator('body').innerText()
    if (t.length > 200) { ok = true; break }
    await page.waitForTimeout(500)
  }
  const len = (await page.locator('body').innerText()).length
  results.push({ route, len, ok, consoleErrCount, netFailCount })
}

let bad = 0
console.log('\n=== route summary ===')
for (const r of results) {
  const blankFail = !r.ok
  const errFail = r.consoleErrCount > 0 || r.netFailCount > 0
  const flag = blankFail ? '!! BLANK ' : errFail ? '!! ERRS  ' : 'OK       '
  if (blankFail || errFail) bad++
  console.log(`${flag} ${r.route.padEnd(45)} chars=${String(r.len).padStart(5)} cons=${r.consoleErrCount} net=${r.netFailCount}`)
}

await browser.close()
console.log(`\n${results.length - bad}/${results.length} routes clean`)
process.exit(bad === 0 ? 0 : 1)
