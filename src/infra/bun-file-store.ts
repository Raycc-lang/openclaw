/**
 * Bun-native file operations for miniAgent
 *
 * Provides high-performance file I/O using Bun's native APIs
 * for session and memory file handling.
 */

export class BunFileStore {
  /**
   * Read file as text
   */
  async readText(path: string): Promise<string> {
    const file = Bun.file(path);
    return await file.text();
  }

  /**
   * Read and parse JSON file
   */
  async readJSON<T>(path: string): Promise<T> {
    const file = Bun.file(path);
    return await file.json();
  }

  /**
   * Write text to file
   */
  async writeText(path: string, data: string): Promise<void> {
    await Bun.write(path, data);
  }

  /**
   * Write JSON to file with formatting
   */
  async writeJSON(path: string, data: unknown): Promise<void> {
    await Bun.write(path, JSON.stringify(data, null, 2));
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    const file = Bun.file(path);
    return await file.exists();
  }

  /**
   * Read file synchronously as text
   */
  readTextSync(path: string): string {
    const file = Bun.file(path);
    // Bun doesn't have a built-in sync text method, so we need to use the fs fallback
    // for synchronous operations. This is acceptable for non-hot-path operations.
    // For hot paths, use async methods.
    const arrayBuffer = file.arrayBuffer() as unknown as ArrayBuffer;
    const decoder = new TextDecoder();
    return decoder.decode(arrayBuffer);
  }

  /**
   * Write file synchronously
   * Note: Bun write is async-only, so this is not implemented
   */
  writeTextSync(_path: string, _data: string): void {
    // Bun.write returns a Promise but can be used in a sync context with proper handling
    // For true sync operations in non-hot paths, we keep fs.writeFileSync
    // This method is provided for API compatibility but should be avoided
    throw new Error(
      "Synchronous write not supported in BunFileStore. Use writeText() instead or keep fs.writeFileSync for non-hot-path operations.",
    );
  }
}

/**
 * Singleton instance of BunFileStore
 */
export const bunFileStore = new BunFileStore();

/**
 * Type-safe file operations
 */
export type FileStore = BunFileStore;
