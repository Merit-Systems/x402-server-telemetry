# x402-server-telemetry

Shared telemetry package for Merit Systems x402 servers. Logs invocations to ClickHouse, extracts verified wallets from x402 payments and SIWX auth.

## Architecture

Three entrypoints via subpath exports:
- `.` (core) — `initTelemetry`, `withTelemetry`, `extractVerifiedWallet`. Deps: `@clickhouse/client`, `next`
- `./siwx` — `withSiwxTelemetry`. Deps: core + `@x402/extensions`, `@x402/core`
- `./builder` — `createRouteBuilder`, `HttpError`. Deps: core + `@x402/next`, `zod` (^4), `@x402/extensions`

Subpath exports exist to isolate peer deps. Consumers that only use `withTelemetry` don't need zod/x402 installed.

## Key files

- `src/index.ts` — core exports only
- `src/siwx.ts` — SIWX entrypoint (also exported as `./siwx`)
- `src/route-builder.ts` — route builder entrypoint (also exported as `./builder`)
- `src/telemetry-core.ts` — shared primitives (`extractRequestMeta`, `buildTelemetryContext`, `recordInvocation`) used by both `withTelemetry` and route builder
- `src/clickhouse.ts` — ClickHouse singleton, `insertInvocation` (fire-and-forget), `pingClickhouse` (verify)
- `src/init.ts` — `initTelemetry` (synchronous), optional `verify` flag triggers async ping
- `src/telemetry.ts` — `withTelemetry` wrapper (composes telemetry-core primitives)
- `src/extract-wallet.ts` — wallet extraction from payment headers
- `src/types.ts` — shared types (`McpResourceInvocation`, `TelemetryContext`, `RequestMeta`, `TelemetryConfig`)

## Critical rules

### No dynamic imports or require()
All imports are static. This was a hard-won lesson:
- `require()` compiles to broken `__require()` shim in tsup's ESM output
- `await import()` fails inside bundled code on Vercel
- Static imports + `serverExternalPackages: ['@clickhouse/client']` in the consumer is the only pattern that works reliably

### initTelemetry is synchronous
`createClient()` from `@clickhouse/client` is synchronous (connects lazily on first query). There is no reason for `initTelemetry` to be async.

### Never tell consumers to use instrumentation.ts
On Vercel serverless, `instrumentation.ts` runs in a separate module scope from route handlers. The ClickHouse client singleton set there is invisible to handlers. Always tell consumers to call `initTelemetry()` at module level in the same file that imports their route wrappers.

### tsup splitting: true is mandatory
The tsup config uses `splitting: true` so that all three entry points (index, siwx, builder) share a single ClickHouse singleton via a common chunk. Without it, each entry point gets its own copy of `clickhouseClient` — `initTelemetry()` from `./index` sets one copy, but `insertInvocation()` from `./builder` reads a different one (null). This is the same class of bug as the instrumentation.ts module scope issue.

### Telemetry never affects responses
All ClickHouse logging is fire-and-forget, wrapped in try/catch. A telemetry failure must never cause a 500 or delay a response.

### telemetry-core.ts is the single source of truth
Both `withTelemetry` and the route builder's handler use `extractRequestMeta`, `buildTelemetryContext`, and `recordInvocation` from `telemetry-core.ts`. Never reimplement header extraction or invocation logging inline — fix it in one place.

## Build

```bash
npm run check   # format + lint + typecheck + build + test
npm run build    # tsup only
npm test         # vitest
```

tsup produces 3 entry points (index, siwx, builder) in both CJS and ESM with declarations. All peer deps are marked external.

### After publishing, commit both package.json and lockfile in consumers
`pnpm update @merit-systems/x402-server-telemetry` bumps the specifier in BOTH `package.json` and `pnpm-lock.yaml`. Vercel's `frozen-lockfile` will reject deploys if only the lockfile is committed. Always `git add package.json pnpm-lock.yaml`.

## Consumers

- **enrichx402** — uses core + `./builder` (wraps `createRouteBuilder` in its own X402RouteBuilder)
- **stablestudio** — uses core + `./siwx` (wraps with `withTelemetry` and `withSiwxTelemetry`)
