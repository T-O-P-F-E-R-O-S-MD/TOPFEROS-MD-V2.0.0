"use strict";

const {
  STATUS_JID,
  getStatusContent
} = require("../src/statusHandler");

function getQuotedMessage(message) {
  const content = message?.message;
  if (!content) return null;

  const containers = [
    content.extendedTextMessage,
    content.imageMessage,
    content.videoMessage,
    content.documentMessage
  ];

  for (const container of containers) {
    const contextInfo = container?.contextInfo;

    if (contextInfo?.remoteJid === STATUS_JID) {
      return {
        message: contextInfo.quotedMessage,
        participant: contextInfo.participant || null
      };
    }
  }

  return null;
}

async function statusCommand(ctx, action) {
  const quoted = getQuotedMessage(ctx.message);

  if (!quoted?.message) {
    await ctx.send(
      [
        `❌ ${action.toUpperCase()} STATUS`,
        "",
        "Tanpri reponn statut WhatsApp la epi eseye ankò.",
        "",
        `Egzanp: ${ctx.prefix}${action}`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return { success: false };
  }

  const content = getStatusContent({
    message: quoted.message
  });

  await ctx.send(
    [
      `📱 STATUS ${action.toUpperCase()}`,
      "",
      `📌 Kalite: ${content.type}`,
      `👤 Piblikatè: ${quoted.participant || "Pa disponib"}`,
      "",
      "ℹ️ Bot la idantifye statut la. Fonksyon pou konsève oswa pataje li bezwen entegrasyon ak sistèm medya a.",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n")
  );

  return {
    success: true,
    action,
    type: content.type
  };
}

async function saveCommand(ctx) {
  return statusCommand(ctx, "save");
}

async function sendCommand(ctx) {
  return statusCommand(ctx, "send");
}

module.exports = {
  saveCommand,
  sendCommand
};