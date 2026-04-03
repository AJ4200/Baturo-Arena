module.exports = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  postgresUrl: process.env.DATABASE_URL,
  dbPoolMax: Number(process.env.DB_POOL_MAX || 5),
  dbConnectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 30000),
  dbIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  dbConnectRetries: Number(process.env.DB_CONNECT_RETRIES || 6),
  dbConnectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 1500),
  googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  authSessionTtlHours: Number(process.env.AUTH_SESSION_TTL_HOURS || 168),
};
