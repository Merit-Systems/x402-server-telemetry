# Decision Record: Router Plugin Migration

**Date:** 2026-02-14
**Scope:** @agentcash/telemetry CLAUDE.md update (docs only, no code changes)

## Context

stablestudio migrated from hand-rolled x402 server init + `withTelemetry`/`withSiwxTelemetry` wrappers to `@agentcash/router` with `createTelemetryPlugin` from `@agentcash/telemetry/plugin`.

## Changes

### CLAUDE.md updates

- **Package name:** Updated references from `@merit-systems/x402-server-telemetry` to `@agentcash/telemetry`
- **Added `./plugin` subpath:** `createTelemetryPlugin` — router plugin that hooks into `@agentcash/router`'s orchestrate lifecycle. Now documented as the **primary integration path**.
- **Updated consumer patterns:** stablestudio now uses `createTelemetryPlugin` (router plugin), not `withTelemetry`/`withSiwxTelemetry` wrappers.
- **Marked legacy subpaths:** `./siwx` and `./builder` are superseded by `@agentcash/router`'s built-in handling + `./plugin`. Both still exist for backward compat (enrichx402 still uses `./builder`).

## Migration Path

New services should use `@agentcash/router` + `createTelemetryPlugin`. Existing services on `withTelemetry`/`withSiwxTelemetry` can continue using them until they migrate to the router.
