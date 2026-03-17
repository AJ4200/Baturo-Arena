const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbDirectory = path.join(__dirname, "..", "..", "data");
const dbPath = path.join(dbDirectory, "ttt.sqlite");

let SQL = null;
let db = null;

function ensureInitialized() {
  if (!db) {
    throw new Error("Database not initialized");
  }
}

function persistDatabase() {
  ensureInitialized();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function mapResultRow(statement) {
  const row = {};
  const values = statement.get();
  statement.getColumnNames().forEach((column, index) => {
    row[column] = values[index];
  });
  return row;
}

async function initializeClient() {
  if (db) {
    return;
  }

  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }

  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "..", "..", "node_modules", "sql.js", "dist", file),
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    persistDatabase();
  }

  db.run("PRAGMA foreign_keys = ON");
}

async function run(sql, params = []) {
  ensureInitialized();
  db.run(sql, params);

  const idResult = allSync("SELECT last_insert_rowid() AS id LIMIT 1");
  const lastID = idResult[0] ? Number(idResult[0].id) : null;
  const changes = Number(db.getRowsModified());

  persistDatabase();

  return { lastID, changes };
}

function allSync(sql, params = []) {
  ensureInitialized();

  const statement = db.prepare(sql, params);
  const rows = [];

  while (statement.step()) {
    rows.push(mapResultRow(statement));
  }

  statement.free();
  return rows;
}

async function get(sql, params = []) {
  const rows = allSync(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function all(sql, params = []) {
  return allSync(sql, params);
}

module.exports = {
  initializeClient,
  run,
  get,
  all,
};
