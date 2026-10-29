"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                GROUP LINK COMMAND                ║
// ╚════════════════════════════════════════════════════╝

const {
  registerCommand
} = require("../src/messageHandler");

/*
|--------------------------------------------------------------------------
| GROUP LINK COMMAND
|--------------------------------------------------------------------------
*/

async function groupLinkCommand(ctx) {
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
   * Get the current group invite code.
   */

  let inviteCode;

  try {
    if (
      typeof ctx.sock.groupInviteCode !==
      "function"
    ) {
      throw new Error(
        "Group invite code function is unavailable."
      );
    }

    inviteCode =
      await ctx.sock.groupInviteCode(
        ctx.jid
      );
  } catch (error) {
    console.error(
      "[GROUP LINK] Error:",
      error?.stack ||
        error
    );

    await ctx.send(
      [
        "❌ GROUP LINK ERROR",
        "",
        "I could not retrieve the group invite link.",
        "",
        "Make sure the bot is still a member of this group.",
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

  if (!inviteCode) {
    await ctx.send(
      [
        "❌ INVITE LINK UNAVAILABLE",
        "",
        "WhatsApp did not return an invite code for this group.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason:
        "No invite code returned."
    };
  }

  /*
   * Build the invite link.
   */

  const inviteLink =
    `https://chat.whatsapp.com/${inviteCode}`;

  const message = [
    "╭━━━〔 🔗 GROUP LINK 〕━━━╮",
    "",
    "👥 Group Invite Link",
    "",
    `🔗 ${inviteLink}`,
    "",
    "╰━━━━━━━━━━━━━━━━━━━━━━╯",
    "",
    "🦁 TECH BY TOPFEROS MD 🐑",
    "",
    "🌐 *Web Connect*",
    "└──➤ https://topferos-md-v2-0-0.onrender.com/",
    "🌐 *Web Channel*",
    "└──➤ https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91l"
  ].join("\n");

  try {
    await ctx.sock.sendMessage(
      ctx.jid,
      {
        text: message
      },
      {
        quoted:
          ctx.message
      }
    );

    return {
      success: true,
      inviteLink
    };
  } catch (error) {
    console.error(
      "[GROUP LINK] Send error:",
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
  "link",
  groupLinkCommand,
  {
    aliases: [
      "grouplink",
      "invite"
    ],

    description:
      "Get the current WhatsApp group invite link.",

    usage:
      ".link",

    category:
      "GROUP"
  }
);

module.exports = {
  groupLinkCommand
};
