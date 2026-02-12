/**
 * Bun.sqlite database utilities
 *
 * Migrated from node:sqlite to Bun native sqlite for better performance
 */

import { Database } from "bun:sqlite";

/**
 * Export Database class from Bun.sqlite
 * This replaces the previous requireNodeSqlite() pattern
 */
export { Database as BunDatabase };
export type { Database };
