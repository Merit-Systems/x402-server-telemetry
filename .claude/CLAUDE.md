# CLAUDE.md — @agentcash/telemetry

ClickHouse telemetry for x402/MPP/SIWX API services. Logs invocations to ClickHouse, extracts verified wallets from x402 payments and SIWX auth.

## Architecture

Four entrypoints via subpath exports:

- **`.`** (core) — `initTelemetry`, `withTelemetry`, `extractVerifiedWallet`. Deps: `@clickhouse/client`, `next`
- **`./plugin`** — `createTelemetryPlugin` — **Primary integration path.** Router plugin that hooks into `@agentcash/router`'s orchestrate lifecycle. Captures request metadata, payment verification, settlement, response, errors, alerts, and provider quota. Deps: core (no direct dependency on `@agentcash/router` — uses inlined type shapes).
- **`./siwx`** — `withSiwxTelemetry`. Superseded by `@agentcash/router`'s built-in SIWX handling + `./plugin`. Kept for backward compatibility.
- **`./builder`** — `createRouteBuilder`, `HttpError`. Superseded by `@agentcash/router`'s `RouteBuilder`. Kept for backward compatibility. Deps: core + `@x402/next`, `zod` (^4), `@x402/extensions`

Subpath exports exist to isolate peer deps. Consumers that only use `./plugin` don't need zod, `@x402/next`, or `@x402/extensions` installed.

## Key files

- `src/router-plugin.ts` — `createTelemetryPlugin` factory (./plugin entrypoint)
- `src/clickhouse.ts` — ClickHouse singleton, `insertInvocation` (fire-and-forget), `pingClickhouse` (verify)
- `src/telemetry-core.ts` — shared primitives (`extractRequestMeta`, `buildTelemetryContext`, `recordInvocation`)
- `src/telemetry.ts` — `withTelemetry` wrapper
- `src/siwx.ts` — `withSiwxTelemetry` wrapper
- `src/route-builder.ts` — legacy route builder
- `src/extract-wallet.ts` — wallet extraction from payment headers
- `src/init.ts` — `initTelemetry` (synchronous), optional `verify` flag
- `src/types.ts` — shared types (`McpResourceInvocation`, `TelemetryContext`, `TelemetryConfig`)

## Consumer Patterns

### Recommended: Router Plugin (new services)

```typescript
import { createRouter } from '@agentcash/router';
import { createTelemetryPlugin } from '@agentcash/telemetry/plugin';

const router = createRouter({
  payeeAddress: '0x...',
  plugin: createTelemetryPlugin({
    clickhouse: {
      url: process.env.TELEM_CLICKHOUSE_URL,
      database: process.env.TELEM_CLICKHOUSE_DATABASE,
      username: process.env.TELEM_CLICKHOUSE_USERNAME,
      password: process.env.TELEM_CLICKHOUSE_PASSWORD,
    },
  }),
});
```

Used by: **stablestudio**

### Legacy: withTelemetry / withSiwxTelemetry (older services)

The `./builder` and `./siwx` subpaths provide `withTelemetry` and `withSiwxTelemetry` wrappers for services not yet migrated to `@agentcash/router`. These wrap individual route handlers.

Used by: **enrichx402** (core + `./builder`)

## Critical rules

### No dynamic imports or require()
All imports are static. `require()` compiles to broken `__require()` shim in tsup's ESM output. `await import()` fails inside bundled code on Vercel. Static imports + `serverExternalPackages: ['@clickhouse/client']` in the consumer is the only pattern that works reliably.

### initTelemetry is synchronous
`createClient()` from `@clickhouse/client` is synchronous (connects lazily on first query).

### Never tell consumers to use instrumentation.ts
On Vercel serverless, `instrumentation.ts` runs in a separate module scope from route handlers. The ClickHouse client singleton set there is invisible to handlers.

### tsup splitting: true is mandatory
All entry points share a single ClickHouse singleton via a common chunk. Without splitting, each entry point gets its own copy of `clickhouseClient`.

### Telemetry never affects responses
All ClickHouse logging is fire-and-forget, wrapped in try/catch. A telemetry failure must never cause a 500 or delay a response.

## Build

```bash
pnpm build      # tsup
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
pnpm check      # format + lint + typecheck + build + test
```

### After publishing, commit both package.json and lockfile in consumers
`pnpm update @agentcash/telemetry` bumps the specifier in BOTH `package.json` and `pnpm-lock.yaml`. Vercel's `frozen-lockfile` will reject deploys if only the lockfile is committed.
