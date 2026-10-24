"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
  initializeSessionStore,
  listSessionIds,
  getSessionFile
} = require("./services/sessionStore");
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
  await initializeSessionStore();

  const sessionIds = (await listSessionIds())
    .filter((id) => /^\d{8,15}$/.test(id));

  if (sessionIds.length === 0) {
    logger.info(
      "ℹ️ No WhatsApp sessions found in Neon."
    );
    return;
  }

  logger.info(
    `🔄 Found ${sessionIds.length} session(s) in Neon.`
  );

  for (const sessionId of sessionIds) {
    try {
      const credentials = await getSessionFile(
        sessionId,
        "creds.json"
      );

      if (!credentials) {
        logger.warn(
          `[${sessionId}] Skipped: no Neon credentials.`
        );
        continue;
      }

      const parsed = JSON.parse(credentials);

      if (parsed?.registered !== true) {
        logger.warn(
          `[${sessionId}] Skipped: pairing incomplete.`
        );
        continue;
      }

      await connection.connectSession(sessionId);

      logger.info(
        `[${sessionId}] 🟢 Neon session restoration requested.`
      );

    } catch (error) {
      logger.error(
        {
          error:
            error?.stack ||
            error?.message ||
            String(error)
        },
        `[${sessionId}] Session restoration failed.`
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

const { getCommands } = require("./src/messageHandler");

logger.info(
  "📋 REGISTERED COMMANDS: " +
  getCommands().map((command) => command.name).join(", ")
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