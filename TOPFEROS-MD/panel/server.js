"use strict";

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const pino = require("pino");

const config = require("../src/config");
const settingPanel = require("../src/settingPanel");
const sessionManager = require("../src/sessionManager");
const connection = require("../src/connection");
const language = require("../src/language");
const parrainService = require("../services/parrain");

const app = express();

const logger = pino({
  level: process.env.LOG_LEVEL || "info"
});

// ============================================================
// 🦁 TOPFEROS MD V2.0.0
// PANEL SERVER
// ============================================================

const PORT =
  Number(process.env.PANEL_PORT) ||
  Number(process.env.PORT) ||
  3000;

const PANEL_PUBLIC_DIR = path.resolve(
  __dirname,
  "public"
);

const ASSETS_DIR = path.resolve(
  __dirname,
  "..",
  "assets"
);

const BACKGROUND_FILE = path.resolve(
  __dirname,
  "background.png"
);

app.get("/panel-background.png", (req, res) => {
  res.sendFile(BACKGROUND_FILE);
});

const LOGO_FILE = path.resolve(
  ASSETS_DIR,
  "logo.png"
);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

// ============================================================
// STATIC FILES
// ============================================================

if (fs.existsSync(PANEL_PUBLIC_DIR)) {
  app.use(
    express.static(PANEL_PUBLIC_DIR)
  );
}

if (fs.existsSync(ASSETS_DIR)) {
  app.use(
    "/assets",
    express.static(ASSETS_DIR)
  );
}

// ============================================================
// HELPERS
// ============================================================

function cleanNumber(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

function cleanSessionId(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

function sendError(
  res,
  status,
  message
) {
  return res.status(status).json({
    success: false,
    message
  });
}

function getSessionId(req) {
  return cleanSessionId(
    req.body?.sessionId ||
    req.query?.sessionId ||
    req.query?.session ||
    req.params?.sessionId
  );
}

function getSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  return sessionManager.getSession(
    sessionId
  );
}

function getSessionOrFail(
  res,
  sessionId
) {
  if (!sessionId) {
    sendError(
      res,
      400,
      "Session ID is required."
    );

    return null;
  }

  const session =
    getSession(sessionId);

  if (!session) {
    sendError(
      res,
      404,
      "Session not found."
    );

    return null;
  }

  return session;
}

function getActiveSessionCount() {
  if (
    typeof sessionManager.getActiveSessions ===
    "function"
  ) {
    const sessions =
      sessionManager.getActiveSessions();

    if (Array.isArray(sessions)) {
      return sessions.length;
    }

    if (
      sessions &&
      typeof sessions.size === "number"
    ) {
      return sessions.size;
    }

    if (
      sessions &&
      typeof sessions === "object"
    ) {
      return Object.keys(sessions).length;
    }
  }

  if (
    typeof sessionManager.getActiveSessionCount ===
    "function"
  ) {
    return Number(
      sessionManager.getActiveSessionCount()
    ) || 0;
  }

  return 0;
}

// ============================================================
// HOME
// ============================================================

app.get(
  "/",
  (req, res) => {
    const indexPath =
      path.join(
        PANEL_PUBLIC_DIR,
        "index.html"
      );

    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >
          <title>TOPFEROS MD V2.0.0</title>
        </head>

        <body>
          <h1>🦁 TOPFEROS MD V2.0.0 🐑</h1>
          <p>🟢 ONLINE &amp; READY</p>
          <p>🦁 TECH BY TOPFEROS MD 🐑</p>
        </body>
      </html>
    `);
  }
);

// ============================================================
// SETTINGS PAGE
// ============================================================

app.get(
  "/setting",
  (req, res) => {
    const settingPath =
      path.join(
        PANEL_PUBLIC_DIR,
        "settings.html"
      );

    if (!fs.existsSync(settingPath)) {
      return sendError(
        res,
        404,
        "Settings page not found."
      );
    }

    return res.sendFile(settingPath);
  }
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/health",
  (req, res) => {
    return res.status(200).json({
      success: true,
      status: "ok",
      bot: "TOPFEROS MD",
      version: "2.0.0",
      uptime: process.uptime(),
      sessions: getActiveSessionCount()
    });
  }
);

// ============================================================
// PANEL INFORMATION
// ============================================================

app.get(
  "/api/panel",
  (req, res) => {
    return res.json({
      success: true,

      panel: {
        name:
          settingPanel.PANEL_NAME ||
          "🦁 TOPFEROS MD PANEL 🐑",

        version:
          settingPanel.BOT_VERSION ||
          "2.0.0"
      },

      bot: {
        name:
          config.bot?.name ||
          "TOPFEROS MD",

        version:
          config.bot?.version ||
          "2.0.0",

        prefix:
          config.bot?.prefix ||
          ".",

        mode:
          config.bot?.mode ||
          "Public",

        location:
          config.bot?.location ||
          "HAÏTI",

        language:
          config.bot?.language ||
          "English",

        footer:
          config.bot?.footer ||
          "🦁 TECH BY TOPFEROS MD 🐑"
      },

      assets: {
        logo: "/assets/logo.png",
        background:
          "/panel/background.png"
      },

      languages:
        language.getAvailableLanguages()
    });
  }
);

// ============================================================
// LANGUAGES
// ============================================================

app.get(
  "/api/languages",
  (req, res) => {
    return res.json({
      success: true,

      languages:
        language.getAvailableLanguages(),

      default:
        language.getDefaultLanguage()
    });
  }
);

// ============================================================
// SET LANGUAGE
// ============================================================

app.post(
  "/api/language",
  (req, res) => {
    try {
      const selected =
        language.resolveLanguage(
          req.body?.language
        );

      const sessionId =
        cleanSessionId(
          req.body?.sessionId
        );

      if (sessionId) {
        const session =
          getSession(sessionId);

        if (!session) {
          return sendError(
            res,
            404,
            "Session not found."
          );
        }

        if (
          typeof settingPanel.setPanelLanguage ===
          "function"
        ) {
          settingPanel.setPanelLanguage(
            sessionId,
            selected
          );
        }
      }

      return res.json({
        success: true,
        language: selected
      });

    } catch (error) {
      logger.error(
        error,
        "❌ LANGUAGE ERROR"
      );

      return sendError(
        res,
        500,
        error.message ||
          "Unable to set language."
      );
    }
  }
);


 // ============================================================
 // TRANSLATION
 // ============================================================

app.post(
  "/api/translate",
  (req, res) => {
    try {
      const selected =
        language.resolveLanguage(
          req.body?.language
        );

      if (!selected) {
        return sendError(
          res,
          400,
          "Unsupported language."
        );
      }

      const key =
        String(
          req.body?.key || ""
        ).trim();

      if (key) {
        const translated =
          language.getText(
            key,
            selected,
            key
          );

        return res.json({
          success: true,
          language: selected,
          key,
          text: translated
        });
      }

      const texts =
        Array.isArray(
          req.body?.texts
        )
          ? req.body.texts
          : [];

      const translations =
        texts.map((item) => {
          const original =
            String(item || "");

          return language.getText(
            original,
            selected,
            original
          );
        });

      return res.json({
        success: true,
        language: selected,
        translations
      });
    } catch (error) {
      logger.error(
        error,
        "❌ TRANSLATION ERROR"
      );

      return sendError(
        res,
        500,
        "Translation failed."
      );
    }
  }
);


// ============================================================
// VERIFY SETTINGS SESSION
// ============================================================

app.post(
  "/api/verify",
  async (req, res) => {
    try {
      const number = cleanNumber(req.body?.number);
      const code = String(req.body?.code || "")
        .trim()
        .toUpperCase();

      let sessionId = cleanSessionId(req.body?.sessionId);

      if (!number) {
        return sendError(res, 400, "Phone number is required.");
      }

      if (!/^[A-Z0-9]{6}$/.test(code)) {
        return sendError(res, 400, "Enter the 6-character settings code.");
      }

      if (!sessionId) {
        sessionId = sessionManager.getSessionId(number);
      }

      const session = getSession(sessionId);

      if (!session) {
        return sendError(res, 404, "No session found for this number.");
      }

      const actualNumber = cleanNumber(session.number || sessionId);

      if (actualNumber !== number) {
        return sendError(res, 401, "The phone number does not match this session.");
      }

if (
  typeof settingPanel.verifyPanelAccessCode !== "function"
) {
  return sendError(
    res,
    500,
    "Settings access-code verification is unavailable."
  );
}

if (
  !settingPanel.verifyPanelAccessCode(
    sessionId,
    code
  )
) {
  return sendError(
    res,
    401,
    "Invalid or inactive settings code."
  );
}

const sessionVerification = await Promise.resolve(
  settingPanel.verifySession(sessionId)
);

if (!sessionVerification?.success) {
  return sendError(
    res,
    401,
    sessionVerification?.message ||
      "Settings session verification failed."
  );
}

const panelData = settingPanel.getPanelData(sessionId);

return res.json({
  success: true,
  sessionId,
  settings: panelData?.settings || {},
  bot: panelData?.bot || panelData?.settings?.bot || {},
  botInformation: panelData?.bot || panelData?.settings?.bot || {},
  connection: panelData?.connection || {
    connected: sessionManager.isConnected(sessionId)
  }
});

// ============================================================
// SESSION STATUS
// ============================================================

app.get(
  "/api/session/:sessionId",
  (req, res) => {
    const sessionId =
      cleanSessionId(
        req.params.sessionId
      );

    if (!sessionId) {
      return sendError(
        res,
        400,
        "Invalid session ID."
      );
    }

    const session =
      getSession(sessionId);

    if (!session) {
      return res.json({
        success: true,
        exists: false,
        session: null
      });
    }

    return res.json({
      success: true,

      exists: true,

      session: {
        sessionId,

        number:
          session.number ||
          sessionId,

        connected:
          sessionManager.isConnected(
            sessionId
          ),

        manuallyStopped:
          typeof sessionManager.isManuallyStopped ===
          "function"
            ? sessionManager.isManuallyStopped(
                sessionId
              )
            : Boolean(
                session.manuallyStopped
              ),

        welcomeSent:
          Boolean(
            session.welcomeSent
          )
      }
    });
  }
);

// ============================================================
// GET SETTINGS
// ============================================================

app.get(
  "/api/settings",
  (req, res) => {
    try {
      const sessionId =
        getSessionId(req);

      if (!sessionId) {
        return sendError(
          res,
          400,
          "Session ID is required."
        );
      }

      if (
        !getSessionOrFail(
          res,
          sessionId
        )
      ) {
        return;
      }

      if (
        typeof settingPanel.getPanelData !==
        "function"
      ) {
        return sendError(
          res,
          500,
          "Settings panel service is unavailable."
        );
      }

      const data =
        settingPanel.getPanelData(
          sessionId
        );

      return res.json(data);

    } catch (error) {
      logger.error(
        error,
        "❌ GET SETTINGS ERROR"
      );

      return sendError(
        res,
        500,
        error.message ||
          "Unable to load settings."
      );
    }
  }
);

// ============================================================
// SAVE SETTINGS
// ============================================================

app.post(
  "/api/settings",
  (req, res) => {
    try {
      const sessionId = cleanSessionId(req.body?.sessionId);

      if (!sessionId) {
        return sendError(res, 400, "Session ID is required.");
      }

      if (!getSessionOrFail(res, sessionId)) {
        return;
      }

      if (typeof settingPanel.saveSettings !== "function") {
        return sendError(res, 500, "Settings save service is unavailable.");
      }

      const result = settingPanel.saveSettings(sessionId, {
        bot: req.body?.bot || {},
        settings: req.body?.settings || {}
      });

      return res.json(result);
    } catch (error) {
      logger.error(error, "❌ SAVE SETTINGS ERROR");
      return sendError(res, 400, error.message || "Unable to save settings.");
    }
  }
);

// ============================================================
// DISCONNECT
// ============================================================

async function handleDisconnect(
  req,
  res,
  sessionId
) {
  try {
    const cleanId =
      cleanSessionId(sessionId);

    if (!cleanId) {
      return sendError(
        res,
        400,
        "Invalid session ID."
      );
    }

    if (
      !getSessionOrFail(
        res,
        cleanId
      )
    ) {
      return;
    }

    if (
      typeof connection.disconnectSession !==
      "function"
    ) {
      return sendError(
        res,
        500,
        "Disconnect is not available."
      );
    }

    await connection.disconnectSession(
      cleanId
    );

    return res.json({
      success: true,
      connected: false,
      credentialsKept: true,
      message:
        "Session disconnected. Credentials were kept."
    });

  } catch (error) {
    logger.error(
      error,
      "❌ DISCONNECT ERROR"
    );

    return sendError(
      res,
      500,
      error.message ||
        "Unable to disconnect session."
    );
  }
}

// Frontend route used by app.js.
app.post(
  "/api/session/disconnect",
  async (req, res) => {
    return handleDisconnect(
      req,
      res,
      req.body?.sessionId
    );
  }
);

// REST-style route.
app.post(
  "/api/session/:sessionId/disconnect",
  async (req, res) => {
    return handleDisconnect(
      req,
      res,
      req.params.sessionId
    );
  }
);

// ============================================================
// RECONNECT
// ============================================================

async function handleReconnect(
  req,
  res,
  sessionId
) {
  try {
    const cleanId =
      cleanSessionId(sessionId);

    if (!cleanId) {
      return sendError(
        res,
        400,
        "Invalid session ID."
      );
    }

    if (
      !getSessionOrFail(
        res,
        cleanId
      )
    ) {
      return;
    }

    if (
      typeof connection.reconnectSession !==
      "function"
    ) {
      return sendError(
        res,
        500,
        "Reconnect is not available."
      );
    }

    await connection.reconnectSession(
      cleanId
    );

    return res.json({
      success: true,

      connected:
        sessionManager.isConnected(
          cleanId
        ),

      message:
        "Session reconnect started."
    });

  } catch (error) {
    logger.error(
      error,
      "❌ RECONNECT ERROR"
    );

    return sendError(
      res,
      500,
      error.message ||
        "Unable to reconnect session."
    );
  }
}

// Frontend route used by app.js.
app.post(
  "/api/session/reconnect",
  async (req, res) => {
    return handleReconnect(
      req,
      res,
      req.body?.sessionId
    );
  }
);

// REST-style route.
app.post(
  "/api/session/:sessionId/reconnect",
  async (req, res) => {
    return handleReconnect(
      req,
      res,
      req.params.sessionId
    );
  }
);

// ============================================================
// LOGO
// ============================================================

app.get(
  "/api/assets/logo",
  (req, res) => {
    if (!fs.existsSync(LOGO_FILE)) {
      return sendError(
        res,
        404,
        "Logo not found."
      );
    }

    return res.sendFile(
      LOGO_FILE
    );
  }
);

// ============================================================
// PANEL BACKGROUND
// ============================================================

app.get(
  "/panel/background.png",
  (req, res) => {
    if (
      !fs.existsSync(
        BACKGROUND_FILE
      )
    ) {
      return sendError(
        res,
        404,
        "Panel background not found."
      );
    }

    return res.sendFile(
      BACKGROUND_FILE
    );
  }
);

// ============================================================
// 🦁 WHATSAPP PAIRING API
// ============================================================

app.post("/api/pair", async (req, res) => {
  try {
    const number = cleanNumber(req.body?.number);

    if (!number || number.length < 8 || number.length > 15) {
      return sendError(
        res,
        400,
        "Antre nimewo WhatsApp la ak kòd peyi a."
      );
    }

    if (typeof connection.pairSession !== "function") {
      return sendError(
        res,
        500,
        "Fonksyon WhatsApp pairing la pa disponib."
      );
    }

    const result = await connection.pairSession(number);

    if (!result?.pairingCode) {
      return sendError(
        res,
        502,
        "WhatsApp pa bay yon kòd pairing. Eseye ankò."
      );
    }

    return res.json({
      success: true,
      sessionId: result.sessionId,
      number,
      pairingCode: result.pairingCode,
      message:
        "Kòd la soti nan WhatsApp. Antre li sou telefòn ou pou konekte."
    });
  } catch (error) {
    logger.error(
      {
        error: error?.message || String(error)
      },
      "WHATSAPP PAIRING ERROR"
    );

    return sendError(
      res,
      400,
      error?.message || "Nou pa kapab kreye kòd pairing la."
    );
  }
});

// ============================================================
// 🦁 PARRAIN CODE API
// ============================================================

app.post("/api/parrain", async (req, res) => {
  try {
    const number = cleanNumber(req.body?.number);

    if (
      !number ||
      number.length < 8 ||
      number.length > 15
    ) {
      return sendError(
        res,
        400,
        "Antre yon nimewo telefòn valab ak kòd peyi a."
      );
    }

    if (
      typeof parrainService.generateParrainCode !==
      "function"
    ) {
      return sendError(
        res,
        500,
        "Sèvis kòd parennaj la pa disponib."
      );
    }

    const code =
      await parrainService.generateParrainCode(number);

    const expiresInSeconds =
      Math.floor(
        parrainService.PARRAIN_CODE_TTL / 1000
      );

    return res.json({
      success: true,
      number,
      code,
      expiresInSeconds,
      message: "Kòd parennaj la jenere avèk siksè."
    });
  } catch (error) {
    logger.error(
      {
        error: error?.message || String(error)
      },
      "PARRAIN CODE API ERROR"
    );

    return sendError(
      res,
      500,
      error?.message ||
        "Nou pa kapab jenere kòd parennaj la."
    );
  }
});

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message: "Route not found."
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {
    logger.error(
      error,
      "❌ PANEL SERVER ERROR"
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal panel server error."
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

const server =
  app.listen(
    PORT,
    () => {
      logger.info(
        `🦁 TOPFEROS MD V2.0.0 PANEL running on port ${PORT}`
      );
    }
  );

// ============================================================
// SHUTDOWN
// ============================================================

function shutdown(signal) {
  logger.info(
    `🛑 ${signal} received. Closing panel server...`
  );

  server.close(
    () => {
      logger.info(
        "🟢 Panel server closed."
      );

      process.exit(0);
    }
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "uncaughtException",
  (error) => {
    logger.error(
      error,
      "❌ UNCAUGHT EXCEPTION"
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    logger.error(
      reason,
      "❌ UNHANDLED REJECTION"
    );
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  app,
  server
};