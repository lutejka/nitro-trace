# Nitro: `srvx.request` tracing is missing in the Vite dev server

Minimal reproduction for a Nitro issue.

With `tracingChannel: true`, the **production** server emits `srvx.request` spans, but the **Vite dev server** (`nitro/vite`) emits none. `h3.request` spans work in both, so the tracing option and the channel subscription are fine — only the srvx layer is missing in Vite dev.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm (or npm / yarn)

## Install

```sh
pnpm install
```

## Reproduce

### 1. Vite dev — `srvx.request` is missing

```sh
pnpm dev
```

In another terminal:

```sh
# Linux / macOS
BASE_URL=http://localhost:3000 EXPECT=zero node scripts/probe.mjs

# Windows PowerShell
$env:BASE_URL='http://localhost:3000'; $env:EXPECT='zero'; node scripts/probe.mjs
```

Actual result (the exact `h3.request` count depends on how many requests you make):

```text
{
  "counts": {
    "h3.request": 10
  },
  "node": "v24.11.0",
  "pid": 1864
}

srvx.request    = 0
srvx.middleware = 0
h3.request      = 10

PASS (expected zero)
```

### 2. Production — `srvx.request` works

```sh
pnpm build
pnpm start
```

In another terminal:

```sh
# Linux / macOS
BASE_URL=http://localhost:3000 EXPECT=positive node scripts/probe.mjs

# Windows PowerShell
$env:BASE_URL='http://localhost:3000'; $env:EXPECT='positive'; node scripts/probe.mjs
```

Actual result:

```text
{
  "counts": {
    "srvx.request": 5,
    "h3.request": 10
  },
  "node": "v24.11.0",
  "pid": 17008
}

srvx.request    = 5
srvx.middleware = 0
h3.request      = 10

PASS (expected positive)
```

The probe makes a few requests to `/api/ping` and then reads `/api/probe`; the exact `srvx.request` number grows with the number of requests. What matters is **`0` in Vite dev vs `> 0` in production**.

> `nitro dev` is intentionally not part of this repro: `nitro()` sets `builder: "vite"`, and `nitro dev` rejects that builder with `Nitro dev CLI does not supports vite. Please use \`vite dev\` instead.` `nitro build` supports the Vite builder and produces the production server used above.

## Why

1. **Vite dev bypasses `serve()`.** `nitro/vite` serves requests through a connect middleware that calls `nitroEnv.dispatchFetch(req)`:
   - `src/build/vite/dev.ts` → `nitroDevMiddleware` → `nitroEnv.dispatchFetch(req)`
   - `FetchableDevEnvironment.dispatchFetch()` → `this.devServer.fetch(request)`

2. **srvx tracing is a srvx *server* plugin.** `srvx/tracing`'s `tracingPlugin` wraps `server.options.fetch`:

   ```js
   // srvx/dist/tracing.mjs
   const fetchChannel = tracingChannel("srvx.request");
   server.options.fetch = (request) =>
     fetchChannel.tracePromise(async () => await originalFetch(request), {
       request,
       server,
     });
   ```

3. **Nitro only installs that plugin when it creates a srvx `Server`.** `src/build/virtual/tracing.ts` generates `tracingSrvxPlugins = [srvxTracing()]`, and the runtime presets pass it to `serve()`:
   - `src/presets/node/runtime/node-server.ts` → `serve({ plugins: [...tracingSrvxPlugins] })`
   - `src/presets/_nitro/runtime/nitro-dev.ts`, `bun`, `deno-server` → same

4. **The Vite dev server never creates a srvx `Server`.** It calls `dispatchFetch` directly, so `tracingPlugin` never runs and nothing is published to the `srvx.request` / `srvx.middleware` channels.

5. **`h3.request` is different.** `#nitro/virtual/tracing` is pushed as a Nitro **app plugin** (`src/config/resolvers/tracing.ts`), so `h3Tracing()(nitroApp.h3)` runs in dev too. That is why `h3.request` fires in dev while `srvx.*` does not.

## Impact

Dev traces have no request root span. The h3 spans cannot be nested under a request-level span, so dev traces are flat/rootless compared with production. Any diagnostics-channel consumer — the built-in `tracingLogger`, an OTLP exporter, `nuxt-otel`, etc. — sees the difference.

## Possible fix

Install `tracingSrvxPlugins` in the Vite dev path as well — e.g. create a srvx `Server` in `nitro/vite` dev (or otherwise run the plugins against the dev fetch) instead of calling `dispatchFetch` directly.

## Files

- `nitro.config.ts` — `tracingChannel: true`
- `server/plugins/tracing-probe.ts` — subscribes to `tracing:srvx.request:start`, `tracing:srvx.middleware:start`, `tracing:h3.request:start`
- `server/api/probe.get.ts` — returns the counts
- `server/api/ping.get.ts` — dummy request target
- `scripts/probe.mjs` — makes requests and asserts `0` or `> 0`

## Versions verified

- `nitro@3.0.260903-beta`
- `vite@8.3.5`
- Node.js `v24.11.0`
