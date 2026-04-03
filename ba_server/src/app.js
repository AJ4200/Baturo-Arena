const express = require("express");
const authRoutes = require("./routes/authRoutes");
const healthRoutes = require("./routes/healthRoutes");
const playerRoutes = require("./routes/playerRoutes");
const roomRoutes = require("./routes/roomRoutes");
const gameRoutes = require("./routes/gameRoutes");
const HttpError = require("./errors/HttpError");
const { corsOrigin } = require("./config/env");

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", corsOrigin);
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/games", gameRoutes);

app.use((req, _res, next) => {
  next(new HttpError(404, "Route not found"));
});

function collectErrorCodes(error, target = new Set(), visited = new Set()) {
  if (!error || typeof error !== "object") {
    return target;
  }

  if (visited.has(error)) {
    return target;
  }
  visited.add(error);

  if (typeof error.code === "string") {
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

function isDatabaseConnectivityError(error) {
  const retryableCodes = new Set([
    "ETIMEDOUT",
    "ENETUNREACH",
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ENOTFOUND",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_CONNECT_ERROR",
  ]);

  const codes = collectErrorCodes(error);
  for (const code of codes) {
    if (retryableCodes.has(code)) {
      return true;
    }
  }

  return false;
}

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || (isDatabaseConnectivityError(error) ? 503 : 500);
  const message =
    statusCode === 503
      ? "Database connection is temporarily unavailable. Please retry."
      : statusCode >= 500
        ? "Internal server error"
        : error.message;

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
});

module.exports = app;
