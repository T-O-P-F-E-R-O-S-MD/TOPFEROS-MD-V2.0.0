"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pino = require("pino");

const connection = require("./src/connection");
const sessionManager = require("./src/sessionManager");
const loadCommands = require("./commands");

const logger = pino({
  level: process.env.LOG_LEVEL || "info"
});

/*
|--------------------------------------------------------------------------
| WEB PANEL
|--------------------------------------------------------------------------
*/

require("./panel/server");

/*
|--------------------------------------------------------------------------
| RESTORE STORED SESSIONS
|--------------------------------------------------------------------------
*/

async function restoreSessions() {
  const sessionsDir =
    sessionManager.ensureSessionsDirectory();

  const entries = await fs.promises.readdir(
    sessionsDir,
    { withFileTypes: true }
  );

  const sessionIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^\d{8,15}$/.test(name));

  if (sessionIds.length === 0) {
    logger.info("ℹ️ No stored WhatsApp sessions to restore.");
    return;
  }

  logger.info(
    `🔄 Restoring ${sessionIds.length} stored WhatsApp session(s)...`
  );

  for (const sessionId of sessionIds) {
    const sessionPath = path.join(
      sessionsDir,
      sessionId
    );

    const credentialsPath = path.join(
      sessionPath,
      "creds.json"
    );

    if (!fs.existsSync(credentialsPath)) {
      logger.warn(
        `[${sessionId}] ⚠️ Session skipped: creds.json not found.`
      );
      continue;
    }

    try {
      await connection.connectSession(sessionId);

      logger.info(
        `[${sessionId}] 🟢 Stored WhatsApp session restoration requested.`
      );
    } catch (error) {
      logger.error(
        {
          error:
            error?.stack ||
            error?.message ||
            String(error)
        },
        `[${sessionId}] ❌ Failed to restore WhatsApp session.`
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info(
    `🛑 ${signal} received. Shutting down TOPFEROS MD V2.0.0...`
  );

  try {
    await connection.disconnectAllSessions();

    logger.info(
      "🦁 TOPFEROS MD V2.0.0 shutdown completed."
    );
  } catch (error) {
    logger.error(
      {
        error:
          error?.stack ||
          error?.message ||
          String(error)
      },
      "❌ Shutdown error."
    );
  } finally {
    process.exit(0);
  }
}

process.once("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  shutdown("SIGINT");
});

/*
|--------------------------------------------------------------------------
| APPLICATION STARTUP
|--------------------------------------------------------------------------
*/

async function startApplication() {
  try {
    logger.info(
      "🚀 Starting TOPFEROS MD V2.0.0..."
    );

    if (typeof loadCommands !== "function") {
      throw new TypeError(
        'commands/index.js must export a loadCommands function.'
      );
    }

    const loadedCommands = loadCommands();

    logger.info(
      `📚 Command loader completed. Result: ${loadedCommands}`
    );

    await restoreSessions();

    logger.info(
      "🦁 TOPFEROS MD V2.0.0 startup completed."
    );
  } catch (error) {
    logger.error(
      {
        error:
          error?.stack ||
          error?.message ||
          String(error)
      },
      "❌ TOPFEROS MD V2.0.0 startup failed."
    );

    process.exitCode = 1;
  }
}

startApplication();