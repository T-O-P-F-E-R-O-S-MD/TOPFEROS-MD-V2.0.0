
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// GEMINI AI STATUS REACTION SERVICE

const {
  askAI,
  askAIWithImage
} = require("./ai");

const AI_TIMEOUT_MS = 30000;

const DEFAULT_EMOJIS = [
  "🥰", "😭", "🤔", "🤭", "🤩", "🥳",
  "😎", "🥶", "😶‍🌫️", "🫥", "👹", "☠️",
  "👻", "🥴", "👀", "🧠", "👰🏼‍♂️", "👰",
  "🧟", "🧚‍♀️", "🧜‍♂️", "🦁", "🐜", "🕊️",
  "🌚", "🌈", "🍇", "🎇", "🌃", "🌌",
  "🪦", "🩻", "🛏️", "🛌🏿", "🎊", "💙",
  "❤️", "💘", "❤️‍🔥", "🔴", "🇭🇹",
  "🤣", "🫵", "🔥", "🐑", "💯", "💥",
  "🥃", "🍺", "🎂"
];

const FALLBACK_EMOJIS = [
  "❤️", "😂", "🔥", "😍", "🥰", "👏",
  "💯", "😎", "🙏", "✨", "🤔", "😮",
  "💪", "🤣", "😊", "🙌", "🌹", "💖"
];

function getRandomDefaultEmoji() {
  return DEFAULT_EMOJIS[
    Math.floor(Math.random() * DEFAULT_EMOJIS.length)
  ];
}

/*
|--------------------------------------------------------------------------
| FALLBACK EMOJI
|--------------------------------------------------------------------------
*/

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

  return getRandomDefaultEmoji();
}

/*
|--------------------------------------------------------------------------
| EXTRACT ONE COMPLETE EMOJI
|--------------------------------------------------------------------------
*/

function extractEmoji(text) {
  if (typeof text !== "string") {
    return null;
  }

  const value = text.trim();

  if (!value) {
    return null;
  }

  if (
    typeof Intl !== "undefined" &&
    typeof Intl.Segmenter === "function"
  ) {
    const segmenter = new Intl.Segmenter(
      "en",
      { granularity: "grapheme" }
    );

    for (const item of segmenter.segment(value)) {
      const segment = item.segment;

      if (
        /\p{Extended_Pictographic}/u.test(segment) ||
        /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(segment) ||
        /^[0-9#*]\uFE0F?\u20E3$/u.test(segment)
      ) {
        return segment;
      }
    }

    return null;
  }

  const match = value.match(
    /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u
  );

  return match ? match[0] : null;
}

/*
|--------------------------------------------------------------------------
| BUILD GEMINI PROMPT
|--------------------------------------------------------------------------
*/

function buildPrompt(statusData = {}) {
  const text = String(
    statusData.text ||
    statusData.caption ||
    ""
  ).trim();

  const mediaType = String(
    statusData.mediaType || "text"
  ).toLowerCase();

  let context = "";

  if (text) {
    context =
      `Status text/caption: ${text}\n` +
      `Media type: ${mediaType}`;
  } else if (mediaType === "image") {
    context =
      "The status contains an image. " +
      "Analyze the supplied image if available.";
  } else if (mediaType === "video") {
    context =
      "The status contains a video. " +
      "No video frames or transcript are available.";
  } else if (mediaType === "audio") {
    context =
      "The status contains audio. " +
      "No audio transcript is available.";
  } else {
    context = "The status has no readable text.";
  }

  return [
    "You are the emoji reaction assistant for TOPFEROS MD.",
    "Analyze the meaning and emotional tone of this WhatsApp Status.",
    "Choose exactly ONE appropriate emoji.",
    "Do not invent information about media you cannot inspect.",
    "Return only the emoji.",
    "Do not explain your answer.",
    "",
    context
  ].join("\n");
}

/*
|--------------------------------------------------------------------------
| EXTRACT GEMINI RESPONSE TEXT
|--------------------------------------------------------------------------
*/

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

  const content =
    response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(item => item.text || "")
      .join("")
      .trim();
  }

  if (typeof response.choices?.[0]?.text === "string") {
    return response.choices[0].text.trim();
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| AI TIMEOUT
|--------------------------------------------------------------------------
*/

async function withTimeout(
  promise,
  timeoutMs = AI_TIMEOUT_MS
) {
  let timer;

  try {
    return await Promise.race([
      Promise.resolve(promise),

      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Gemini AI timeout after ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/*
|--------------------------------------------------------------------------
| GEMINI EMOJI SELECTION
|--------------------------------------------------------------------------
*/

async function chooseEmojiWithSource(statusData = {}) {
  const fallback = getFallbackEmoji(statusData);
  const prompt = buildPrompt(statusData);

  const hasImage =
    statusData.mediaType === "image" &&
    Buffer.isBuffer(statusData.media) &&
    statusData.media.length > 0;

  const hasReadableText = Boolean(
    String(
      statusData.text ||
      statusData.caption ||
      ""
    ).trim()
  );

  if (!hasImage && !hasReadableText) {
    return {
      emoji: fallback,
      source: "fallback"
    };
  }

  if (hasImage) {
    try {
      const imageAnswer = await withTimeout(
        askAIWithImage(
          prompt,
          statusData.media,
          statusData.mimeType || "image/jpeg",
          {
            systemPrompt:
              "Analyze the supplied WhatsApp Status image. " +
              "Return exactly one appropriate emoji.",
            temperature: 0.2,
            maxTokens: 128
          }
        )
      );

      const imageEmoji = extractEmoji(
        extractAIText(imageAnswer)
      );

      if (imageEmoji) {
        return {
          emoji: imageEmoji,
          source: "gemini-image"
        };
      }

      console.warn(
        "[STATUS AI] Image response contained no emoji."
      );
    } catch (error) {
      console.error(
        "[STATUS AI] Image analysis failed:",
        error?.message || error
      );
    }
  }

  if (hasReadableText) {
    try {
      const response = await withTimeout(
        askAI(prompt, {
          systemPrompt:
            "Choose exactly one suitable emoji " +
            "for this WhatsApp Status. " +
            "Return only the emoji.",
          temperature: 0.2,
          maxTokens: 128
        })
      );

      const emoji = extractEmoji(
        extractAIText(response)
      );

      if (emoji) {
        return {
          emoji,
          source: "gemini"
        };
      }

      console.warn(
        "[STATUS AI] Text response contained no emoji."
      );
    } catch (error) {
      console.error(
        "[STATUS AI] Gemini failed:",
        error?.message || error
      );
    }
  }

  return {
    emoji: fallback,
    source: "fallback"
  };
}

/*
|--------------------------------------------------------------------------
| CHOOSE EMOJI
|--------------------------------------------------------------------------
*/

async function chooseEmoji(statusData = {}) {
  const result =
    await chooseEmojiWithSource(statusData);

  return result.emoji;
}

/*
|--------------------------------------------------------------------------
| ANALYZE STATUS
|--------------------------------------------------------------------------
*/

async function analyzeStatus(statusData = {}) {
  const result =
    await chooseEmojiWithSource(statusData);

  return {
    emoji: result.emoji,
    source: result.source,
    statusText:
      statusData.text ||
      statusData.caption ||
      "",
    mediaType:
      statusData.mediaType || "text",
    messageId:
      statusData.messageId || null,
    participant:
      statusData.participant || null
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  chooseEmoji,
  chooseEmojiWithSource,
  analyzeStatus,
  extractEmoji,
  extractAIText,
  buildPrompt,
  getFallbackEmoji
};
