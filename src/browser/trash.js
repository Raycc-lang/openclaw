// Browser trash functionality removed in miniAgent - stub using fs.rm
export async function movePathToTrash(pathname) {
  const fs = await import("node:fs/promises");
  await fs.rm(pathname, { recursive: true, force: true });
}
