
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// AUTO REACT SERVICE

const settingPanel = require("../src/settingPanel");
const { askAI } = require("./ai");
const aiReactionService = require("./aiReactionService");

const AI_TIMEOUT_MS = 20000;
const MAX_PROCESSED_MESSAGES = 5000;

const processedMessages = new Map();

/*
|--------------------------------------------------------------------------
| EXTRACT MESSAGE CONTENT
|--------------------------------------------------------------------------
*/

function unwrapMessageContent(message) {
  let content = message?.message || {};

  for (let i = 0; i < 5; i += 1) {
    const wrapper =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message;

    if (!wrapper) break;

    content = wrapper;
  }

  return content;
}

function extractText(message) {
  const content = unwrapMessageContent(message);

  return String(
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  ).trim();
}

/*
|--------------------------------------------------------------------------
| CLEAN EMOJI LIST
|--------------------------------------------------------------------------
*/

function cleanEmojiList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 40);
}

/*
|--------------------------------------------------------------------------
| AI TIMEOUT
|--------------------------------------------------------------------------
*/

function withTimeout(promise, timeoutMs = AI_TIMEOUT_MS) {
  let timer;

  return Promise.race([
    Promise.resolve(promise),

    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Auto React AI timeout.")),
        timeoutMs
      );
    })
  ]).finally(() => clearTimeout(timer));
}

/*
|--------------------------------------------------------------------------
| PREVENT DUPLICATE REACTIONS
|--------------------------------------------------------------------------
*/

function rememberMessage(key) {
  if (processedMessages.has(key)) return false;

  processedMessages.set(key, Date.now());

  while (processedMessages.size > MAX_PROCESSED_MESSAGES) {
    const oldest = processedMessages.keys().next().value;

    if (!oldest) break;

    processedMessages.delete(oldest);
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| PERSONALIZED EMOJI FALLBACK
|--------------------------------------------------------------------------
*/

function getAllowedEmojiFallback(text, emojis) {
  const suggested =
    aiReactionService.getFallbackEmoji({ text });

  return emojis.includes(suggested)
    ? suggested
    : emojis[0];
}

/*
|--------------------------------------------------------------------------
| AI EMOJI SELECTION
|--------------------------------------------------------------------------
*/

async function chooseReactionEmoji(text, configuredEmojis) {

  // USER HAS PROVIDED PERSONAL EMOJIS
  if (configuredEmojis.length > 0) {

    if (!text) return configuredEmojis[0];

    const prompt = [
      "You select one WhatsApp reaction emoji for a message.",
      "Choose the emoji that best matches the meaning and tone of the message.",
      "You MUST choose exactly one emoji from the allowed list.",
      "Never create, modify, or return an emoji outside that list.",
      `Allowed emojis: ${configuredEmojis.join(" ")}`,
      `Message: ${text}`,
      "Return only the selected emoji, with no explanation."
    ].join("\n");

    try {
      const response = await withTimeout(
        askAI(prompt, {
          systemPrompt:
            "You are a precise emoji selector. Obey the allowed emoji list exactly.",
          temperature: 0.1,
          maxTokens: 32
        })
      );

      const answer =
        aiReactionService.extractAIText(response);

      const extracted =
        aiReactionService.extractEmoji(answer);

      if (
        extracted &&
        configuredEmojis.includes(extracted)
      ) {
        return extracted;
      }

      console.warn(
        "[AUTO REACT] AI returned an emoji outside the configured list."
      );

    } catch (error) {
      console.error(
        "[AUTO REACT] AI selection failed:",
        error?.message || error
      );
    }

    return getAllowedEmojiFallback(
      text,
      configuredEmojis
    );
  }

  // USER HAS NOT PROVIDED PERSONAL EMOJIS
  if (!text) return null;

  try {
    const result = await withTimeout(
      aiReactionService.chooseEmojiWithSource({
        text,
        caption: text,
        mediaType: "text"
      })
    );

    return (
      result?.emoji ||
      aiReactionService.getFallbackEmoji({ text })
    );

  } catch (error) {
    console.error(
      "[AUTO REACT] Default AI selection failed:",
      error?.message || error
    );

    return aiReactionService.getFallbackEmoji({ text });
  }
}

/*
|--------------------------------------------------------------------------
| MAIN AUTO REACT HANDLER
|--------------------------------------------------------------------------
*/

async function handleAutoReact({
  sock,
  message,
  sessionId
} = {}) {

  if (!sock || !message?.key || !sessionId) {
    return {
      success: false,
      skipped: true,
      reason: "Missing socket, message, or session ID."
    };
  }

  const jid = String(
    message.key.remoteJid || ""
  );

  const messageId = String(
    message.key.id || ""
  );

  if (
    !jid ||
    !messageId ||
    jid === "status@broadcast" ||
    message.key.fromMe === true ||
    jid.endsWith("@newsletter")
  ) {
    return {
      success: false,
      skipped: true,
      reason: "Unsupported or outgoing message."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD SESSION SETTINGS
  |--------------------------------------------------------------------------
  */

  let automation;

  try {
    const settings =
      settingPanel.getSessionSettings(sessionId);

    automation = settings?.automation || {};

  } catch (error) {
    console.error(
      "[AUTO REACT] Settings could not be loaded:",
      error?.message || error
    );

    return {
      success: false,
      skipped: true,
      reason: "Settings unavailable."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | CHECK MAIN SWITCH
  |--------------------------------------------------------------------------
  */

  if (automation.autoReact !== true) {
    return {
      success: false,
      skipped: true,
      reason: "Auto React is disabled."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | PRIVATE / GROUP MODE
  |--------------------------------------------------------------------------
  */

  const isGroup = jid.endsWith("@g.us");

  const mode = [
    "all",
    "private",
    "group"
  ].includes(automation.autoReactMode)
    ? automation.autoReactMode
    : "all";

  if (
    (mode === "private" && isGroup) ||
    (mode === "group" && !isGroup)
  ) {
    return {
      success: false,
      skipped: true,
      reason: "Message excluded by Auto React mode."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | DUPLICATE CHECK
  |--------------------------------------------------------------------------
  */

  const cacheKey =
    `${sessionId}:${jid}:${messageId}`;

  if (!rememberMessage(cacheKey)) {
    return {
      success: false,
      skipped: true,
      reason: "Message already processed."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | EXTRACT MESSAGE TEXT
  |--------------------------------------------------------------------------
  */

  const text = extractText(message);

  if (!text) {
    processedMessages.delete(cacheKey);

    return {
      success: false,
      skipped: true,
      reason: "Message has no readable text or caption."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SELECT APPROPRIATE EMOJI
  |--------------------------------------------------------------------------
  */

  const configuredEmojis =
    cleanEmojiList(automation.autoReactEmojis);

  const emoji = await chooseReactionEmoji(
    text,
    configuredEmojis
  );

  if (!emoji) {
    processedMessages.delete(cacheKey);

    return {
      success: false,
      skipped: true,
      reason: "No suitable emoji could be selected."
    };
  }

  /*
  |--------------------------------------------------------------------------
  | SEND WHATSAPP REACTION
  |--------------------------------------------------------------------------
  */

  try {
    await sock.sendMessage(jid, {
      react: {
        text: emoji,
        key: message.key
      }
    });

    return {
      success: true,
      emoji,
      mode,
      chatType: isGroup ? "group" : "private"
    };

  } catch (error) {
    processedMessages.delete(cacheKey);

    console.error(
      "[AUTO REACT] WhatsApp reaction failed:",
      error?.stack ||
      error?.message ||
      error
    );

    return {
      success: false,
      skipped: false,
      reason: error?.message || "Reaction failed."
    };
  }
}

/*
|--------------------------------------------------------------------------
| CLEAR CACHE
|--------------------------------------------------------------------------
*/

function clearAutoReactCache() {
  processedMessages.clear();
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  handleAutoReact,
  clearAutoReactCache,
  extractText,
  chooseReactionEmoji
};
