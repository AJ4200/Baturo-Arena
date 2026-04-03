const { neon } = require('@neondatabase/serverless');
const {
  postgresUrl,
  dbConnectionTimeoutMs,
  dbConnectRetries,
  dbConnectRetryDelayMs,
} = require('../config/env');

let queryClient = null;

function ensureInitialized() {
  if (!queryClient) {
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

function createQueryClient() {
  const requestTimeoutMs =
    Number.isFinite(dbConnectionTimeoutMs) && dbConnectionTimeoutMs > 0 ? dbConnectionTimeoutMs : 30000;
  const supportsAbortTimeout =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';

  return neon(postgresUrl, {
    fullResults: true,
    fetchConnectionCache: true,
    fetchOptions: supportsAbortTimeout
      ? {
          signal: AbortSignal.timeout(requestTimeoutMs),
        }
      : undefined,
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
  const result = await queryClient.query(queryText, params);

  if (Array.isArray(result)) {
    return {
      rows: result,
      rowCount: result.length,
    };
  }

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const rowCount = Number.isFinite(Number(result?.rowCount)) ? Number(result.rowCount) : rows.length;

  return {
    rows,
    rowCount,
  };
}

async function initializeClient() {
  if (queryClient) {
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
    const candidateClient = createQueryClient();

    try {
      await candidateClient.query('SELECT 1');
      queryClient = candidateClient;
      return;
    } catch (error) {
      lastError = error;

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
