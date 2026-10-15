
"use strict";

/*
|--------------------------------------------------------------------------
| 🦁 TOPFEROS MD V2.0.0
| DELETE COMMANDS
|--------------------------------------------------------------------------
*/

function getQuotedKey(ctx) {
  const message = ctx?.message;
  const content = message?.message || {};

  const contextInfo =
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo ||
    content.audioMessage?.contextInfo;

  if (!contextInfo?.stanzaId) {
    return null;
  }

  const quotedParticipant =
    contextInfo.participant || undefined;

  return {
    remoteJid: ctx.jid,
    id: contextInfo.stanzaId,
    fromMe: Boolean(
      quotedParticipant &&
      ctx.sock?.user?.id &&
      quotedParticipant.split("@")[0].split(":")[0] ===
        ctx.sock.user.id.split("@")[0].split(":")[0]
    ),
    ...(quotedParticipant
      ? { participant: quotedParticipant }
      : {})
  };
}

async function delCommand(ctx) {
  await ctx.send(
    "⚠️ Kòmand .del la bezwen enfòmasyon mesaj orijinal la pou l efase mesaj la sèlman sou kont bot la.\n\n" +
    "M ap konekte fonksyon sa a ak sistèm mesaj la nan pwochen etap la.\n\n" +
    "🦁 TECH BY TOPFEROS MD 🐑"
  );

  return {
    success: false,
    reason: "Local message deletion needs message-history integration."
  };
}

async function deltCommand(ctx) {
  const key = getQuotedKey(ctx);

  if (!key) {
    await ctx.send(
      "⚠️ Reponn mesaj ou vle efase a, epi voye .delt\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      reason: "No quoted message."
    };
  }

  try {
    await ctx.sock.sendMessage(ctx.jid, {
      delete: key
    });

    return {
      success: true,
      command: "delt"
    };
  } catch (error) {
    console.error("[DELT]", error?.stack || error);

    await ctx.send(
      "❌ WhatsApp pa t kapab efase mesaj sa a pou tout moun. " +
      "Sa depann de otorizasyon ak limit WhatsApp yo.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      reason: error?.message || String(error)
    };
  }
}

async function deleteCommand(ctx) {
  await ctx.send(
    "⚠️ Fonksyon .delete pou netwaye tout mesaj nan chat la poko konekte.\n\n" +
    "M ap konekte l san m pa fè bot la efase move mesaj.\n\n" +
    "🦁 TECH BY TOPFEROS MD 🐑"
  );

  return {
    success: false,
    reason: "Local chat clearing needs message-history integration."
  };
}

function init() {
  const {
    registerCommand
  } = require("../src/messageHandler");

  registerCommand("del", delCommand, {
    description: "Delete a replied-to message locally.",
    usage: ".del",
    category: "MESSAGES"
  });

  registerCommand("delt", deltCommand, {
    description: "Delete a replied-to message for everyone.",
    usage: ".delt",
    category: "MESSAGES"
  });

  registerCommand("delete", deleteCommand, {
    description: "Clear chat messages locally.",
    usage: ".delete",
    category: "MESSAGES"
  });
}

module.exports = {
  init,
  getQuotedKey,
  delCommand,
  deltCommand,
  deleteCommand
};
