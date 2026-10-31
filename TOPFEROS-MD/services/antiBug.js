
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| ANTI BUG SERVICE
|--------------------------------------------------------------------------
*/

const IGNORED_MESSAGE_KEYS = new Set([
  "messageContextInfo",
  "senderKeyDistributionMessage"
]);

const MAX_MESSAGE_TEXT_LENGTH = 20000;

/**
 * Identify the actual WhatsApp message content type.
 */
function getContentType(message) {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  return Object.keys(message).find(
    key => !IGNORED_MESSAGE_KEYS.has(key)
  );
}

/**
 * Extract readable text from supported message types.
 */
function extractMessageText(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const type = getContentType(message);

  let text = "";

  switch (type) {
    case "conversation":
      text = message.conversation || "";
      break;

    case "extendedTextMessage":
      text = message.extendedTextMessage?.text || "";
      break;

    case "imageMessage":
      text = message.imageMessage?.caption || "";
      break;

    case "videoMessage":
      text = message.videoMessage?.caption || "";
      break;

    default:
      return "";
  }

  return typeof text === "string" ? text.trim() : "";
}

/**
 * Check whether a WhatsApp message has an unsafe structure.
 *
 * Returns true when the structure is invalid or suspicious.
 */
function isUnsafeMessageStructure(message) {
  try {
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message)
    ) {
      return true;
    }

    if (
      !message.key ||
      typeof message.key !== "object" ||
      Array.isArray(message.key)
    ) {
      return true;
    }

    if (
      !message.message ||
      typeof message.message !== "object" ||
      Array.isArray(message.message)
    ) {
      return true;
    }

    const messageText = extractMessageText(message.message);

    if (messageText.length > MAX_MESSAGE_TEXT_LENGTH) {
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "[ANTI BUG SERVICE]",
      error?.message || error
    );

    return true;
  }
}

module.exports = {
  getContentType,
  extractMessageText,
  isUnsafeMessageStructure
};
