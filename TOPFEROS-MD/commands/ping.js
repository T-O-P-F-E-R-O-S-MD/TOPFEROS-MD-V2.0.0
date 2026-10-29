"use strict";

const fs = require("fs");
const path = require("path");

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                   PING COMMAND                   ║
// ╚════════════════════════════════════════════════════╝

const {
  registerCommand
} = require("../src/messageHandler");

async function pingCommand(ctx) {
  try {
    const messageTimestamp =
      Number(
        ctx.message?.messageTimestamp || 0
      );

    let responseTime = 0;

    if (messageTimestamp > 0) {
      responseTime = Math.max(
        0,
        Date.now() -
          messageTimestamp * 1000
      );
    }

    
    const logoPath = path.join(
      __dirname,
      "../assets/logo.png"
    );

    const caption = [
      "🏓 PONG!",
      "",
      `⚡ Response: ${responseTime} ms`,
      "🤖 Bot: TOPFEROS MD",
      "📦 Version: V2.0.0",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n");

    if (fs.existsSync(logoPath)) {
      const logo = await fs.promises.readFile(logoPath);

      await ctx.sock.sendMessage(
        ctx.jid,
        {
          image: logo,
          caption
        },
        {
          quoted: ctx.message
        }
      );
    } else {
      await ctx.sock.sendMessage(
        ctx.jid,
        {
          text: caption
        },
        {
          quoted: ctx.message
        }
      );
    }

  } catch (error) {
    console.error(
      "[PING] Error:",
      error?.stack ||
        error
    );

    await ctx.send(
      [
        "❌ PING FAILED",
        "",
        "The bot could not calculate the response time.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
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
  "ping",
  pingCommand,
  {
    aliases: [
      "p"
    ],
    description:
      "Check bot response time and status.",
    usage:
      ".ping",
    category:
      "UTILITY"
  }
);

module.exports = {
  pingCommand
};