
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// GEMINI AI STATUS REACTION SERVICE

const { askAI } = require("./ai");

const {
  askAI,
  askAIWithImage
} = require("./ai");

const FALLBACK_EMOJIS = [
  "❤️", "😂", "🔥", "😍", "🥰", "👏",
  "💯", "😎", "🙏", "✨", "🤔", "😮",
  "💪", "🤣", "😊", "🙌", "🌹", "💖"
];

function getFallbackEmoji(statusData = {}) {
  const text = [
    statusData.text || "",
    statusData.caption || ""
  ].join(" ").toLowerCase();

  if (/love|lanmou|renmen|amour|cheri|chérie/.test(text)) {
    return "❤️";
  }

  if (/lol|haha|komik|drole|drôle|funny|😂/.test(text)) {
    return "😂";
  }

  if (/birthday|anivèsè|anniversaire/.test(text)) {
    return "🎂";
  }

  if (/amen|bondye|god|jesus|lapriyè|prière/.test(text)) {
    return "🙏";
  }

  if (/sad|tris|triste|lapenn/.test(text)) {
    return "❤️";
  }

  if (/beautiful|bèl|joli|magnifique/.test(text)) {
    return "😍";
  }

  if (statusData.mediaType === "image") {
    return "😍";
  }

  return FALLBACK_EMOJIS[
    Math.floor(Math.random() * FALLBACK_EMOJIS.length)
  ];
}

function extractEmoji(text) {
  if (typeof text !== "string") return null;

  const matches = text.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu);

  return matches && matches.length ? matches[0] : null;
}

function buildPrompt(statusData = {}) {
  const text = String(
    statusData.text || statusData.caption || ""
  ).trim();

  const mediaType = String(
    statusData.mediaType || "text"
  ).toLowerCase();

  let context;

  if (text) {
    context = `Status text/caption: ${text}\nMedia type: ${mediaType}`;
  } else if (mediaType === "image") {
    context = "The status contains an image, but its visual content has not been provided.";
  } else if (mediaType === "video") {
    context = "The status contains a video, but its visual content has not been provided.";
  } else if (mediaType === "audio") {
    context = "The status contains audio, but its contents have not been transcribed.";
  } else {
    context = "The status has no readable text.";
  }

  return [
    "Choose the single most appropriate emoji reaction for this WhatsApp Status.",
    "Consider the meaning and emotional tone of the supplied status information.",
    "Return exactly ONE emoji and nothing else.",
    "Do not explain your choice.",
    "",
    context
  ].join("\n");
}

function extractAIText(response) {
  if (typeof response === "string") {
    return response.trim();
  }

  if (!response || typeof response !== "object") {
    return "";
  }

  if (typeof response.text === "string") {
    return response.text.trim();
  }

  if (typeof response.output === "string") {
    return response.output.trim();
  }

  if (response.candidates?.[0]?.content?.parts) {
    return response.candidates[0].content.parts
      .map(part => part.text || "")
      .join("")
      .trim();
  }

  if (response.choices?.[0]?.message?.content) {
    const content = response.choices[0].message.content;

    if (typeof content === "string") {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map(item => item.text || "")
        .join("")
        .trim();
    }
  }

  if (response.choices?.[0]?.text) {
    return response.choices[0].text.trim();
  }

  return "";
}

async function chooseEmojiWithSource(statusData = {}) {
  const fallback = getFallbackEmoji(statusData);
  const prompt = buildPrompt(statusData);

if (
  statusData.mediaType === "image" &&
  Buffer.isBuffer(statusData.media)
) {
  const answer = await askAIWithImage(
    prompt,
    statusData.media,
    statusData.mimeType || "image/jpeg",
    {
      systemPrompt:
        "You analyze WhatsApp Status images. " +
        "Choose exactly one appropriate emoji reaction. " +
        "Return only one emoji, without explanation.",
      temperature: 0.2,
      maxTokens: 128
    }
  );

  const emoji = extractEmoji(answer);

  if (emoji) {
    return {
      emoji,
      source: "gemini-image"
    };
  }
}

  try {
    const response = await Promise.race([
      askAI(prompt, {
        systemPrompt:
          "You are a WhatsApp Status reaction assistant. " +
          "Return exactly one suitable emoji. No words or explanation.",
        temperature: 0.2,
        maxTokens: 20
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Gemini AI timeout"));
        }, 15000);
      })
    ]);

    const answer = extractAIText(response);
    const emoji = extractEmoji(answer);

    if (emoji) {
      return {
        emoji,
        source: "gemini"
      };
    }

    console.warn("[STATUS AI] Gemini pa bay emoji valab.");
  } catch (error) {
    console.error(
      "[STATUS AI] Erè Gemini:",
      error.message || error
    );
  }

  return {
    emoji: fallback,
    source: "fallback"
  };
}

async function chooseEmoji(statusData = {}) {
  const result = await chooseEmojiWithSource(statusData);
  return result.emoji;
}

async function analyzeStatus(statusData = {}) {
  const result = await chooseEmojiWithSource(statusData);

  return {
    emoji: result.emoji,
    source: result.source,
    statusText: statusData.text || statusData.caption || "",
    mediaType: statusData.mediaType || "text",
    messageId: statusData.messageId || null,
    participant: statusData.participant || null
  };
}

module.exports = {
  chooseEmoji,
  chooseEmojiWithSource,
  analyzeStatus,
  extractEmoji,
  extractAIText,
  buildPrompt,
  getFallbackEmoji
};
