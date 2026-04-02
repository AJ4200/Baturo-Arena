const { Pool } = require('pg');
const { postgresUrl } = require('../config/env');

let pool = null;

function ensureInitialized() {
  if (!pool) {
    throw new Error('Database not initialized');
  }
}

function replaceQuestionPlaceholders(sql) {
  let parameterIndex = 0;
  return sql.replace(/\?/g, () => {
    parameterIndex += 1;
    return `$${parameterIndex}`;
  });
}

async function initializeClient() {
  if (pool) {
    return;
  }

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is required');
  }

  pool = new Pool({
    connectionString: postgresUrl,
  });

  await pool.query('SELECT 1');
}

async function run(sql, params = []) {
  ensureInitialized();
  const result = await pool.query(replaceQuestionPlaceholders(sql), params);
  const firstRow = result.rows[0] || null;

  return {
    lastID: firstRow && Number.isFinite(Number(firstRow.id)) ? Number(firstRow.id) : null,
    changes: Number(result.rowCount || 0),
    rows: result.rows,
  };
}

async function get(sql, params = []) {
  ensureInitialized();
  const result = await pool.query(replaceQuestionPlaceholders(sql), params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  ensureInitialized();
  const result = await pool.query(replaceQuestionPlaceholders(sql), params);
  return result.rows;
}

module.exports = {
  initializeClient,
  run,
  get,
  all,
};
