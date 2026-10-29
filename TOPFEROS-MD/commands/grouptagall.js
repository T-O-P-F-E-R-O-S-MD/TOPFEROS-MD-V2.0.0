"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                 TAG ALL COMMAND                  ║
// ╚════════════════════════════════════════════════════╝

const {
  registerCommand
} = require("../src/messageHandler");

/*
|--------------------------------------------------------------------------
| TAG ALL COMMAND
|--------------------------------------------------------------------------
*/

async function tagAllCommand(ctx) {
  /*
   * This command works ONLY inside groups.
   */

  if (!ctx.isGroup) {
    await ctx.send(
      [
        "❌ GROUP COMMAND ONLY",
        "",
        "This command can only be used inside a WhatsApp group.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason:
        "Command used outside a group."
    };
  }

  /*
   * Get group metadata.
   */

  let metadata;

  try {
    metadata =
      await ctx.sock.groupMetadata(
        ctx.jid
      );
  } catch (error) {
    console.error(
      "[TAGALL] Group metadata error:",
      error?.stack ||
        error
    );

    await ctx.send(
      [
        "❌ GROUP INFO ERROR",
        "",
        "Unable to retrieve group information.",
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

  /*
   * Get all valid participants.
   */

  const participants =
    Array.isArray(
      metadata?.participants
    )
      ? metadata.participants
      : [];

  const mentions =
    participants
      .map(
        (participant) =>
          participant?.id
      )
      .filter(Boolean);

  if (
    mentions.length === 0
  ) {
    await ctx.send(
      [
        "❌ NO MEMBERS FOUND",
        "",
        "I could not find any group members to tag.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason:
        "No participants found."
    };
  }

  /*
   * Use the command text as an optional message.
   *
   * Example:
   * .tagall Hello everyone
   *
   * If no text is provided, use the default message.
   */

  const customText =
    String(
      ctx.text || ""
    ).trim();

  const header =
    customText ||
    "📢 Attention everyone!";

  /*
   * Build a clean mention list.
   */

  const mentionLines =
    mentions.map(
      (jid) =>
        `@${String(jid)
          .split("@")[0]
          .split(":")[0]}`
    );

  const message = [
    "╭━━━〔 📢 TAG ALL 〕━━━╮",
    "",
    header,
    "",
    mentionLines.join(" "),
    "",
    "╰━━━━━━━━━━━━━━━━━━━━╯",
    "",
    "🦁 TECH BY TOPFEROS MD 🐑",
    "",
    "🌐 *Web Connect*",
    "└──➤ https://topferos-md-v2-0-0.onrender.com/",
    "🌐 *Web Channel*",
    "└──➤ https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91"
  ].join("\n");

  try {
    await ctx.sock.sendMessage(
      ctx.jid,
      {
        text: message,
        mentions
      },
      {
        quoted:
          ctx.message
      }
    );

    return {
      success: true,
      tagged:
        mentions.length
    };
  } catch (error) {
    console.error(
      "[TAGALL] Send error:",
      error?.stack ||
        error
    );

    return {
      success: false,
      error:
        error?.message ||
        String(error)
    };
  }
}

/*
|--------------------------------------------------------------------------
| REGISTER COMMAND
|--------------------------------------------------------------------------
*/

registerCommand(
  "tagall",
  tagAllCommand,
  {
    aliases: [
      "everyone"
    ],

    description:
      "Mention all members in the current group.",

    usage:
      ".tagall [message]",

    category:
      "GROUP"
  }
);

module.exports = {
  tagAllCommand
};