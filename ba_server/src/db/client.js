const { Pool } = require('pg');
const {
  postgresUrl,
  dbPoolMax,
  dbConnectionTimeoutMs,
  dbIdleTimeoutMs,
  dbConnectRetries,
  dbConnectRetryDelayMs,
} = require('../config/env');

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

function createPool() {
  const connectionTimeoutMs =
    Number.isFinite(dbConnectionTimeoutMs) && dbConnectionTimeoutMs > 0 ? dbConnectionTimeoutMs : 30000;
  const idleTimeoutMs = Number.isFinite(dbIdleTimeoutMs) && dbIdleTimeoutMs > 0 ? dbIdleTimeoutMs : 30000;
  const maxConnections = Number.isFinite(dbPoolMax) && dbPoolMax > 0 ? dbPoolMax : 5;

  return new Pool({
    connectionString: postgresUrl,
    max: maxConnections,
    idleTimeoutMillis: idleTimeoutMs,
    connectionTimeoutMillis: connectionTimeoutMs,
    ssl: shouldUseSsl(postgresUrl) ? { rejectUnauthorized: false } : false,
  });
}

function shouldUseSsl(connectionString) {
  if (!connectionString) {
    return false;
  }

  try {
    const parsed = new URL(connectionString);
    const sslMode = String(parsed.searchParams.get('sslmode') || '').toLowerCase();
    if (sslMode === 'disable') {
      return false;
    }

    if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'allow' || sslMode === 'verify-ca' || sslMode === 'verify-full') {
      return true;
    }

    const hostname = String(parsed.hostname || '').toLowerCase();
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]';

    if (isLocalHost) {
      return false;
    }

    return parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:';
  } catch (_error) {
    return true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function collectErrorCodes(error, target = new Set(), visited = new Set()) {
  if (!error || typeof error !== 'object') {
    return target;
  }

  if (visited.has(error)) {
    return target;
  }
  visited.add(error);

  if (typeof error.code === 'string') {
    target.add(error.code);
  }

  if (Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      collectErrorCodes(nestedError, target, visited);
    }
  }

  if (error.cause) {
    collectErrorCodes(error.cause, target, visited);
  }

  if (error.sourceError) {
    collectErrorCodes(error.sourceError, target, visited);
  }

  return target;
}

function isTransientConnectionError(error) {
  const retryableCodes = new Set([
    'ETIMEDOUT',
    'ENETUNREACH',
    'ECONNRESET',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ENOTFOUND',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_CONNECT_ERROR',
  ]);

  const codes = collectErrorCodes(error);
  for (const code of codes) {
    if (retryableCodes.has(code)) {
      return true;
    }
  }

  return false;
}

async function executeQuery(sql, params = []) {
  const queryText = replaceQuestionPlaceholders(sql);
  const result = await pool.query(queryText, params);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const rowCount = Number.isFinite(Number(result.rowCount)) ? Number(result.rowCount) : rows.length;

  return {
    rows,
    rowCount,
  };
}

async function initializeClient() {
  if (pool) {
    return;
  }

  if (!postgresUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required');
  }

  const maxAttempts = Number.isFinite(dbConnectRetries) && dbConnectRetries > 0 ? dbConnectRetries : 6;
  const baseDelayMs =
    Number.isFinite(dbConnectRetryDelayMs) && dbConnectRetryDelayMs > 0 ? dbConnectRetryDelayMs : 1500;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidatePool = createPool();

    try {
      await candidatePool.query('SELECT 1');
      pool = candidatePool;
      return;
    } catch (error) {
      lastError = error;
      await candidatePool.end().catch(() => {});

      const canRetry = isTransientConnectionError(error) && attempt < maxAttempts;
      if (!canRetry) {
        throw error;
      }

      const retryDelayMs = baseDelayMs * attempt;
      // eslint-disable-next-line no-console
      console.warn(
        `Postgres connection attempt ${attempt}/${maxAttempts} failed; retrying in ${retryDelayMs}ms`,
        collectErrorCodes(error)
      );
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

async function run(sql, params = []) {
  ensureInitialized();
  const result = await executeQuery(sql, params);
  const firstRow = result.rows[0] || null;

  return {
    lastID: firstRow && Number.isFinite(Number(firstRow.id)) ? Number(firstRow.id) : null,
    changes: Number(result.rowCount || 0),
    rows: result.rows,
  };
}

async function get(sql, params = []) {
  ensureInitialized();
  const result = await executeQuery(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  ensureInitialized();
  const result = await executeQuery(sql, params);
  return result.rows;
}

module.exports = {
  initializeClient,
  run,
  get,
  all,
};
