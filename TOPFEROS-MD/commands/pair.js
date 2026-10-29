"use strict";

/*
|--------------------------------------------------------------------------
| 🦁 TOPFEROS MD V2.0.0
| PAIR COMMAND
|--------------------------------------------------------------------------
|
| Usage:
| .pair 509XXXXXXXX
|
|--------------------------------------------------------------------------
*/

async function pairCommand(
  sock,
  message,
  args = []
) {
  const number = String(
    args?.[0] || ""
  ).replace(/\D/g, "");

  const jid =
    message?.key?.remoteJid || "";

  if (!number) {
  
    if (jid && sock) {
      const pairingCode = String(result.pairingCode);

      await sock.sendMessage(jid, {
        interactiveMessage: {
          body: {
            text: [
              "╭━━━〔 🦁 TOPFEROS MD V2.0.0 🐑 〕━━━╮",
              "┃",
              "┃ 🔐 PAIRING CODE",
              "┃",
              `┃ 📱 NUMBER: ${result.sessionId}`,
              "┃",
              `┃ 🔑 CODE: ${pairingCode}`,
              "┃",
              "┃ 📲 Open WhatsApp on this number.",
              "┃ ⚙️ Go to Linked Devices.",
              "┃ 🔗 Choose Link a Device.",
              "┃ 🔢 Enter the pairing code above.",
              "┃",
              "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
              "",
              "🟢 Waiting for WhatsApp pairing..."
            ].join("\n")
          },
          footer: {
            text: "🦁 TECH BY TOPFEROS MD 🐑"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 Copy Pairing Code",
                  copy_code: pairingCode
                })
              }
            ]
          }
        }
      });
    }

    return {
      success: false,
      error: "Phone number is required."
    };
  }

  if (
    number.length < 8 ||
    number.length > 15
  ) {
    if (jid && sock) {
      await sock.sendMessage(
        jid,
        {
          text: [
            "❌ INVALID PHONE NUMBER",
            "",
            "Use the international format:",
            ".pair 509XXXXXXXX",
            "",
            "🦁 TECH BY TOPFEROS MD 🐑"
          ].join("\n")
        }
      );
    }

    return {
      success: false,
      error: "Invalid phone number."
    };
  }

  try {
    const {
      pairSession
    } = require("../src/connection");

    const result =
      await pairSession(number);

    if (jid && sock) {
      await sock.sendMessage(
        jid,
        {
          text: [
            "╭━━━〔 🦁 TOPFEROS MD V2.0.0 🐑 〕━━━╮",
            "┃",
            "┃ 🔐 PAIRING CODE",
            "┃",
            `┃ 📱 NUMBER: ${result.sessionId}`,
            "┃",
            `┃ 🔑 CODE: ${result.pairingCode}`,
            "┃",
            "┃ 📲 Open WhatsApp on this number.",
            "┃ ⚙️ Go to Linked Devices.",
            "┃ 🔗 Choose Link a Device.",
            "┃ 🔢 Enter the pairing code above.",
            "┃",
            "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
            "",
            "🟢 Waiting for WhatsApp pairing...",
            "",
            "🦁 TECH BY TOPFEROS MD 🐑"
          ].join("\n")
        }
      );
    }

    return {
      success: true,
      sessionId:
        result.sessionId,
      pairingCode:
        result.pairingCode
    };
  } catch (error) {
    if (jid && sock) {
      await sock.sendMessage(
        jid,
        {
          text: [
            "❌ PAIRING FAILED",
            "",
            `📱 NUMBER: ${number}`,
            "",
            `⚠️ ${error?.message || "Unable to generate pairing code."}`,
            "",
            "🦁 TECH BY TOPFEROS MD 🐑"
          ].join("\n")
        }
      );
    }

    return {
      success: false,
      error:
        error?.message ||
        "Unable to generate pairing code."
    };
  }
}

module.exports = {
  pairCommand
};