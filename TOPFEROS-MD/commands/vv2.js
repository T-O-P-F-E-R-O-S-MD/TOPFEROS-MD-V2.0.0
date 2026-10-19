
"use strict";

const viewonce = require("../services/viewOnce");

async function execute(context) {
  const {
    sock,
    message
  } = context || {};

  if (!sock || !message) {
    return;
  }

  const chatId =
    message?.key?.remoteJid;

  if (!chatId) {
    return;
  }

  try {
    const processed =
      await viewonce.handleVV2(context);

    if (processed) {
      console.log(
        `[VV2] View Once decoded | chat=${chatId}`
      );
      return;
    }

    await sock.sendMessage(
      chatId,
      {
        text:
          "❌ Mwen pa jwenn yon View Once pou dekode.\n\n" +
          "Reply sou View Once la epi itilize:\n" +
          "`.vv2`"
      },
      {
        quoted: message
      }
    );

  } catch (error) {
    console.error(
      "❌ VV2 ERROR:",
      error?.stack ||
      error?.message ||
      error
    );

    try {
      await sock.sendMessage(
        chatId,
        {
          text:
            "❌ Gen yon erè pandan m t ap dekode View Once la."
        },
        {
          quoted: message
        }
      );
    } catch (_) {}
  }
}

module.exports = {
  name: "vv2",
  aliases: ["vv"],
  description:
    "Dekode yon View Once nan menm chat la.",
  usage: ".vv2",
  execute
};
