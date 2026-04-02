module.exports = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  postgresUrl: process.env.POSTGRES_URL || '',
};
