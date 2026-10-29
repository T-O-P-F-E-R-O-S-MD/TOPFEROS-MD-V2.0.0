
"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                  ALIVE COMMAND                   ║
// ╚════════════════════════════════════════════════════╝

const fs = require("fs");
const path = require("path");

const {
  registerCommand
} = require("../src/messageHandler");

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  parts.push(`${secs}s`);

  return parts.join(" ");
}

async function aliveCommand(ctx) {
  try {
    const uptime = formatUptime(process.uptime());

    const helpText = [
      "╭━━━〔 🦁 TOPFEROS MD 〕━━━╮",
      "",
      "        ✅ I'M ALIVE",
      "",
      "🤖 Bot: TOPFEROS MD",
      "📦 Version: V2.0.0",
      "🟢 Status: ONLINE",
      `⏱️ Uptime: ${uptime}`,
      "",
      "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n");

    const logoPath = path.join(
      __dirname,
      "../assets/logo.png"
    );

    // Verifye si sistèm mesaj la bay enfòmasyon ki nesesè yo.
    const sock = ctx?.sock;
    const jid = ctx?.jid;
    const message = ctx?.message;

    if (!sock || !jid) {
      throw new Error(
        "ctx.sock oswa ctx.jid pa disponib nan messageHandler.js"
      );
    }

    // Voye logo a ansanm ak mesaj ALIVE la.
    if (fs.existsSync(logoPath)) {
      const logo = await fs.promises.readFile(logoPath);

      await sock.sendMessage(
        jid,
        {
          image: logo,
          caption: helpText
        },
        message ? { quoted: message } : {}
      );
    } else {
      // Si logo a pa jwenn, voye tèks la sèlman.
      await sock.sendMessage(
        jid,
        {
          text: helpText
        },
        message ? { quoted: message } : {}
      );

      console.error(
        "[TOPFEROS MD ALIVE] Logo pa jwenn:",
        logoPath
      );
    }

    return {
      success: true,
      uptime
    };
  } catch (error) {
    console.error(
      "[TOPFEROS MD ALIVE ERROR]",
      error?.stack || error
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }
}

registerCommand(
  "alive",
  aliveCommand,
  {
    aliases: ["online"],
    description: "Check whether the bot is alive and online.",
    usage: ".alive",
    category: "UTILITY"
  }
);

module.exports = {
  aliveCommand
};
