# Express → Bun.serve Migration Analysis

**Date**: 2026-02-28
**Scope**: `src/media/server.ts` — the only remaining Express consumer
**Goal**: Evaluate migrating the media server from Express to `Bun.serve`, removing the `express` dependency entirely

---

## Current State

### What Express Does

The media server is a minimal, on-demand HTTP file server with one route:

```
GET /media/:id → serve a temporary file from ~/.openclaw/media/
```

It handles:

- **Path validation**: regex + length checks on the `:id` param
- **Safe file open**: `openFileWithinRoot()` prevents path traversal
- **Size check**: rejects files > 5MB
- **TTL expiry**: rejects files older than 2 minutes, deletes on disk
- **MIME detection**: `file-type` sniffing + extension mapping
- **Single-use cleanup**: deletes the file after `res.finish` fires
- **Periodic cleanup**: `setInterval` sweep for expired files

### Where It's Used

`src/media/host.ts` → `ensureMediaHosted()` starts the Express server **on-demand** (not at gateway boot). It only runs when:

1. An agent tool needs to expose a local file via Tailscale URL
2. No existing server is listening on the media port (default `42873`)

The media server runs on a **separate port** from the gateway — it is *not* mounted inside the gateway's `Bun.serve` instance.

### Express Surface Area

| File | Express Usage |
|---|---|
| `src/media/server.ts` | `import express` — defines routes, starts `app.listen()` |
| `package.json` | `express` (runtime dep), `@types/express` (dev dep) |

**No other file** in `src/` imports Express. Hono is also unused (listed but never imported).

---

## Migration Design

### Option A: Standalone `Bun.serve` (Recommended)

Replace `startMediaServer()` with a standalone `Bun.serve` instance on the same port. This is the simplest approach — a direct 1:1 replacement.

```typescript
// New src/media/server.ts (conceptual)
export async function startMediaServer(
  port: number,
  ttlMs = DEFAULT_TTL_MS,
  runtime: RuntimeEnv = defaultRuntime,
): Promise<BunServer> {
  const mediaDir = getMediaDir();

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const match = url.pathname.match(/^\/media\/(.+)$/);
      if (!match || req.method !== "GET") {
        return new Response("Not Found", { status: 404 });
      }

      const id = match[1];
      if (!isValidMediaId(id)) {
        return new Response("invalid path", { status: 400 });
      }

      try {
        const { handle, realPath, stat } = await openFileWithinRoot({
          rootDir: mediaDir,
          relativePath: id,
        });

        if (stat.size > MAX_MEDIA_BYTES) {
          await handle.close().catch(() => {});
          return new Response("too large", { status: 413 });
        }

        if (Date.now() - stat.mtimeMs > ttlMs) {
          await handle.close().catch(() => {});
          await Bun.file(realPath).delete().catch(() => {});
          return new Response("expired", { status: 410 });
        }

        const data = await handle.readFile();
        await handle.close().catch(() => {});
        const mime = await detectMime({ buffer: data, filePath: realPath });

        // Schedule single-use cleanup
        setTimeout(() => {
          Bun.file(realPath).delete().catch(() => {});
        }, 50);

        return new Response(data, {
          headers: mime ? { "Content-Type": mime } : {},
        });
      } catch (err) {
        if (err instanceof SafeOpenError) {
          if (err.code === "invalid-path") {
            return new Response("invalid path", { status: 400 });
          }
        }
        return new Response("not found", { status: 404 });
      }
    },
  });

  // periodic cleanup
  setInterval(() => {
    void cleanOldMedia(ttlMs);
  }, ttlMs).unref();

  return server;
}
```

### Option B: Mount Inside Gateway `Bun.serve`

Add the `/media/:id` route as another `httpHandler` in the existing `createGatewayBunServer()`. This avoids a second listening port but changes the media server's architecture (currently it's intentionally separate and on-demand).

**Not recommended** because:

- The media server runs on a different port by design
- It's started lazily, not at gateway boot
- Merging would complicate the gateway's `fetch()` handler for minimal gain

---

## Benefits

| Benefit | Impact | Notes |
|---|---|---|
| **Remove `express` dependency** | 🟢 Moderate | Drops Express + its transitive deps from install |
| **Remove `@types/express` devDep** | 🟢 Minor | Cleaner devDeps |
| **Remove `hono` dependency** | 🟢 Minor | Also unused — can be removed in same PR |
| **Consistent runtime** | 🟢 Good | Gateway already uses `Bun.serve`; media server matches |
| **Simpler Response model** | 🟢 Good | `return new Response(...)` vs `res.status().send()` |
| **Bun.file() for serving** | 🟢 Minor | Could use `Bun.file()` for zero-copy file reads in future |
| **Smaller `node_modules`** | 🟢 Moderate | Express pulls in ~30 transitive packages |

### What It Won't Do

| Non-benefit | Why |
|---|---|
| **Reduce runtime memory** | Media server is started on-demand and serves tiny files — negligible memory |
| **Improve throughput** | Single-file serving with 2-min TTL — not a hot path |
| **Simplify host.ts** | `host.ts` still needs the same `startMediaServer()` contract |

---

## Complexity Assessment

### Low Complexity — Straightforward Port

| Aspect | Difficulty | Reason |
|---|---|---|
| Route handling | 🟢 Trivial | One route: `GET /media/:id` |
| Request parsing | 🟢 Trivial | Only reads `req.params.id` → regex on `url.pathname` |
| Response model | 🟢 Trivial | `res.status().send()` → `new Response()` |
| Error handling | 🟢 Trivial | Same `SafeOpenError` catch, same status codes |
| MIME detection | 🟢 No change | `detectMime()` is framework-agnostic |
| File I/O | 🟢 No change | `openFileWithinRoot()` is framework-agnostic |
| Cleanup-on-finish | 🟡 Minor | `res.on("finish", ...)` → `setTimeout()` after `return new Response()` |
| Return type change | 🟡 Minor | `host.ts` stores `Server` (node:http) → needs `BunServer` type |
| Periodic cleanup | 🟢 No change | `setInterval` stays identical |

### Files to Change

| File | Change |
|---|---|
| `src/media/server.ts` | Rewrite: Express → `Bun.serve` (106 lines → ~70 lines) |
| `src/media/host.ts` | Update type: `import("http").Server` → `import("bun").Server` |
| `package.json` | Remove `express`, `@types/express`, `hono`, `@types/express` |

### Files That Don't Change

- `src/media/store.ts` — storage logic, no Express dependency
- `src/media/mime.ts` — MIME detection, no Express dependency
- `src/infra/fs-safe.ts` — safe file open, no Express dependency
- `src/gateway/server-bun.ts` — gateway server, unrelated

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `Bun.serve` on separate port conflicts | Very low | Same port binding semantics as Express |
| `server.unref()` behavior differs | Low | Bun.serve supports `.unref()` on the server |
| Cleanup timing changes | Very low | `setTimeout` after response is equivalent to `res.on("finish")` for single-response handlers |
| Type mismatch in `host.ts` | Certain | Simple type update: `http.Server` → `bun.Server` |

---

## Recommendation

**Do it.** This is a clean, low-risk migration:

- **1 route** to port
- **3 files** to touch
- **~70 lines** of new code replacing ~106 lines
- **2 deps removed** (express, hono) + their transitive trees
- **Zero behavioral change** — same validation, same MIME detection, same cleanup
- **Consistent with existing pattern** — gateway already uses `Bun.serve`

Estimated effort: **30 minutes** including testing.

### Test Plan

1. Start gateway, trigger media hosting (e.g., agent sends an image via Discord)
2. Verify `GET /media/:id` returns correct file with correct MIME type
3. Verify expired files return 410
4. Verify invalid IDs return 400
5. Verify file is deleted after serving
6. Verify periodic cleanup runs
