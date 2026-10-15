"use strict";

/*
|--------------------------------------------------------------------------
| 🦁 TOPFEROS MD V2.0.0
| COMMANDS: DELETE
|--------------------------------------------------------------------------
*/

const {
  registerCommand
} = require("../src/messageHandler");

/*
|--------------------------------------------------------------------------
| GET REPLIED MESSAGE
|--------------------------------------------------------------------------
*/

function getQuotedKey(ctx) {
  const message = ctx.message;
  const content = message?.message || {};

  const contextInfo =
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo;

  if (!contextInfo?.stanzaId) {
    return null;
  }

  const participant =
    contextInfo.participant ||
    (ctx.jid?.endsWith("@g.us")
      ? undefined
      : ctx.sock?.user?.id);

  return {
    remoteJid: ctx.jid,
    id: contextInfo.stanzaId,
    ...(participant ? { participant } : {}),
    fromMe: Boolean(
      participant &&
      participant.split(":")[0] ===
        ctx.sock?.user?.id?.split(":")[0]
    )
  };
}

/*
|--------------------------------------------------------------------------
| .DEL — DELETE FOR MYSELF
|--------------------------------------------------------------------------
*/

registerCommand(
  "del",
  async (ctx) => {
    const key = getQuotedKey(ctx);

    if (!key) {
      await ctx.send(
        "⚠️ Reply to the message you want to delete.\n\n" +
        "Usage: .del\n\n" +
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      return { success: false };
    }

    try {
      await ctx.sock.chatModify(
        {
          clear: {
            messages: [
              {
                id: key.id,
                fromMe: key.fromMe,
                timestamp: Number(
                  ctx.message.messageTimestamp || 0
                ),
                ...(key.participant
                  ? { participant: key.participant }
                  : {})
              }
            ]
          }
        },
        ctx.jid
      );

      await ctx.send(
        "✅ Demann pou retire mesaj la nan chat lokal la voye.\n\n" +
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      return { success: true };
    } catch (error) {
      console.error("[DEL]", error);

      await ctx.send(
        "❌ WhatsApp pa t kapab retire mesaj sa a lokalman.\n\n" +
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      return { success: false };
    }
  },
  {
    description: "Remove a replied-to message locally when supported.",
    usage: ".del (reply to a message)",
    category: "MESSAGES"
  }
);

/*
|--------------------------------------------------------------------------
| .DELT — DELETE FOR EVERYONE
|--------------------------------------------------------------------------
*/

registerCommand(
  "delt",
  async (ctx) => {
    const key = getQuotedKey(ctx);

    if (!key) {
      await ctx.send(
        "⚠️ Reply to the message you want to delete for everyone.\n\n" +
        "Usage: .delt\n\n" +
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      return { success: false };
    }

    try {
      await ctx.sock.sendMessage(
        ctx.jid,
        { delete: key }
      );

      return { success: true };
    } catch (error) {
      console.error("[DELT]", error);

      await ctx.send(
        "❌ Mwen pa t kapab efase mesaj la pou tout moun. " +
        "WhatsApp gen limit pou operasyon sa a.\n\n" +
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      return { success: false };
    }
  },
  {
    description: "Delete a replied-to message for everyone when permitted.",
    usage: ".delt (reply to a message)",
    category: "MESSAGES"
  }
);

/*
|--------------------------------------------------------------------------
| .DELETE — DELETE CURRENT CHAT LOCALLY
|--------------------------------------------------------------------------
*/

registerCommand(
  "delete",
  async (ctx) => {
    await ctx.send(
      "⚠️ WhatsApp/Baileys pa garanti efasman tout istwa chat lokal la " +
      "ak yon sèl kòmand.\n\n" +
      "Pou evite efase move mesaj, sèvi ak .del pou yon mesaj ou site " +
      "oswa .delt pou mande efasman pou tout moun.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      reason: "Bulk local chat-history deletion is not implemented."
    };
  },
  {
    description: "Explain local chat deletion limitations.",
    usage: ".delete",
    category: "MESSAGES"
  }
);

module.exports = {
  getQuotedKey
};