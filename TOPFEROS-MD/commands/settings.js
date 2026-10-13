"use strict";

const config = require("../src/config");
const sessionManager = require("../src/sessionManager");
const settingPanel = require("../src/settingPanel");

// ============================================================
// 🦁 TOPFEROS MD V2.0.0
// SETTINGS COMMAND
// ============================================================

function getSessionId(ctx) {
  const rawId =
    ctx.sessionId ||
    ctx.sock?.user?.id ||
    "";

  return String(rawId)
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function value(value, fallback = "Not configured") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function status(value) {
  return value === true ? "ON" : "OFF";
}

function buildSettingsOverview(data) {
  const settings = data.settings || {};
  const bot = settings.bot || {};
  const automation = settings.automation || {};

  return [
    "╭━━━〔 🦁 TOPFEROS MD 〕━━━╮",
    "┃     ⚙️ SETTINGS PANEL",
    "┃        VERSION 2.0.0",
    "╰━━━━━━━━━━━━━━━━━━━━━━╯",
    "",
    "┏━━〔 USER INFO 〕",
    `┃ OWNER NUMBER: ${value(bot.ownerNumber)}`,
    `┃ BOT NAME: ${value(bot.name)}`,
    `┃ LOCATION: ${value(bot.location)}`,
    `┃ AGE: ${value(bot.age)}`,
    `┃ PREFIX: ${value(bot.prefix)}`,
    `┃ MODE: ${value(bot.mode)}`,
    "┗━━━━━━━━━━━━━━━━━━━━",
    "",
    "┏━━〔 AUTOMATION 〕",
    `┃ Always Online: ${status(automation.alwaysOnline)}`,
    `┃ Fake Typing: ${status(automation.fakeTyping)}`,
    `┃ Fake Recording: ${status(automation.fakeRecording)}`,
    `┃ Auto Status Seen: ${status(automation.autoStatusSeen)}`,
    `┃ Auto Status Reply: ${status(automation.autoStatusReply)}`,
    `┃ Auto Status React: ${status(automation.autoStatusReact)}`,
    "┗━━━━━━━━━━━━━━━━━━━━",
    "",
    "┏━━〔 PROTECTION 〕",
    `┃ Anti Delete: ${status(automation.antiDelete)}`,
    `┃ Anti Call: ${status(automation.antiCall)}`,
    `┃ Anti Bug: ${status(automation.antiBug)}`,
    `┃ Anti Bot Filter: ${status(automation.antiBotFilter)}`,
    `┃ Anti Block Numbers: ${
      Array.isArray(automation.antiBlockNumbers) &&
      automation.antiBlockNumbers.length > 0
        ? "ON"
        : "OFF"
    }`,
    `┃ Anti Delete Mode: ${value(automation.antiDeleteMode)}`,
    `┃ Anti Bot Action: ${value(automation.antiBotAction)}`,
    "┗━━━━━━━━━━━━━━━━━━━━",
    "",
    "┏━━〔 GROUP AUTOMATION 〕",
    `┃ Group Automation: ${status(settings.groupAutomation?.enabled)}`,
    `┃ Group ID: ${value(settings.groupAutomation?.groupGid)}`,
    `┃ Timezone: ${value(settings.groupAutomation?.timezone)}`,
    `┃ Close Time: ${value(settings.groupAutomation?.closeTime)}`,
    `┃ Open Time: ${value(settings.groupAutomation?.openTime)}`,
    `┃ Warning Limit: ${value(settings.groupAutomation?.warningLimit)}`,
    "┗━━━━━━━━━━━━━━━━━━━━",
    "",
    "🦁 TECH BY TOPFEROS MD 🐑"
  ].join("\n");
}

async function settingsCommand(ctx) {
  try {
    if (!ctx || !ctx.sock || !ctx.message) {
      throw new Error("Command context is incomplete.");
    }

    if (ctx.isGroup) {
      return ctx.send(
        "⚠️ Tanpri itilize .settings nan chat prive ak bot la."
      );
    }

    if (!ctx.isOwner) {
      return ctx.send(
        "⛔ Kòmand sa a rezève pou owner bot la."
      );
    }

    const sessionId = getSessionId(ctx);

    if (!sessionId || !sessionManager.getSession(sessionId)) {
      return ctx.send("❌ Session bot la pa disponib.");
    }

    if (!sessionManager.isConnected(sessionId)) {
      return ctx.send("❌ Bot la pa konekte.");
    }

    const panelData = settingPanel.getPanelData(sessionId);
    const code = settingPanel.generatePanelAccessCode(sessionId);

    const panelUrl =
      process.env.PANEL_URL ||
      config.panel?.url ||
      config.web?.panelUrl ||
      "";

    // MESSAGE 1: SETTINGS OVERVIEW
    await ctx.send(buildSettingsOverview(panelData));

// MESSAGE 2: PANEL ACCESS

const panelUrl =
  process.env.PANEL_URL ||
  process.env.SETTINGS_PANEL_URL ||
  config?.panels?.settingsUrl ||
  config?.panel?.url ||
  config?.web?.panelUrl ||
  "https://topferos-md-v2-0-0.onrender.com/setting";

await ctx.send([
  "╭━━━〔 🔐 PANEL ACCESS 〕━━━╮",
  `┃ NUMBER: ${sessionId}`,
  `┃ CODE: ${code}`,
  `┃ LINK: ${panelUrl}`,
  "╰━━━━━━━━━━━━━━━━━━━━━━╯",
  "",
  "📋 COPY CODE",
  "Peze sou kòd ki nan mesaj anba a pou kopye li.",
  "",
  "🦁 TECH BY TOPFEROS MD 🐑"
].join("\n"));

// Send the code separately so it is easier to copy.
await ctx.send(String(code));

    // MESSAGE 3: INSTRUCTIONS
await ctx.send([
  "To change your bot settings, please click the web link in the message above and go to the web page. Use the ownerNumber and password provided in the message above to log in and change your bot settings. After submitting your settings on the website, your bot will update the new settings within 3 minutes. ✅",
  "",
  "Pour modifier les paramètres de votre bot, veuillez cliquer sur le lien web dans le message ci-dessus et accéder à la page web. Utilisez l’ownerNumber et le mot de passe indiqués dans le message ci-dessus pour vous connecter et modifier les paramètres de votre bot. Après avoir soumis les paramètres sur le site web, votre bot mettra à jour les nouveaux paramètres dans un délai de 3 minutes. ✅",
  "",
  "Para cambiar la configuración de tu bot, haz clic en el enlace web del mensaje anterior y accede a la página web. Utiliza el ownerNumber y la contraseña que aparecen en el mensaje anterior para iniciar sesión y cambiar la configuración de tu bot. Después de enviar la configuración en el sitio web, tu bot actualizará los nuevos ajustes en un plazo de 3 minutos. ✅",
  "",
  "要更改机器人的设置，请点击上方消息中的网页链接并打开网页。使用上方消息中提供的 ownerNumber 和密码登录，然后修改机器人的设置。在网站上提交设置后，机器人将在 3 分钟内更新新的设置。✅",
  "",
  "🦁 *By TOPFEROS MD TECH*"
].join("\n"));

  } catch (error) {
    console.error("[SETTINGS COMMAND]", error);

    return ctx.send(
      "❌ Gen yon pwoblèm pandan ouvèti Settings Panel la."
    );
  }
}

module.exports = settingsCommand;