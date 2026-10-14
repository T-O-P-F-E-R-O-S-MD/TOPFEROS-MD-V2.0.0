"use strict";

const path = require("path");
const fs = require("fs");

const crypto = require("crypto");

const config = require("./config");
const sessionManager = require("./sessionManager");
const language = require("./language");

// ============================================================
// TOPFEROS MD V2.0.0
// SETTINGS PANEL CONTROLLER
// ============================================================

const PANEL_NAME = "TOPFEROS MD PANEL SETTINGS";
const BOT_VERSION = "2.0.0";

const LOGO_PATH = path.resolve(
  __dirname,
  "..",
  "assets",
  "logo.png"
);

const BACKGROUND_PATH = path.resolve(
  __dirname,
  "..",
  "panel",
  "background.png"
);

// ============================================================
// INTERNAL STATE
// ============================================================

const panelSessions = new Map();
const panelAccessCodes = new Map();

const PANEL_ACCESS_CODES_PATH = path.resolve(
  __dirname,
  "..",
  "data",
  "panel-access-codes.json"
);

// ============================================================
// LOAD SAVED ACCESS CODES
// ============================================================

function loadPanelAccessCodes() {
  try {
    if (!fs.existsSync(PANEL_ACCESS_CODES_PATH)) {
      return;
    }

    const saved = JSON.parse(
      fs.readFileSync(
        PANEL_ACCESS_CODES_PATH,
        "utf8"
      )
    );

    if (!saved || typeof saved !== "object") {
      return;
    }

    for (const [sessionId, savedCode] of Object.entries(saved)) {
      const id = normalizeSessionId(sessionId);
      const code = String(savedCode || "").toUpperCase();

      if (id && /^[A-Z0-9]{6}$/.test(code)) {
        panelAccessCodes.set(id, code);
      }
    }
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Unable to load panel access codes:",
      error.message
    );
  }
}

// ============================================================
// SAVE ACCESS CODES
// ============================================================

function savePanelAccessCodes() {
  const directory = path.dirname(
    PANEL_ACCESS_CODES_PATH
  );

  fs.mkdirSync(directory, {
    recursive: true
  });

  const data = Object.fromEntries(
    panelAccessCodes
  );

  const temporaryPath =
    PANEL_ACCESS_CODES_PATH + ".tmp";

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(
    temporaryPath,
    PANEL_ACCESS_CODES_PATH
  );
}

// Chaje kòd ki te deja sove yo.
loadPanelAccessCodes();

// ============================================================
// CREATE ACCESS CODE
// ============================================================

function createPanelAccessCode() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += characters[
      crypto.randomInt(0, characters.length)
    ];
  }

  return code;
}

// ============================================================
// GENERATE ACCESS CODE
// ============================================================

function generatePanelAccessCode(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id || !sessionManager.getSession(id)) {
    throw new Error(
      "WhatsApp session does not exist."
    );
  }

  const existingCode =
    panelAccessCodes.get(id);

  if (existingCode) {
    return existingCode;
  }

  const code = createPanelAccessCode();

  panelAccessCodes.set(id, code);

  savePanelAccessCodes();

  return code;
}

// ============================================================
// VERIFY ACCESS CODE
// ============================================================

function verifyPanelAccessCode(
  sessionId,
  submittedCode
) {
  const id = normalizeSessionId(sessionId);

  if (!id || !sessionManager.getSession(id)) {
    return false;
  }

  const savedCode =
    panelAccessCodes.get(id);

  if (!savedCode) {
    return false;
  }

  return (
    String(submittedCode || "")
      .trim()
      .toUpperCase() === savedCode
  );
}

// ============================================================
// CLEAR ACCESS CODE
// ============================================================

function clearPanelAccessCode(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return false;
  }

  const deleted =
    panelAccessCodes.delete(id);

  if (deleted) {
    savePanelAccessCodes();
  }

  return deleted;
}
// ============================================================
// HELPERS
// ============================================================

function normalizeSessionId(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

function getPanelSession(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return null;
  }

  return panelSessions.get(id) || null;
}

function createPanelSession(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error("A valid session ID is required.");
  }

  const existing = panelSessions.get(id);

  if (existing) {
    return existing;
  }

  const session = {
    sessionId: id,
    language: language.getDefaultLanguage(),
    verified: false,
    connected: false,
    createdAt: Date.now(),
    lastActivityAt: Date.now()
  };

  panelSessions.set(id, session);

  return session;
}

function touchPanelSession(sessionId) {
  const session = getPanelSession(sessionId);

  if (!session) {
    return null;
  }

  session.lastActivityAt = Date.now();

  return session;
}

// ============================================================
// SESSION VERIFICATION
// ============================================================

function verifySession(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return {
      success: false,
      message: "Session ID is required."
    };
  }

  const botSession = sessionManager.getSession(id);

  if (!botSession) {
    return {
      success: false,
      message: "Session not found."
    };
  }

  const panelSession =
    getPanelSession(id) ||
    createPanelSession(id);

  panelSession.verified = true;
  panelSession.connected =
    sessionManager.isConnected(id);

  touchPanelSession(id);

  return {
    success: true,
    sessionId: id,
    connected: panelSession.connected,
    verified: true
  };
}

// ============================================================
// LANGUAGE
// ============================================================

function setPanelLanguage(sessionId, value) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error("Session ID is required.");
  }

  const panelSession =
    getPanelSession(id) ||
    createPanelSession(id);

  const selected =
    language.resolveLanguage(value);

  panelSession.language = selected;
  touchPanelSession(id);

  return {
    success: true,
    sessionId: id,
    language: selected
  };
}

function getPanelLanguage(sessionId) {
  const panelSession = getPanelSession(sessionId);

  if (!panelSession) {
    return language.getDefaultLanguage();
  }

  return panelSession.language;
}

function getLanguages() {
  return language.getAvailableLanguages();
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

function getDefaultSettings() {
  const defaults =
    sessionManager.getSessionAutomation("");

  return {
    bot: {
      name: config.bot.name,
      version: BOT_VERSION,
      location: config.bot.location,
      age: config.bot.age,
      prefix: config.bot.prefix,
      footer: config.bot.footer,
      mode: config.bot.mode,
      ownerNumber: config.bot.ownerNumber || ""
    },

    automation: {
      alwaysOnline:
        config.automation.alwaysOnline,

      fakeTyping:
        config.automation.fakeTyping,

      fakeRecording:
        config.automation.fakeRecording,

      autoStatusSeen:
        config.automation.autoStatusSeen,

      autoStatusReply:
        config.automation.autoStatusReply,

      autoStatusReact:
        config.automation.autoStatusReact,

      antiDelete:
        config.automation.antiDelete,

      antiDeleteMode:
        config.automation.antiDeleteMode,

      antiCall:
        config.automation.antiCall,

      antiBug:
        config.automation.antiBug,

      antiBotFilter:
        config.automation.antiBotFilter,

      antiBotAction:
        config.automation.antiBotAction,

      antiBlockNumbers:
        Array.isArray(config.security.antiBlockNumbers)
          ? [...config.security.antiBlockNumbers]
          : []
    },

    groupAutomation: {
      enabled:
        config.groupAutomation.enabled,

      groupGid:
        config.groupAutomation.groupGid,

      timezone:
        config.groupAutomation.timezone,

      closeTime:
        config.groupAutomation.closeTime,

      openTime:
        config.groupAutomation.openTime,

      principles:
        config.groupAutomation.principles,

      warningLimit:
        config.groupAutomation.warningLimit
    },

    logo: {
      path: LOGO_PATH,
      exists: fs.existsSync(LOGO_PATH)
    },

    background: {
      path: BACKGROUND_PATH,
      exists: fs.existsSync(BACKGROUND_PATH)
    }
  };
}
// ============================================================
// SESSION SETTINGS — TOPFEROS MD V2.0.0
// ============================================================

function getSessionSettings(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error("Session ID is required.");
  }

  const session = sessionManager.getSession(id);

  if (!session) {
    throw new Error("Session not found.");
  }

  const defaults = getDefaultSettings();

  const automation =
    sessionManager.getSessionAutomation(id);

  return {
    bot: {
      ...defaults.bot,
      ...(session.bot || {})
    },

    automation: {
      ...defaults.automation,
      ...(automation || {}),
      ...(session.automation || {})
    },

    groupAutomation: {
      ...defaults.groupAutomation,
      ...(session.groupAutomation || {})
    },

    connection: {
      connected: sessionManager.isConnected(id),
      manuallyStopped:
        sessionManager.isManuallyStopped(id)
    },

    language: getPanelLanguage(id),

    logo: defaults.logo,

    background: defaults.background
  };
}
// ============================================================
// SAVE SETTINGS
// ============================================================

function validateMode(mode) {
  return [
    "Public",
    "Privé",
    "Group"
  ].includes(String(mode || ""));
}

function validateAntiDeleteMode(mode) {
  return [
    "An privé",
    "Nan menm chat la"
  ].includes(String(mode || ""));
}

function validateTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    String(value || "")
  );
}

function cleanNumberList(numbers) {
  if (!Array.isArray(numbers)) {
    return [];
  }

  return [
    ...new Set(
      numbers
        .map((number) =>
          String(number || "")
            .replace(/\D/g, "")
        )
        .filter(Boolean)
    )
  ];
}

function buildAutomationSettings(settings) {
  const source = settings || {};

  const automation = {
    alwaysOnline:
      source.alwaysOnline !== false,

    fakeTyping:
      source.fakeTyping === true,

    fakeRecording:
      source.fakeRecording === true,

    autoStatusSeen:
      source.autoStatusSeen !== false,

    autoStatusReply:
      source.autoStatusReply !== false,

    autoStatusReact:
      source.autoStatusReact !== false,

    antiDelete:
      source.antiDelete !== false,

    antiDeleteMode:
      source.antiDeleteMode ||
      config.automation.antiDeleteMode,

    antiCall:
      source.antiCall === true,

    antiBug:
      source.antiBug === true,

    antiBotFilter:
      source.antiBotFilter === true,

    antiBotAction:
      source.antiBotAction ||
      config.automation.antiBotAction,

    antiBlockNumbers:
      cleanNumberList(
        source.antiBlockNumbers
      )
  };

  if (
    !validateAntiDeleteMode(
      automation.antiDeleteMode
    )
  ) {
    throw new Error(
      "Invalid Anti Delete mode."
    );
  }

  return automation;
}

function buildGroupAutomationSettings(settings) {
  const source = settings || {};

  const result = {
    enabled:
      source.enabled === true,

    groupGid:
      String(source.groupGid || "").trim(),

    timezone:
      String(
        source.timezone ||
        config.groupAutomation.timezone
      ).trim(),

    closeTime:
      String(
        source.closeTime ||
        config.groupAutomation.closeTime
      ).trim(),

    openTime:
      String(
        source.openTime ||
        config.groupAutomation.openTime
      ).trim(),

    principles:
      String(
        source.principles || ""
      ).trim(),

    warningLimit:
      Number(
        source.warningLimit ||
        config.groupAutomation.warningLimit
      )
  };

  if (!validateTime(result.closeTime)) {
    throw new Error(
      "Close time must use HH:MM format."
    );
  }

  if (!validateTime(result.openTime)) {
    throw new Error(
      "Open time must use HH:MM format."
    );
  }

  if (
    !Number.isInteger(result.warningLimit) ||
    result.warningLimit < 1
  ) {
    throw new Error(
      "Warning limit must be a positive number."
    );
  }

  return result;
}

function saveSettings(sessionId, payload) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error("Session ID is required.");
  }

  const verification =
    verifySession(id);

  if (!verification.success) {
    throw new Error(
      verification.message
    );
  }

  const data = payload || {};

  const bot =
    data.bot || {};

  const settings =
    data.settings || {};

  const botName =
    String(
      bot.name ||
      config.bot.name
    ).trim();

  const location =
    String(
      bot.location ||
      config.bot.location
    ).trim();

  const prefix =
    String(
      bot.prefix ||
      config.bot.prefix
    ).trim();

  const footer =
    String(
      bot.footer ||
      config.bot.footer
    ).trim();

  const mode =
    String(
      bot.mode ||
      config.bot.mode
    ).trim();

  const ownerNumber =
    String(
      bot.ownerNumber ||
      ""
    )
      .replace(/\D/g, "");

  const age =
    Number(
      bot.age ||
      config.bot.age
    );

  if (!botName) {
    throw new Error(
      "Bot name cannot be empty."
    );
  }

  if (!prefix) {
    throw new Error(
      "Prefix cannot be empty."
    );
  }

  if (!validateMode(mode)) {
    throw new Error(
      "Invalid bot mode."
    );
  }

  if (
    !Number.isInteger(age) ||
    age < 0
  ) {
    throw new Error(
      "Invalid bot age."
    );
  }

  const automation =
    buildAutomationSettings(
      settings.automation ||
      settings
    );

  const groupAutomation =
    buildGroupAutomationSettings(
      settings.groupAutomation
    );

  sessionManager.updateSession(
    id,
    {
      automation,
      bot: {
        name: botName,
        location,
        prefix,
        footer,
        mode,
        age,
        ownerNumber
      },
      groupAutomation
    }
  );

  touchPanelSession(id);

  return {
    success: true,
    sessionId: id,
    message:
      "Settings saved successfully.",
    settings: getSessionSettings(id)
  };
}

// ============================================================
// CONNECTION CONTROL
// ============================================================

function setConnected(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return false;
  }

  const panelSession =
    getPanelSession(id) ||
    createPanelSession(id);

  panelSession.connected = true;
  touchPanelSession(id);

  return true;
}

function setDisconnected(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return false;
  }

  const panelSession =
    getPanelSession(id) ||
    createPanelSession(id);

  panelSession.connected = false;
  touchPanelSession(id);

  return true;
}

async function disconnect(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error(
      "Session ID is required."
    );
  }

  const session =
    sessionManager.getSession(id);

  if (!session) {
    throw new Error(
      "Session not found."
    );
  }

  const connection =
    require("./connection");

  if (
    typeof connection.disconnectSession !==
    "function"
  ) {
    throw new Error(
      "Connection manager does not support disconnectSession()."
    );
  }

  await connection.disconnectSession(id);

  setDisconnected(id);

  return {
    success: true,
    connected: false,
    credentialsKept: true
  };
}

async function reconnect(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error(
      "Session ID is required."
    );
  }

  const connection =
    require("./connection");

  if (
    typeof connection.reconnectSession ===
    "function"
  ) {
    await connection.reconnectSession(id);
  } else if (
    typeof connection.startSession ===
    "function"
  ) {
    await connection.startSession(id);
  } else {
    throw new Error(
      "Connection manager does not support reconnect."
    );
  }

  setConnected(id);

  return {
    success: true,
    connected: true
  };
}

// ============================================================
// CONNECTION STATUS
// ============================================================

function getConnectionStatus(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return {
      connected: false,
      exists: false
    };
  }

  const session =
    sessionManager.getSession(id);

  return {
    connected:
      sessionManager.isConnected(id),

    exists:
      Boolean(session),

    manuallyStopped:
      sessionManager.isManuallyStopped(id)
  };
}

// ============================================================
// PANEL DATA
// ============================================================

function getPanelData(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    throw new Error(
      "Session ID is required."
    );
  }

  const settings =
    getSessionSettings(id);

  return {
    success: true,

    panel: {
      name: PANEL_NAME,
      version: BOT_VERSION
    },

    sessionId: id,

    language:
      getPanelLanguage(id),

    languages:
      getLanguages(),

    settings,

    connection:
      getConnectionStatus(id),

    assets: {
      logo: {
        path: LOGO_PATH,
        exists:
          fs.existsSync(LOGO_PATH)
      },

      background: {
        path: BACKGROUND_PATH,
        exists:
          fs.existsSync(BACKGROUND_PATH)
      }
    },

    footer:
      config.bot.footer
  };
}

// ============================================================
// PANEL CLEANUP
// ============================================================

function removePanelSession(sessionId) {
  const id = normalizeSessionId(sessionId);

  if (!id) {
    return false;
  }

  return panelSessions.delete(id);
}

function clearPanelSessions() {
  panelSessions.clear();
}

// ============================================================
// SOCKET EVENTS
// ============================================================

function setBotConnected(sessionId) {
  return setConnected(sessionId);
}

function setBotDisconnected(sessionId) {
  return setDisconnected(sessionId);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  PANEL_NAME,
  BOT_VERSION,

  LOGO_PATH,
  BACKGROUND_PATH,

  createPanelSession,
  getPanelSession,
  removePanelSession,
  clearPanelSessions,

  verifySession,

  setPanelLanguage,
  getPanelLanguage,
  getLanguages,

  getDefaultSettings,
  getSessionSettings,
  getPanelData,

  generatePanelAccessCode,
  verifyPanelAccessCode,
  clearPanelAccessCode,

  saveSettings,

  getConnectionStatus,
  disconnect,
  reconnect,

  setConnected,
  setDisconnected,

  setBotConnected,
  setBotDisconnected,

  touchPanelSession
};