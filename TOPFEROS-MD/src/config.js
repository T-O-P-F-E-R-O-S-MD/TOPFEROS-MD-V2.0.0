"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| GLOBAL CONFIGURATION
|--------------------------------------------------------------------------
|
| Central configuration for:
| - Bot information
| - Automation
| - Security
| - Group automation
| - Multi-session
| - Panels
| - Channel
| - AI
| - Media
| - Languages
| - Branding
| - Connection
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function envString(
  name,
  fallback = ""
) {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  const trimmed =
    String(value).trim();

  return trimmed || fallback;
}

function envBoolean(
  name,
  fallback = false
) {
  const value =
    process.env[name];

  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return [
    "true",
    "1",
    "yes",
    "on"
  ].includes(
    String(value)
      .trim()
      .toLowerCase()
  );
}

function envNumber(
  name,
  fallback = 0
) {
  const value =
    Number(
      process.env[name]
    );

  return Number.isFinite(
    value
  )
    ? value
    : fallback;
}

/*
|--------------------------------------------------------------------------
| BOT INFORMATION
|--------------------------------------------------------------------------
*/

const bot = {
  name:
    envString(
      "BOT_NAME",
      "TOPFEROS MD"
    ),

  version:
    envString(
      "BOT_VERSION",
      "2.0.0"
    ),

  
prefix:
  envString(
    "BOT_PREFIX",
    envString("PREFIX", ".")
  ),


  mode:
    envString(
      "BOT_MODE",
      "Public"
    ),

  language:
    envString(
      "BOT_LANGUAGE",
      "English"
    ),

  location:
    envString(
      "BOT_LOCATION",
      "HAÏTI"
    ),

  age:
    envNumber(
      "BOT_AGE",
      14
    ),

  ownerNumber:
    envString(
      "OWNER_NUMBER",
      ""
    ),

  footer:
    envString(
      "BOT_FOOTER",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ),

  logo:
    envString(
      "BOT_LOGO",
      "assets/logo.png"
    )
};

/*
|--------------------------------------------------------------------------
| SYSTEM AUTOMATION
|--------------------------------------------------------------------------
*/

const automation = {
  /*
   * Always keep the bot online.
   * No periodic WhatsApp spam.
   */

  alwaysOnline:
    envBoolean(
      "ALWAYS_ONLINE",
      true
    ),

  /*
   * Fake typing indicator.
   */

  fakeTyping:
    envBoolean(
      "FAKE_TYPING",
      false
    ),

  /*
   * Fake recording indicator.
   */

  fakeRecording:
    envBoolean(
      "FAKE_RECORDING",
      false
    ),

  /*
   * WhatsApp Status automation.
   */

  autoStatusSeen:
    envBoolean(
      "AUTO_STATUS_SEEN",
      true
    ),

  autoStatusReply:
    envBoolean(
      "AUTO_STATUS_REPLY",
      true
    ),

  autoStatusReact:
    envBoolean(
      "AUTO_STATUS_REACT",
      true
    ),

  /*
   * Anti-delete.
   */

  antiDelete:
    envBoolean(
      "ANTI_DELETE",
      true
    ),

  antiDeleteMode:
    envString(
      "ANTI_DELETE_MODE",
      "private"
    ),

  /*
   * Anti-call.
   */

  antiCall:
    envBoolean(
      "ANTI_CALL",
      false
    ),

  /*
   * Anti-bug protection.
   */

  antiBug:
    envBoolean(
      "ANTI_BUG",
      false
    ),

  /*
   * Anti-bot filter.
   */

  antiBotFilter:
    envBoolean(
      "ANTI_BOT_FILTER",
      false
    ),

  antiBotAction:
    envString(
      "ANTI_BOT_ACTION",
      "Delete"
    )
};

/*
|--------------------------------------------------------------------------
| GROUP AUTOMATION
|--------------------------------------------------------------------------
*/

const groupAutomation = {
  enabled:
    envBoolean(
      "GROUP_AUTOMATION_ENABLED",
      false
    ),

  groupGid:
    envString(
      "GROUP_GID",
      ""
    ),

  timezone:
    envString(
      "GROUP_TIMEZONE",
      "Atlantic/Port-au-Prince"
    ),

  closeTime:
    envString(
      "GROUP_CLOSE_TIME",
      "15:00"
    ),

  openTime:
    envString(
      "GROUP_OPEN_TIME",
      "06:00"
    ),

  principles:
    envString(
      "GROUP_PRINCIPLES",
      ""
    ),

  /*
   * 1st warning
   * 2nd warning
   * 3rd violation = remove
   */

  warningLimit:
    3
};

/*
|--------------------------------------------------------------------------
| SECURITY
|--------------------------------------------------------------------------
*/

const security = {
  /*
   * Numbers that must be blocked automatically
   * when they call the bot.
   */

  antiBlockNumbers: [],

  /*
   * Maximum group violations before removal.
   */

  groupWarningLimit:
    3
};

/*
|--------------------------------------------------------------------------
| MULTI-SESSION
|--------------------------------------------------------------------------
*/

const session = {
  /*
   * Baileys authentication directory.
   */
    
  directory:
  envString(
    "SESSION_DIR",
    envString("SESSIONS_DIR", "sessions")
  ),

  /*
   * Never delete credentials when
   * the user disconnects from Settings.
   */

  keepCredentials:
    true,

  /*
   * Every connected user gets an
   * isolated session.
   */

  isolated:
    true
};

/*
|--------------------------------------------------------------------------
| PANELS
|--------------------------------------------------------------------------
*/

const panels = {
  parrainUrl:
    envString(
      "PARRAIN_PANEL_URL",
      ""
    ),

  settingsUrl:
    envString(
      "SETTINGS_PANEL_URL",
      ""
    )
};

/*
|--------------------------------------------------------------------------
| WHATSAPP CHANNEL
|--------------------------------------------------------------------------
*/

const channel = {
  name:
    "TOPFEROS MD",

  url:
    "https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91l"
};

/*
|--------------------------------------------------------------------------
| AI
|--------------------------------------------------------------------------
*/

const ai = {
  apiUrl:
    envString(
      "AI_API_URL",
      ""
    ),

  apiKey:
    envString(
      "AI_API_KEY",
      ""
    ),

  model:
    envString(
      "GEMINI_MODEL",
      envString(
        "AI_MODEL",
        "gemini-3.8-flash"
      )
    ),

  timeout:
    envNumber(
      "AI_TIMEOUT_MS",
      15000
    )
};

/*
|--------------------------------------------------------------------------
| MEDIA
|--------------------------------------------------------------------------
*/

const media = {
  musicCommand:
    ".play song",

  videoCommand:
    ".play v",

  videoAlias:
    ".video"
};

/*
|--------------------------------------------------------------------------
| LANGUAGE SYSTEM
|--------------------------------------------------------------------------
|
| English is the official default language.
|
|--------------------------------------------------------------------------
*/

const languages = {
  default:
    "English",

  available: [
    "English",
    "French",
    "Spanish",
    "Dominican Spanish",
    "Portuguese",
    "Chinese",
    "Haitian Creole"
  ]
};

/*
|--------------------------------------------------------------------------
| BRANDING
|--------------------------------------------------------------------------
*/

const branding = {
  header:
    "🦁 TOPFEROS MD V2.0.0 🐑",

  footer:
    "🦁 TECH BY TOPFEROS MD 🐑"
};

/*
|--------------------------------------------------------------------------
| CONNECTION
|--------------------------------------------------------------------------
*/

const connection = {
  reconnectDelay:
    envNumber(
      "RECONNECT_DELAY_MS",
      5000
    ),

  /*
   * 0 = unlimited reconnect attempts.
   */

  maxReconnectAttempts:
    envNumber(
      "MAX_RECONNECT_ATTEMPTS",
      0
    ),

  /*
   * QR is handled by the application/panel.
   */

  printQRInTerminal:
    false,

  /*
   * Avoid unnecessary full-history synchronization.
   */

  syncFullHistory:
    false
};

/*
|--------------------------------------------------------------------------
| COMPLETE CONFIGURATION
|--------------------------------------------------------------------------
*/

const config = {
  bot,

  automation,

  groupAutomation,

  security,

  session,

  panels,

  channel,

  ai,

  media,

  languages,

  branding,

  connection
};

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = config;