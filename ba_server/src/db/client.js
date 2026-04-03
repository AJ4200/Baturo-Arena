const { Pool } = require('pg');
const {
  postgresUrl,
  dbPoolMax,
  dbConnectionTimeoutMs,
  dbIdleTimeoutMs,
  dbConnectRetries,
  dbConnectRetryDelayMs,
  dbSslMode,
  dbSslRejectUnauthorized,
} = require('../config/env');

let pool = null;

function normalizeSslMode(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function extractSslModeFromConnectionString(connectionString) {
  try {
    const connectionUrl = new URL(connectionString);
    const sslMode = normalizeSslMode(connectionUrl.searchParams.get('sslmode'));
    if (sslMode) {
      return sslMode;
    }

    const sslFlag = normalizeSslMode(connectionUrl.searchParams.get('ssl'));
    if (['1', 'true', 'yes', 'on', 'require'].includes(sslFlag)) {
      return 'require';
    }

    if (['0', 'false', 'no', 'off', 'disable'].includes(sslFlag)) {
      return 'disable';
    }
  } catch (_error) {
    return '';
  }

  return '';
}

function isLocalConnectionString(connectionString) {
  try {
    const connectionUrl = new URL(connectionString);
    const hostname = connectionUrl.hostname.trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch (_error) {
    return false;
  }
}

function resolveSslOptions() {
  const mode = normalizeSslMode(dbSslMode) || extractSslModeFromConnectionString(postgresUrl);

  if (mode === 'disable') {
    return false;
  }

  if (mode === 'no-verify') {
    return { rejectUnauthorized: false };
  }

  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true };
  }

  if (mode === 'require' || mode === 'prefer') {
    if (typeof dbSslRejectUnauthorized === 'boolean') {
      return { rejectUnauthorized: dbSslRejectUnauthorized };
    }

    return { rejectUnauthorized: false };
  }

  if (isLocalConnectionString(postgresUrl)) {
    return false;
  }

  return {
    rejectUnauthorized: typeof dbSslRejectUnauthorized === 'boolean' ? dbSslRejectUnauthorized : false,
  };
}

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
  return new Pool({
    connectionString: postgresUrl,
    max: Number.isFinite(dbPoolMax) && dbPoolMax > 0 ? dbPoolMax : 5,
    connectionTimeoutMillis:
      Number.isFinite(dbConnectionTimeoutMs) && dbConnectionTimeoutMs > 0 ? dbConnectionTimeoutMs : 30000,
    idleTimeoutMillis: Number.isFinite(dbIdleTimeoutMs) && dbIdleTimeoutMs > 0 ? dbIdleTimeoutMs : 30000,
    keepAlive: true,
    family: 4,
    ssl: resolveSslOptions(),
  });
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
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const rowCount = Number.isFinite(Number(result?.rowCount)) ? Number(result.rowCount) : rows.length;

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
    candidatePool.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Postgres pool error', error);
    });

    try {
      // eslint-disable-next-line no-await-in-loop
      await candidatePool.query('SELECT 1');
      pool = candidatePool;
      return;
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-await-in-loop
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
