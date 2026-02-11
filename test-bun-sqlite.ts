/**
 * Bun.sqlite Capability Test
 *
 * Tests whether Bun.sqlite has the features needed for miniAgent memory system:
 * - FTS5 support
 * - Extension loading (sqlite-vec)
 * - Performance
 */

import { Database } from "bun:sqlite";

console.log("=== Bun.sqlite Capability Test ===\n");

// Test 1: Basic Operations
console.log("Test 1: Basic Operations");
try {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
  db.prepare("INSERT INTO test (value) VALUES (?)").run("test-value");

  const result = db.prepare("SELECT * FROM test").all();
  console.log("  Result:", result);
  console.log("  ✅ Basic operations work\n");
} catch (err) {
  console.log("  ❌ Error:", err);
  process.exit(1);
}

// Test 2: FTS5 Support
console.log("Test 2: FTS5 (Full-Text Search) Support");
try {
  const db = new Database(":memory:");

  db.exec("CREATE VIRTUAL TABLE fts USING fts5(content)");
  db.prepare("INSERT INTO fts VALUES (?)").run("hello world from Bun");
  db.prepare("INSERT INTO fts VALUES (?)").run("testing full text search");

  const result = db.prepare("SELECT * FROM fts WHERE fts MATCH 'hello'").all();
  console.log("  FTS result:", result);
  console.log("  ✅ FTS5 works!\n");
} catch (err) {
  console.log("  ❌ FTS5 error:", err);
  console.log("  Note: FTS5 is REQUIRED for miniAgent memory system");
  process.exit(1);
}

// Test 3: Extension Loading
console.log("Test 3: Extension Loading (sqlite-vec)");
try {
  const db = new Database(":memory:");

  // Try to load sqlite-vec extension
  const sqliteVec = await import("sqlite-vec");
  const extPath = sqliteVec.getLoadablePath();
  console.log("  Extension path:", extPath);

  try {
    db.loadExtension(extPath);
    console.log("  ✅ Extension loading works!");

    // Test vector search
    db.exec("CREATE VIRTUAL TABLE vec_test USING vec0(embedding float[3])");
    db.prepare("INSERT INTO vec_test(rowid, embedding) VALUES (?, ?)").run(
      1,
      JSON.stringify([1.0, 0.0, 0.0]),
    );

    console.log("  ✅ Vector table created and data inserted\n");
  } catch (err) {
    console.log("  ❌ Extension loading failed:", err.message);
    console.log("  Note: Vector search is CRITICAL for miniAgent memory\n");
  }
} catch (err) {
  console.log("  ⚠️  sqlite-vec not available:", err.message);
  console.log("  (Install with: bun add sqlite-vec)\n");
}

// Test 4: Performance
console.log("Test 4: Performance (10,000 inserts)");
const iterations = 10000;

console.time("  Bun.sqlite");
const db = new Database(":memory:");
db.exec("CREATE TABLE bench (id INTEGER PRIMARY KEY, value TEXT)");
const insert = db.prepare("INSERT INTO bench (value) VALUES (?)");

for (let i = 0; i < iterations; i++) {
  insert.run(`value-${i}`);
}

const count = db.prepare("SELECT COUNT(*) as count FROM bench").get();
console.timeEnd("  Bun.sqlite");
console.log("  Result:", count);

// Test using transactions for comparison
console.log("\nTest 4b: Performance with transaction");
console.time("  Bun.sqlite (transaction)");
const db2 = new Database(":memory:");
db2.exec("CREATE TABLE bench (id INTEGER PRIMARY KEY, value TEXT)");
const insert2 = db2.prepare("INSERT INTO bench (value) VALUES (?)");

db2.exec("BEGIN TRANSACTION");
for (let i = 0; i < iterations; i++) {
  insert2.run(`value-${i}`);
}
db2.exec("COMMIT");

const count2 = db2.prepare("SELECT COUNT(*) as count FROM bench").get();
console.timeEnd("  Bun.sqlite (transaction)");
console.log("  Result:", count2);

console.log("\n=== Bun.sqlite Capability Test Complete ===");
console.log("\n## Summary:");
console.log("✅ Basic operations: Supported");
console.log("✅ FTS5: Supported");
console.log("? Extension loading: Check output above");
console.log("✅ Performance: Check timing above");
console.log("\nConclusion:");
console.log("If extension loading works, Bun.sqlite CAN replace node:sqlite");
console.log("If extension loading fails, KEEP node:sqlite (it currently works)");
