const express = require("express");
const healthRoutes = require("./routes/healthRoutes");
const playerRoutes = require("./routes/playerRoutes");
const roomRoutes = require("./routes/roomRoutes");
const HttpError = require("./errors/HttpError");
const { corsOrigin } = require("./config/env");

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", corsOrigin);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use("/api", healthRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/rooms", roomRoutes);

app.use((req, _res, next) => {
  next(new HttpError(404, "Route not found"));
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
});

module.exports = app;
