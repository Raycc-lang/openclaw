/**
 * SQLite Compatibility Test: node:sqlite vs Bun.sqlite
 *
 * Tests whether Bun.sqlite can replace node:sqlite for miniAgent memory system
 */

import { Database as BunDatabase } from "bun:sqlite";
import { DatabaseSync as NodeDatabase } from "node:sqlite";

console.log("=== SQLite Compatibility Test ===\n");

// Test 1: Basic Operations
console.log("Test 1: Basic Operations");
try {
  const bunDb = new BunDatabase(":memory:");
  const nodeDb = new NodeDatabase(":memory:");

  // Create table
  bunDb.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
  nodeDb.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");

  // Insert data
  bunDb.prepare("INSERT INTO test (value) VALUES (?)").run("bun-test");
  nodeDb.prepare("INSERT INTO test (value) VALUES (?)").run("node-test");

  // Query data
  const bunResult = bunDb.prepare("SELECT * FROM test").all();
  const nodeResult = nodeDb.prepare("SELECT * FROM test").all();

  console.log("  Bun result:", bunResult);
  console.log("  Node result:", nodeResult);
  console.log("  ✅ Basic operations work on both\n");
} catch (err) {
  console.log("  ❌ Error:", err);
  process.exit(1);
}

// Test 2: FTS5 Support
console.log("Test 2: FTS5 (Full-Text Search) Support");
try {
  const bunDb = new BunDatabase(":memory:");
  const nodeDb = new NodeDatabase(":memory:");

  // Create FTS5 table
  bunDb.exec("CREATE VIRTUAL TABLE fts USING fts5(content)");
  nodeDb.exec("CREATE VIRTUAL TABLE fts USING fts5(content)");

  // Insert data
  bunDb.prepare("INSERT INTO fts VALUES (?)").run("hello world");
  nodeDb.prepare("INSERT INTO fts VALUES (?)").run("hello world");

  // Search
  const bunFts = bunDb.prepare("SELECT * FROM fts WHERE fts MATCH 'hello'").all();
  const nodeFts = nodeDb.prepare("SELECT * FROM fts WHERE fts MATCH 'hello'").all();

  console.log("  Bun FTS result:", bunFts);
  console.log("  Node FTS result:", nodeFts);
  console.log("  ✅ FTS5 works on both\n");
} catch (err) {
  console.log("  ❌ FTS5 error:", err);
  process.exit(1);
}

// Test 3: Extension Loading (sqlite-vec)
console.log("Test 3: Extension Loading (sqlite-vec)");
try {
  const bunDb = new BunDatabase(":memory:");
  const nodeDb = new NodeDatabase(":memory:");

  // Try to load sqlite-vec extension
  const sqliteVec = await import("sqlite-vec");
  const extPath = sqliteVec.getLoadablePath();
  console.log("  Extension path:", extPath);

  // Bun: loadExtension
  try {
    bunDb.loadExtension(extPath);
    console.log("  ✅ Bun: loadExtension succeeded");
  } catch (err) {
    console.log("  ⚠️  Bun: loadExtension failed -", err.message);
  }

  // Node: enableLoadExtension + loadExtension
  try {
    nodeDb.enableLoadExtension(true);
    nodeDb.loadExtension(extPath);
    console.log("  ✅ Node: loadExtension succeeded");
  } catch (err) {
    console.log("  ❌ Node: loadExtension failed -", err.message);
  }

  console.log();
} catch (err) {
  console.log("  ⚠️  sqlite-vec not available:", err.message);
  console.log("  (This is expected if sqlite-vec is not installed)\n");
}

// Test 4: Performance Comparison
console.log("Test 4: Performance Comparison (10,000 inserts)");
const iterations = 10000;

// Bun performance
console.time("  Bun.sqlite");
const bunDb = new BunDatabase(":memory:");
bunDb.exec("CREATE TABLE bench (id INTEGER PRIMARY KEY, value TEXT)");
const bunInsert = bunDb.prepare("INSERT INTO bench (value) VALUES (?)");
for (let i = 0; i < iterations; i++) {
  bunInsert.run(`value-${i}`);
}
const bunCount = bunDb.prepare("SELECT COUNT(*) as count FROM bench").get();
console.timeEnd("  Bun.sqlite");
console.log("    Result:", bunCount);

// Node performance
console.time("  node:sqlite");
const nodeDb = new NodeDatabase(":memory:");
nodeDb.exec("CREATE TABLE bench (id INTEGER PRIMARY KEY, value TEXT)");
const nodeInsert = nodeDb.prepare("INSERT INTO bench (value) VALUES (?)");
for (let i = 0; i < iterations; i++) {
  nodeInsert.run(`value-${i}`);
}
const nodeCount = nodeDb.prepare("SELECT COUNT(*) as count FROM bench").get();
console.timeEnd("  node:sqlite");
console.log("    Result:", nodeCount);

console.log("\n=== SQLite Compatibility Test Complete ===");
console.log("\n## Decision Matrix:");
console.log("- FTS5 Support: ✅ Both support");
console.log("- Extension Loading: Check test output above");
console.log("- Performance: Check timing above");
console.log("- API Compatibility: Similar but not identical");
console.log("\nRecommendation:");
console.log("- If extension loading works in Bun: Consider migration");
console.log("- If extension loading fails: KEEP node:sqlite (it works!)");
