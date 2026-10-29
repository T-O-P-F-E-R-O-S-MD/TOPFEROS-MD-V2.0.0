"use strict";

// 🦁 TOPFEROS MD V2.0.0
// HELP COMMAND — LOGO + ENGLISH USER GUIDE

const fs = require("fs");
const path = require("path");

const {
  registerCommand
} = require("../src/messageHandler");

async function helpCommand(ctx) {
  try {
    const prefix = ctx.prefix || ".";

    const help = [
      "╭━━━〔 🦁 TOPFEROS MD HELP 〕━━━╮",
      "┃",
      "┃ 📖 HOW TO USE THE BOT",
      "┃",
      `┃ Prefix: ${prefix}`,
      "┃ Type the prefix before a command.",
      "┃ Add the required information when needed.",
      "┃",
      "┃ EXAMPLES:",
      `┃ ${prefix}menu`,
      `┃ ${prefix}help`,
      `┃ ${prefix}ai Hello`,
      "┃",
      "┣━━━〔 📋 GENERAL COMMANDS 〕━━━",
      "┃",
      `┃ ${prefix}menu`,
      "┃ └─ Display the command menu.",
      `┃ ${prefix}help`,
      "┃ └─ Display this user guide.",
      `┃ ${prefix}info`,
      "┃ └─ Display bot information.",
      `┃ ${prefix}alive`,
      "┃ └─ Check whether the bot is running.",
      `┃ ${prefix}ping`,
      "┃ └─ Check the bot's response.",
      `┃ ${prefix}runtime`,
      "┃ └─ Show the bot's running time.",
      `┃ ${prefix}owner`,
      "┃ └─ Display the owner's contact information.",
      "┃",
      "┣━━━〔 ⚙️ SETTINGS PANEL 〕━━━",
      "┃",
      `┃ ${prefix}setting`,
      `┃ ${prefix}settings`,
      "┃ └─ Access the Settings Panel.",
      "┃",
      "┣━━━〔 🤖 AI COMMANDS 〕━━━",
      "┃",
      `┃ ${prefix}ai <question>`,
      "┃ └─ Ask the AI assistant a question.",
      "┃ Example:",
      `┃ ${prefix}ai Explain artificial intelligence`,
      `┃ ${prefix}prompt <request>`,
      "┃ └─ AI prompt service is not connected yet.",
      "┃",
      "┣━━━〔 🎵 MUSIC AND VIDEO 〕━━━",
      "┃",
      `┃ ${prefix}play song <name or URL>`,
      "┃ └─ Search for or download audio.",
      "┃ Example:",
      `┃ ${prefix}play song Imagine Dragons Believer`,
      `┃ ${prefix}play vid <name or URL>`,
      "┃ └─ Search for or download video.",
      "┃ Example:",
      `┃ ${prefix}play vid football highlights`,
      `┃ ${prefix}video <URL>`,
      "┃ └─ Video service is not connected yet.",
      "┃",
      "┣━━━〔 👁️ MEDIA COMMANDS 〕━━━",
      "┃",
      `┃ ${prefix}vv2`,
      "┃ └─ Reply to a View Once photo or video",
      "┃    and send this command to process it.",
      `┃ ${prefix}vv`,
      "┃ └─ Alternative name for the vv2 command.",
      `┃ ${prefix}vvv`,
      "┃ └─ Reply to regular media you have permission",
      "┃    to share. The bot attempts to send it to",
      "┃    the chat and your private DM.",
      "┃",
      "┣━━━〔 📱 CONNECTION 〕━━━",
      "┃",
      `┃ ${prefix}pair <international phone number>`,
      "┃ └─ Request a WhatsApp pairing code.",
      "┃ Example:",
      `┃ ${prefix}pair 509XXXXXXXX`,
      "┃ Include your country code.",
      "┃ Never share your pairing code with others.",
      `┃ ${prefix}parrain`,
      "┃ └─ Request a Parrain code.",
      "┃",
      "┣━━━〔 🧰 TOOLS 〕━━━",
      "┃",
      `┃ ${prefix}calc <calculation>`,
      "┃ └─ Perform a calculation.",
      "┃ Example: .calc 25*4",
      `┃ ${prefix}translate <language> <text>`,
      "┃ └─ Translate text.",
      "┃ Example: .translate en Hello",
      `┃ ${prefix}tts <text>`,
      "┃ └─ Convert text to speech, if available.",
      `┃ ${prefix}qr <text or URL>`,
      "┃ └─ Generate a QR code.",
      `┃ ${prefix}shorturl <URL>`,
      "┃ └─ Try to shorten a URL.",
      `┃ ${prefix}ss <URL>`,
      "┃ └─ Try to capture a webpage screenshot.",
      `┃ ${prefix}sticker`,
      "┃ └─ Reply to supported media to create a sticker.",
      `┃ ${prefix}toimg`,
      "┃ └─ Reply to a supported sticker to convert it.",
      `┃ ${prefix}take <pack | author>`,
      "┃ └─ Change sticker pack information.",
      `┃ ${prefix}film <movie name>`,
      "┃ └─ Search for movie information or content.",
      `┃ ${prefix}serie <series name>`,
      "┃ └─ Search for series information or content.",
      "┃",
      "┣━━━〔 👥 GROUP COMMANDS 〕━━━",
      "┃",
      `┃ ${prefix}groupinfo`,
      "┃ └─ Display group information.",
      `┃ ${prefix}add @member`,
      "┃ └─ Try to add a member; admin rights may",
      "┃    be required.",
      `┃ ${prefix}kick`,
      "┃ └─ Reply to a member's message to try to",
      "┃    remove them from the group.",
      `┃ ${prefix}promote @member`,
      "┃ └─ Try to promote a member to admin.",
      `┃ ${prefix}demote @admin`,
      "┃ └─ Try to remove a member's admin role.",
      `┃ ${prefix}mute`,
      "┃ └─ Try to restrict group messages.",
      `┃ ${prefix}unmute`,
      "┃ └─ Try to allow group messages again.",
      `┃ ${prefix}open`,
      "┃ └─ Try to allow all members to send messages.",
      `┃ ${prefix}close`,
      "┃ └─ Try to restrict messages to admins.",
      `┃ ${prefix}setname <new name>`,
      "┃ └─ Change the group name.",
      `┃ ${prefix}setdesc <description>`,
      "┃ └─ Change the group description.",
      `┃ ${prefix}tagall [message]`,
      "┃ └─ Mention group members.",
      `┃ ${prefix}hidetag <message>`,
      "┃ └─ Send a message mentioning members without",
      "┃    displaying their names in the message text.",
      "┃",
      "┣━━━〔 📨 MESSAGE COMMANDS 〕━━━",
      "┃",
      `┃ ${prefix}delt`,
      "┃ └─ Reply to a message and try to delete it",
      "┃    for everyone, if WhatsApp permits it.",
      `┃ ${prefix}del`,
      "┃ └─ Local message deletion is not connected.",
      `┃ ${prefix}delete`,
      "┃ └─ Chat-clearing service is not connected.",
      "┃",
      "┣━━━〔 💡 HOW TO USE COMMANDS 〕━━━",
      "┃",
      "┃ 1. Start with the configured prefix.",
      "┃ 2. Type the command name.",
      "┃ 3. Add any required text, number, or URL.",
      "┃ 4. If required, reply to a message first.",
      "┃",
      "┃ ⚠️ Some commands require admin permissions,",
      "┃ external services, or valid configuration.",
      "┃ A command may be unavailable if its service",
      "┃ has not been connected.",
      "┃",
      "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n");

    const logoPath = path.join(
      __dirname,
      "../assets/logo.png"
    );

    // Send the logo and guide together.
    if (
      ctx.sock &&
      ctx.jid &&
      fs.existsSync(logoPath)
    ) {
      const logo = await fs.promises.readFile(
        logoPath
      );

      await ctx.sock.sendMessage(
        ctx.jid,
        {
          image: logo,
          caption: help
        },
        {
          quoted: ctx.message
        }
      );
    } else {
      await ctx.send(help);
    }

    return {
      success: true
    };
  } catch (error) {
    console.error(
      "[TOPFEROS MD HELP ERROR]",
      error?.stack || error
    );

    try {
      await ctx.send(
        "The help command encountered an error. Please check the bot logs."
      );
    } catch (sendError) {
      console.error(
        "[TOPFEROS MD HELP SEND ERROR]",
        sendError?.message || sendError
      );
    }

    return {
      success: false,
      error: error?.message || String(error)
    };
  }
}

registerCommand(
  "help",
  helpCommand,
  {
    aliases: [],
    description: "Show the help guide with the bot logo.",
    usage: ".help",
    category: "INFO"
  }
);

module.exports = {
  helpCommand
};