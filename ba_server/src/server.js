const app = require("./app");
const { port } = require("./config/env");
const { initDatabase } = require("./db");

async function startServer() {
  await initDatabase();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`ttt_server api listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
