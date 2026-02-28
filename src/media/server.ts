import type { Server as BunServer } from "bun";
import fs from "node:fs/promises";
import { danger } from "../globals.js";
import { SafeOpenError, openFileWithinRoot } from "../infra/fs-safe.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { detectMime } from "./mime.js";
import { cleanOldMedia, getMediaDir, MEDIA_MAX_BYTES } from "./store.js";

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_MEDIA_ID_CHARS = 200;
const MEDIA_ID_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const MAX_MEDIA_BYTES = MEDIA_MAX_BYTES;
const MEDIA_PATH_RE = /^\/media\/(.+)$/;

const isValidMediaId = (id: string) => {
	if (!id) {
		return false;
	}
	if (id.length > MAX_MEDIA_ID_CHARS) {
		return false;
	}
	if (id === "." || id === "..") {
		return false;
	}
	return MEDIA_ID_PATTERN.test(id);
};

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
			const match = MEDIA_PATH_RE.exec(url.pathname);
			if (!match || req.method !== "GET") {
				return new Response("not found", { status: 404 });
			}

			const id = match[1]!;
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
					await fs.rm(realPath).catch(() => {});
					return new Response("expired", { status: 410 });
				}
				const data = await handle.readFile();
				await handle.close().catch(() => {});
				const mime = await detectMime({ buffer: data, filePath: realPath });
				const headers: Record<string, string> = {};
				if (mime) {
					headers["Content-Type"] = mime;
				}
				const response = new Response(data, { headers });
				setTimeout(() => {
					fs.rm(realPath).catch(() => {});
				}, 50);
				return response;
			} catch (err) {
				if (err instanceof SafeOpenError) {
					if (err.code === "invalid-path") {
						return new Response("invalid path", { status: 400 });
					}
					if (err.code === "not-found") {
						return new Response("not found", { status: 404 });
					}
				}
				return new Response("not found", { status: 404 });
			}
		},
	});

	setInterval(() => {
		void cleanOldMedia(ttlMs);
	}, ttlMs).unref();

	return server;
}
