"use strict";

const fs = require("fs");
const path = require("path");

const config = require("../src/config");
const sessionManager = require("../src/sessionManager");
const settingPanel = require("../src/settingPanel");

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
    .trim()
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function display(value, fallback = "Not Set") {
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
  if (value === true) return "✅ ON";
  if (value === false) return "❌ OFF";
  return "⚪ N/A";
}

function getPanelUrl() {
  return String(
    process.env.PANEL_URL ||
    process.env.SETTINGS_PANEL_URL ||
    config.panels?.settingsUrl ||
    DEFAULT_PANEL_URL
  ).trim().replace(/\/+$/, "");
}

// ============================================================
// SETTINGS OVERVIEW
// ============================================================

function buildSettingsOverview(panelData, sessionId) {
  const settings = panelData?.settings || {};
  const bot = settings.bot || {};
  const automation = settings.automation || {};
  const group = settings.groupAutomation || {};

  const logoExists = fs.existsSync(LOGO_PATH);

  const lines = [
    "╭━━━━━━━━━━━❀━━━━━━━━━━━╮",
    "       🦁 *BOT SETTINGS* 🐑",
    "      🐑 *TOPFEROS MD* 🦁",
    "╰━━━━━━━━━━━❀━━━━━━━━━━━╯",
    "",
    "✨ *USER INFO* ✨",
    "",
    `🎀 *Name*   » ${display(
      bot.name,
      config.bot?.name || "TOPFEROS MD"
    )}`,
    `📱 *Number* » ${display(
      bot.ownerNumber,
      sessionId
    )}`,
    `🎂 *Age*    » ${display(bot.age, "Not Set")}`,
    `📍 *From*   » ${display(bot.location, "Not Set")}`,
    `🔤 *Prefix* » ${display(bot.prefix, ".")}`,
    `🌐 *Mode*   » ${display(bot.mode, "Public")}`,
    "",
    "🛡️ *PROTECTION* 🛡️",
    "",
    `📞 Anti Call       » ${onOff(automation.antiCall)}`,
    `🧭 Anti Bugs       » ${onOff(automation.antiBug)}`,
    `🛸 Anti Bot        » ${onOff(automation.antiBotFilter)}`,
    `⚽ Anti Bot Action » ${display(
      automation.antiBotAction,
      "Delete"
    )}`,
    `🗑️ Anti Delete     » ${onOff(automation.antiDelete)}`,
    `📤 Delete Mode     » ${display(
      automation.antiDeleteMode,
      "Not Set"
    )}`,
    `⛔ Block List      » ${
      Array.isArray(automation.antiBlockNumbers) &&
      automation.antiBlockNumbers.length
        ? "✅ Set"
        : "❌ Empty"
    }`,
    "",
    "📊 *STATUS & AUTOMATION* 📊",
    "",
    `🟢 Always Online    » ${onOff(automation.alwaysOnline)}`,
    `⌨️ Auto Typing      » ${onOff(automation.fakeTyping)}`,
    `🎙️ Auto Recording   » ${onOff(automation.fakeRecording)}`,
    `👁️ Status Seen      » ${onOff(automation.autoStatusSeen)}`,
    `💬 Status Reply     » ${onOff(automation.autoStatusReply)}`,
    `❤️ Status React     » ${onOff(automation.autoStatusReact)}`,
    `👥 Group Automation » ${onOff(group.enabled)}`,
    `🖼️ Bot Logo         » ${logoExists ? "✅ Set" : "❌ Missing"}`,
    "",
    "✨ *Owner Only Access — Personal Chat* ✨",
    "",
    "🦁 *TECH BY TOPFEROS MD* 🐑"
  ];

  return lines.join("\n");
}

// ============================================================
// SEND OVERVIEW
// ============================================================

async function sendOverviewWithLogo(ctx, caption) {
  if (fs.existsSync(LOGO_PATH)) {
    try {
      await ctx.sock.sendMessage(ctx.jid, {
        image: fs.readFileSync(LOGO_PATH),
        caption
      });

      return;
    } catch (error) {
      console.error(
        "[SETTINGS] Logo send failed:",
        error?.stack || error
      );
    }
  }

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
      !ctx.jid ||
      typeof ctx.send !== "function"
    ) {
      throw new Error("Command context is incomplete.");
    }

    // Only allow private chat.
    if (ctx.isGroup) {
      return ctx.send(
        "⚠️ Tanpri itilize .setting nan chat prive ak bot la."
      );
    }

    // The bot session ID must come from the command context.
    // The socket ID is only a fallback.
    const sessionId = normalizeSessionId(
      ctx.sessionId || ctx.sock?.user?.id
    );

    if (!sessionId) {
      throw new Error(
        "Missing bot session ID in command context."
      );
    }

    // Confirm that this exact bot session exists.
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      throw new Error(
        `Bot session not found for sessionId=${sessionId}.`
      );
    }

    if (!sessionManager.isConnected(sessionId)) {
      return ctx.send(
        "❌ Sesyon bot sa a pa konekte. Verifye sesyon an anvan ou itilize .setting."
      );
    }

    // Read this session's settings.
    const panelData = settingPanel.getPanelData(sessionId);

    if (!panelData) {
      throw new Error(
        `getPanelData returned no data for sessionId=${sessionId}.`
      );
    }

    // Generate the access code for this bot session.
    const code = settingPanel.generatePanelAccessCode(sessionId);

    if (
      !code ||
      !/^[A-Z0-9]{6}$/i.test(String(code))
    ) {
      throw new Error(
        `Invalid settings access code returned for sessionId=${sessionId}.`
      );
    }

    const panelUrl = getPanelUrl();

    if (!/^https?:\/\//i.test(panelUrl)) {
      throw new Error(
        `Invalid Settings Panel URL: ${panelUrl}`
      );
    }

    // Message 1: settings overview.
    const overview = buildSettingsOverview(
      panelData,
      sessionId
    );

    await sendOverviewWithLogo(ctx, overview);

    // Message 2: Settings login with native Copy Code button.
    const accessCode = String(code).toUpperCase();

    const loginText = [
      "🦁✧･ﾟ: *✧･ﾟ:* 🔐 *TOPFEROS MD SETTINGS LOGIN* 🔐 *:･ﾟ✧*:･ﾟ✧🐑",
      "",
      "📱 *Bot Session Number*",
      `╰┈➤ ${sessionId}`,
      "",
      "🔐 *6-Character Settings Code*",
      `╰┈➤ ${accessCode}`,
      "",
      "🌐 *Web Settings Panel*",
      `╰┈➤ ${panelUrl}`,
      "",
      "✨ Kòd aksè a dwe rete prive.",
      "",
      "🦁 *TECH BY TOPFEROS MD* 🐑"
    ].join("\n");

    await ctx.sock.sendMessage(ctx.jid, {
      interactiveMessage: {
        body: {
          text: loginText
        },
        footer: {
          text: "🦁 TECH BY TOPFEROS MD 🐑"
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "📋 Copy Settings Code",
                copy_code: accessCode
              })
            }
          ]
        }
      }
    });

    // Message 3: Instructions.
    await ctx.send([
      "To change your bot settings, open the Settings Panel link above.",
      "",
      "Enter the bot session number and the 6-character code.",
      "",
      "The panel must verify that the code is valid and that the matching bot session is active.",
      "",
      "🦁 *TECH BY TOPFEROS MD* 🐑"
    ].join("\n"));

    // Message 4: instructions.
    await ctx.send([
      "To change your bot settings, open the Settings Panel link above.",
      "",
      "Enter the bot session number and the 6-character code.",
      "",
      "The panel must verify that the code is valid and that the matching bot session is active.",
      "",
      "🦁 *TECH BY TOPFEROS MD* 🐑"
    ].join("\n"));

  } catch (error) {
    console.error(
      "[SETTINGS COMMAND]",
      error?.stack || error
    );

    if (ctx?.send) {
      try {
        await ctx.send(
          "❌ Settings Panel la pa kapab ouvri kounye a. Verifye Render Logs yo pou detay erè a."
        );
      } catch (sendError) {
        console.error(
          "[SETTINGS ERROR MESSAGE]",
          sendError?.stack || sendError
        );
      }
    }
  }
}

module.exports = settingsCommand;