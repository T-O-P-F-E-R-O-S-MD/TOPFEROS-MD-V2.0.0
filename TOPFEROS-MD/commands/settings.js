"use strict";

const fs = require("fs");
const path = require("path");

const config = require("../src/config");

const sessionManager =
  require("../src/sessionManager");

const settingPanel =
  require("../src/settingPanel");

// ============================================================
// 🦁 TOPFEROS MD V2.0.0
// SETTINGS COMMAND
// ============================================================

const LOGO_PATH = path.resolve(
  __dirname,
  "..",
  "assets",
  "logo.png"
);

const DEFAULT_PANEL_URL =
  "https://topferos-md-v2-0-0.onrender.com/setting";

// ============================================================
// HELPERS
// ============================================================

function normalizeSessionId(value) {
  return String(value || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function display(
  value,
  fallback = "Not Set"
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}

function onOff(value) {
  if (value === true) {
    return "✅ ON";
  }

  if (value === false) {
    return "❌ OFF";
  }

  return "⚪ N/A";
}

// ============================================================
// BUILD SETTINGS OVERVIEW
// Li vrè paramèt sesyon an.
// ============================================================

function buildSettingsOverview(
  panelData,
  sessionId
) {
  const settings =
    panelData?.settings || {};

  const bot =
    settings.bot || {};

  const automation =
    settings.automation || {};

  const group =
    settings.groupAutomation || {};

  const logoExists =
    fs.existsSync(LOGO_PATH);

  const lines = [
    "╭━━━━━━━━━━━❀━━━━━━━━━━━╮",
    "       🦁 *BOT SETTINGS* 🐑",
    "      🐑 *TOPFEROS MD* 🦁",
    "╰━━━━━━━━━━━❀━━━━━━━━━━━╯",

    "",

    "✨ *USER INFO* ✨",

    "",

    `🎀 *Name*   » ${
      display(
        bot.name,
        config.bot?.name || "TOPFEROS MD"
      )
    }`,

    `📱 *Number* » ${
      display(
        bot.ownerNumber,
        sessionId
      )
    }`,

    `🎂 *Age*    » ${
      display(bot.age, "Not Set")
    }`,

    `📍 *From*   » ${
      display(bot.location, "Not Set")
    }`,

    `🔤 *Prefix* » ${
      display(bot.prefix, ".")
    }`,

    `🌐 *Mode*   » ${
      display(bot.mode, "Public")
    }`,

    "",

    "🛡️ *PROTECTION* 🛡️",

    "",

    `📞 Anti Call       » ${
      onOff(automation.antiCall)
    }`,

    `🧭 Anti Bugs       » ${
      onOff(automation.antiBug)
    }`,

    `🛸 Anti Bot        » ${
      onOff(automation.antiBotFilter)
    }`,

    `⚽ Anti Bot Action » ${
      display(
        automation.antiBotAction,
        "Delete"
      )
    }`,

    `🗑️ Anti Delete     » ${
      onOff(automation.antiDelete)
    }`,

    `📤 Delete Mode     » ${
      display(
        automation.antiDeleteMode,
        "Not Set"
      )
    }`,

    `⛔ Block List      » ${
      Array.isArray(
        automation.antiBlockNumbers
      ) &&
      automation.antiBlockNumbers.length > 0
        ? "✅ Set"
        : "❌ Empty"
    }`,

    "",

    "📊 *STATUS & AUTOMATION* 📊",

    "",

    `🟢 Always Online     » ${
      onOff(automation.alwaysOnline)
    }`,

    `⌨️ Auto Typing       » ${
      onOff(automation.fakeTyping)
    }`,

    `🎙️ Auto Recording    » ${
      onOff(automation.fakeRecording)
    }`,

    `👁️ Status Seen       » ${
      onOff(automation.autoStatusSeen)
    }`,

    `💬 Status Reply      » ${
      onOff(automation.autoStatusReply)
    }`,

    `❤️ Status React      » ${
      onOff(automation.autoStatusReact)
    }`,

    `👥 Group Automation  » ${
      onOff(group.enabled)
    }`,

    `🖼️ Bot Logo » ${
      logoExists
        ? "✅ Set"
        : "❌ Missing"
    }`,

    "✨ *Owner Only Access — Personal Chat* ✨",

    "",

    "🦁 *By TOPFEROS MD TECH* 🐑"
  ];

  return lines.join("\n");
}

// ============================================================
// SEND FIRST MESSAGE WITH BOT LOGO
// ============================================================

async function sendOverviewWithLogo(
  ctx,
  caption
) {
  if (fs.existsSync(LOGO_PATH)) {
    try {
      await ctx.sock.sendMessage(
        ctx.jid,
        {
          image: fs.readFileSync(
            LOGO_PATH
          ),

          caption
        }
      );

      return;
    } catch (error) {
      console.error(
        "[SETTINGS] Logo send failed:",
        error.message
      );
    }
  }

  // Si logo a pa disponib, voye tèks la kanmenm.
  await ctx.send(caption);
}

// ============================================================
// SETTINGS COMMAND
// ============================================================

async function settingsCommand(ctx) {
  try {
    if (
      !ctx ||
      !ctx.sock ||
      !ctx.message ||
      !ctx.jid
    ) {
      throw new Error(
        "Command context is incomplete."
      );
    }

    // --------------------------------------------------------
    // PRIVATE CHAT ONLY
    // --------------------------------------------------------

    if (ctx.isGroup) {
      return ctx.send(
        "⚠️ Tanpri itilize .settings nan chat prive ak bot la."
      );
    }

    // --------------------------------------------------------
    // OWNER ACCESS
    // --------------------------------------------------------

    if (!ctx.isOwner) {
      return ctx.send(
        "⛔ Kòmand sa a rezève pou owner bot la."
      );
    }

    // --------------------------------------------------------
    // ACTIVE SESSION
    // --------------------------------------------------------

    const sessionId =
      normalizeSessionId(
        ctx.sessionId ||
        ctx.sock?.user?.id
      );

    if (
      !sessionId ||
      !sessionManager.getSession(sessionId)
    ) {
      return ctx.send(
        "❌ Session bot la pa disponib."
      );
    }

    if (
      !sessionManager.isConnected(
        sessionId
      )
    ) {
      return ctx.send(
        "❌ Bot la pa konekte. Konekte sesyon an anvan ou mande settings."
      );
    }

    // --------------------------------------------------------
    // READ CURRENT PANEL SETTINGS
    // --------------------------------------------------------

    const panelData =
      settingPanel.getPanelData(
        sessionId
      );

    // --------------------------------------------------------
    // GENERATE / RETRIEVE ACCESS CODE
    // --------------------------------------------------------

    const code =
      settingPanel.generatePanelAccessCode(
        sessionId
      );

    // --------------------------------------------------------
    // SETTINGS PORTAL
    // --------------------------------------------------------

    const panelUrl =
      process.env.PANEL_URL ||
      process.env.SETTINGS_PANEL_URL ||
      config.panels?.settingsUrl ||
      DEFAULT_PANEL_URL;

    // ========================================================
    // MESSAGE 1: SETTINGS OVERVIEW + LOGO
    // ========================================================

    const overview =
      buildSettingsOverview(
        panelData,
        sessionId
      );

    await sendOverviewWithLogo(
      ctx,
      overview
    );

    // ========================================================
    // MESSAGE 2: LOGIN INFORMATION
    // ========================================================

    await ctx.send([
      "🦁✧･ﾟ: *✧･ﾟ:* 🔐 *TOPFEROS MD LOGIN* 🔐 *:･ﾟ✧*:･ﾟ✧🐑",

      "",

      "🌸 *Owner Number*",

      `╰┈➤ ${sessionId}`,

      "",

      "🌸 *6-Character Settings Code*",

      "╰┈➤",

      "",

      `*${code}*`,

      "",

      "🌐 *Web Settings*",

      `╰┈➤ ${panelUrl}`,

      "",

      "╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╯",

      "✨ *Keep Safe & Don't Share* ✨",

      "",

      "📋 Kòd la voye nan liy apa a pou fasilite kopi.",

      "",

      "🦁 *TECH BY TOPFEROS MD* 🐑"
    ].join("\n"));

    // ========================================================
    // MESSAGE 3: COPYABLE CODE
    // ========================================================

    await ctx.send(
      String(code)
    );

    // ========================================================
    // MESSAGE 4: INSTRUCTIONS
    // ========================================================

    await ctx.send([
      "To change your bot settings, please click the web link in the message above and open the web page.",

      "",

      "Enter the owner number and 6-character settings code shown above. The portal verifies the number, code, and active WhatsApp session before allowing access.",

      "",

      "After submitting settings, the bot will use the updated values when the panel applies them. ✅",

      "",

      "🦁 *TECH BY TOPFEROS MD* 🐑"
    ].join("\n"));

  } catch (error) {
    console.error(
      "[SETTINGS COMMAND]",
      error?.stack || error
    );

    if (ctx?.send) {
      return ctx.send(
        "❌ Gen yon pwoblèm pandan ouvèti Settings Panel la. Verifye si sesyon bot la konekte."
      );
    }
  }
}

module.exports = settingsCommand;