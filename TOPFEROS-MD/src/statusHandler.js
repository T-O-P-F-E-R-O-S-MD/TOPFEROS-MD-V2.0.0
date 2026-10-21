"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const {
  getFallbackEmoji
} = require("../services/aiReactionService");

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| STATUS HANDLER
|--------------------------------------------------------------------------
|
| Responsibilities:
| - Detect WhatsApp Status messages
| - Read status text/caption
| - Detect image/video/audio/document status
| - Download supported media
| - Send status information to AI
| - Let AI choose one natural emoji
| - React to the Status immediately
| - Prevent duplicate processing
|
|--------------------------------------------------------------------------
*/

const STATUS_JID =
  "status@broadcast";

/*
|--------------------------------------------------------------------------
| PROCESSED STATUS CACHE
|--------------------------------------------------------------------------
*/

const processedStatuses =
  new Map();

const PROCESS_CACHE_TIME =
  10 * 60 * 1000;

/*
|--------------------------------------------------------------------------
| CLEAN OLD CACHE
|--------------------------------------------------------------------------
*/

function cleanProcessedCache() {
  const now =
    Date.now();

  for (
    const [
      id,
      timestamp
    ] of processedStatuses
  ) {
    if (
      now - timestamp >
      PROCESS_CACHE_TIME
    ) {
      processedStatuses.delete(
        id
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET MESSAGE ID
|--------------------------------------------------------------------------
*/

function getMessageId(
  message
) {
  return (
    message?.key?.id ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| CHECK IF PROCESSED
|--------------------------------------------------------------------------
*/

function hasBeenProcessed(
  messageId
) {
  if (!messageId) {
    return false;
  }

  const timestamp =
    processedStatuses.get(
      messageId
    );

  if (!timestamp) {
    return false;
  }

  if (
    Date.now() -
      timestamp >
    PROCESS_CACHE_TIME
  ) {
    processedStatuses.delete(
      messageId
    );

    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| MARK AS PROCESSED
|--------------------------------------------------------------------------
*/

function markAsProcessed(
  messageId
) {
  if (!messageId) {
    return;
  }

  processedStatuses.set(
    messageId,
    Date.now()
  );

  cleanProcessedCache();
}

/*
|--------------------------------------------------------------------------
| GET STATUS CONTENT
|--------------------------------------------------------------------------
*/

function getStatusContent(
  message
) {
  if (
    !message?.message
  ) {
    return {
      type: "unknown",
      content: null
    };
  }

  const msg =
    message.message;

  if (
    typeof msg.conversation ===
    "string"
  ) {
    return {
      type: "text",
      content:
        msg.conversation
    };
  }

  if (
    msg.extendedTextMessage
  ) {
    return {
      type: "text",
      content:
        msg.extendedTextMessage
          .text || ""
    };
  }

  if (
    msg.imageMessage
  ) {
    return {
      type: "image",
      content:
        msg.imageMessage
    };
  }

  if (
    msg.videoMessage
  ) {
    return {
      type: "video",
      content:
        msg.videoMessage
    };
  }

  if (
    msg.audioMessage
  ) {
    return {
      type: "audio",
      content:
        msg.audioMessage
    };
  }

  if (
    msg.documentMessage
  ) {
    return {
      type: "document",
      content:
        msg.documentMessage
    };
  }

  return {
    type: "unknown",
    content: null
  };
}

/*
|--------------------------------------------------------------------------
| EXTRACT STATUS TEXT
|--------------------------------------------------------------------------
*/

function extractStatusText(
  message
) {
  const content =
    getStatusContent(
      message
    );

  if (
    content.type ===
    "text"
  ) {
    return String(
      content.content ||
        ""
    ).trim();
  }

  if (
    content.type ===
    "image"
  ) {
    return String(
      content.content
        ?.caption ||
        ""
    ).trim();
  }

  if (
    content.type ===
    "video"
  ) {
    return String(
      content.content
        ?.caption ||
        ""
    ).trim();
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD STATUS MEDIA
|--------------------------------------------------------------------------
*/

async function downloadStatusMedia(
  message,
  type
) {
  try {
    const mediaMessage =
      message?.message?.[
        `${type}Message`
      ];

    if (!mediaMessage) {
      return null;
    }

    if (
      ![
        "image",
        "video",
        "audio"
      ].includes(type)
    ) {
      return null;
    }

    const stream =
      await downloadContentFromMessage(
        mediaMessage,
        type
      );

    const chunks = [];

    for await (
      const chunk of stream
    ) {
      chunks.push(
        Buffer.from(chunk)
      );
    }

    return Buffer.concat(
      chunks
    );
  } catch (error) {
    console.error(
      "[STATUS] Media download failed:",
      error?.message ||
        error
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| BUILD AI STATUS DATA
|--------------------------------------------------------------------------
*/

async function buildAIStatusData(
  message
) {
  const content =
    getStatusContent(
      message
    );

  const text =
    extractStatusText(
      message
    );

  let media =
    null;

  if (
    content.type ===
      "image" ||
    content.type ===
      "video" ||
    content.type ===
      "audio"
  ) {
    media =
      await downloadStatusMedia(
        message,
        content.type
      );
  }

  return {
    text,

    caption:
      text,

    mediaType:
      content.type,

    media,

    messageId:
      getMessageId(
        message
      ),

    participant:
      message?.key
        ?.participant ||
      null,

    timestamp:
      message?.messageTimestamp ||
      null
  };
}

/*
|--------------------------------------------------------------------------
| NORMALIZE AI RESULT
|--------------------------------------------------------------------------
*/

function getAIEmoji(
  aiResult
) {
  if (
    typeof aiResult ===
    "string"
  ) {
    return (
      aiResult.trim() ||
      null
    );
  }

  if (
    aiResult &&
    typeof aiResult.emoji ===
      "string"
  ) {
    return (
      aiResult.emoji.trim() ||
      null
    );
  }

  return null;
}
/*
|--------------------------------------------------------------------------
| SEND STATUS REACTION
|--------------------------------------------------------------------------
|
| Personal WhatsApp Status reaction.
|
| The exact Status is identified by
| the original message key.
|
|--------------------------------------------------------------------------
*/

async function sendStatusReaction(sock, message, emoji) {
  if (!sock || !message?.key) {
    throw new Error("Socket or status key missing.");
  }

  const key = message.key;

  if (
    key.remoteJid !== STATUS_JID ||
    !key.participant ||
    !key.id
  ) {
    throw new Error("Invalid WhatsApp Status key.");
  }

  if (typeof emoji !== "string" || !emoji.trim()) {
    throw new Error("Reaction emoji missing.");
  }

  console.log("[STATUS REACT] Attempt:", {
    participant: key.participant,
    messageId: key.id,
    emoji
  });

 const result = await sock.sendMessage(
  STATUS_JID,
  {
    react: {
      text: emoji.trim(),
      key
    }
  },
  {
    statusJidList: []
  }
);

  if (!result?.key?.id) {
    throw new Error("No reaction message ID returned.");
  }

  console.log("[STATUS REACT] Send result:", result.key.id);

  return true;
}

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| AUTO STATUS SEEN + AUTO STATUS REACT
|--------------------------------------------------------------------------
*/

async function processStatus(sock, message, options = {}) {
  if (!sock || !message?.key) {
    return {
      success: false,
      reason: "Socket or message unavailable."
    };
  }

  // Verifye se yon WhatsApp Status.
  if (message.key.remoteJid !== STATUS_JID) {
    return {
      success: false,
      ignored: true,
      reason: "Not a WhatsApp Status."
    };
  }

  // Pa trete pwòp Status bot la.
  if (message.key.fromMe) {
    return {
      success: false,
      ignored: true,
      reason: "Own Status ignored."
    };
  }

  const messageId = getMessageId(message);
  const participant = message.key.participant;

  if (!messageId || !participant) {
    return {
      success: false,
      reason: "Status ID or participant missing."
    };
  }

  // Li Status la otomatikman, sof si opsyon an dezaktive.
  const shouldMarkSeen = options.autoStatusSeen !== false;

  // Reyaji sèlman si opsyon sa a aktive.
  const shouldReact = options.autoStatusReact === true;

  if (!shouldMarkSeen && !shouldReact) {
    return {
      success: false,
      ignored: true,
      reason: "Status automations are disabled."
    };
  }

  const cacheKey = `${participant}:${messageId}`;

  if (hasBeenProcessed(cacheKey)) {
    return {
      success: false,
      ignored: true,
      reason: "Status already processed."
    };
  }

  const content = getStatusContent(message);
  const text = extractStatusText(message);

  const statusData = {
    text,
    caption: text,
    mediaType: content.type,
    messageId,
    participant
  };

  // Make yon sèl tantativ pou li Status la.
  let seen = false;
  let reactionSent = false;
  let emoji = null;
  const errors = [];

  if (shouldMarkSeen) {
    try {
      await sock.readMessages([
        {
          remoteJid: STATUS_JID,
          id: messageId,
          participant
        }
      ]);

      seen = true;

      console.log(
        "[STATUS SEEN] Status marked as seen:",
        messageId
      );
    } catch (error) {
      errors.push(
        `seen: ${error?.message || String(error)}`
      );

      console.error(
        "[STATUS SEEN] Failed:",
        error?.stack || error
      );
    }
  }

  // Reyaksyon an rete apa ak Auto Status Seen.
  if (shouldReact) {
    try {
      emoji = getFallbackEmoji(statusData);

      await sendStatusReaction(
        sock,
        message,
        emoji
      );

      reactionSent = true;

      console.log(
        "[STATUS REACT] Reaction sent:",
        messageId,
        emoji
      );
    } catch (error) {
      errors.push(
        `reaction: ${error?.message || String(error)}`
      );

      console.error(
        "[STATUS REACT] Failed:",
        error?.stack || error
      );
    }
  }

  const success = seen || reactionSent;

// Pa bloke yon lòt tantativ si reyaksyon an echwe.
if (reactionSent) {
  markAsProcessed(cacheKey);
}

  return {
    success,
    messageId,
    participant,
    seen,
    reactionSent,
    emoji,
    errors
  };
}

/*
|--------------------------------------------------------------------------
| HANDLE STATUS UPSERT
|--------------------------------------------------------------------------
*/

async function handleStatusUpsert(
  sock,
  event,
  options = {}
) {
  const messages =
    Array.isArray(
      event?.messages
    )
      ? event.messages
      : [];

  for (
    const message of messages
  ) {
    if (
      message?.key
        ?.remoteJid !==
      STATUS_JID
    ) {
      continue;
    }

    try {
      await processStatus(
        sock,
        message,
        options
      );
    } catch (error) {
      console.error(
        "[STATUS] Processing error:",
        error?.stack ||
          error
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| HANDLE STATUS UPDATE
|--------------------------------------------------------------------------
*/

async function handleStatusUpdate(
  sock,
  updates,
  options = {}
) {
  if (!Array.isArray(updates)) {
    return;
  }

  for (const item of updates) {
    const key =
      item?.key ||
      item?.message?.key ||
      null;

    const content =
      item?.update?.message ||
      item?.message?.message ||
      null;

    if (
      key?.remoteJid !== STATUS_JID ||
      !content
    ) {
      continue;
    }

    const message = {
      key,
      message: content
    };

    try {
      const result = await processStatus(
        sock,
        message,
        options
      );

      console.log(
        "[STATUS UPDATE]",
        result
      );
    } catch (error) {
      console.error(
        "[STATUS] Update processing error:",
        error?.stack || error
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| ATTACH STATUS HANDLER
|--------------------------------------------------------------------------
*/

function attachStatusHandler(
  sock,
  options = {}
) {
  if (!sock) {
    throw new Error(
      "WhatsApp socket is required."
    );
  }

  /*
   * Prevent duplicate listeners.
   */

  if (
    sock.__topferosStatusHandlerAttached
  ) {
    return false;
  }

  sock.__topferosStatusHandlerAttached =
    true;

  /*
   * Primary Status event.
   */

  sock.ev.on(
    "messages.upsert",
    async (
      event
    ) => {
      try {
        await handleStatusUpsert(
          sock,
          event,
          options
        );
      } catch (error) {
        console.error(
          "[STATUS] Upsert handler error:",
          error?.stack ||
            error
        );
      }
    }
  );

  /*
   * Status message updates.
   */

  sock.ev.on(
    "messages.update",
    async (
      updates
    ) => {
      try {
        await handleStatusUpdate(
          sock,
          updates,
          options
        );
      } catch (error) {
        console.error(
          "[STATUS] Update handler error:",
          error?.stack ||
            error
        );
      }
    }
  );

  console.log(
    "[STATUS] 🟢 Auto Status React handler attached."
  );

  return true;
}

/*
|--------------------------------------------------------------------------
| CLEAR PROCESSED CACHE
|--------------------------------------------------------------------------
*/

function clearProcessedStatusCache() {
  processedStatuses.clear();
}

/*
|--------------------------------------------------------------------------
| GET PROCESSED STATUS COUNT
|--------------------------------------------------------------------------
*/

function getProcessedStatusCount() {
  cleanProcessedCache();

  return processedStatuses.size;
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  STATUS_JID,

  processStatus,

  attachStatusHandler,

  handleStatusUpsert,

  handleStatusUpdate,

  sendStatusReaction,

  extractStatusText,

  getStatusContent,

  downloadStatusMedia,

  buildAIStatusData,

  clearProcessedStatusCache,

  getProcessedStatusCount
};