"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                 BOTINFO COMMAND                  ║
// ╚════════════════════════════════════════════════════╝

const {
  registerCommand
} = require("../src/messageHandler");

async function botInfoCommand(ctx) {
  try {
    const message = [
      "╭━━━〔 🦁 TOPFEROS MD 〕━━━╮",
      "",
      "          🤖 BOT INFO",
      "",
      "🤖 Bot: TOPFEROS MD",
      "📦 Version: V2.0.0",
      `⚡ Prefix: ${ctx.prefix}`,
      "🟢 Status: ONLINE",
      "",
      "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑",
      "",
      "🌐 *Web Connect*",
      "└──➤ https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91",
      "🌐 *Web Channel*",
      "└──➤ https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91"
    ].join("\n");

    await ctx.sock.sendMessage(
      ctx.jid,
      {
        text: message
      },
      {
        quoted: ctx.message
      }
    );

    return {
      success: true
    };
  } catch (error) {
    console.error(
      "[BOTINFO] Error:",
      error?.stack || error
    );

    return {
      success: false,
      error:
        error?.message ||
        String(error)
    };
  }
}

registerCommand(
  "botinfo",
  botInfoCommand,
  {
    aliases: [
      "binfo"
    ],
    description:
      "Show information about TOPFEROS MD.",
    usage:
      ".botinfo",
    category:
      "UTILITY"
  }
);

module.exports = {
  botInfoCommand
};