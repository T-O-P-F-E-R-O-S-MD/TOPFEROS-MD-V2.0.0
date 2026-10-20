"use strict";

const {
  getContentType
} = require("@whiskeysockets/baileys");

const config = require("./config");

const sessionManager =
  require("./sessionManager");

const settingPanel =
  require("./settingPanel");

// 🦁 TOPFEROS MD V2.0.0
// VV2 COMMAND CONNECTION

const vv2CommandModule =
  require("../commands/vv2");

const vv2Command =
  vv2CommandModule.execute;

// 🦁 TOPFEROS MD V2.0.0
// VVV COMMAND

const {
  execute: vvvCommand
} = require("../commands/vvv");

const {
  recordOwnerCommand
} = require("./ownerStats");

const {
  attachStatusHandler
} = require("./statusHandler");

const {
  sendMenu
} = require("../commands/menu");

const { helpCommand } = require("../commands/help");
const settingsCommand = require("../commands/settings");

const {
  parrainCommand
} = require("../commands/parrain");

const {
  pairCommand
} = require("../commands/pair");

const {
  startAIChat,
  continueAIChat,
  setLastAIMessage,
  isReplyToLastAIMessage,
  isForwardOfLastAIMessage,
  getForwardQuestion,
  setWaitingForQuestion,
  isWaitingForQuestion,
  hasSession
} = require("../services/aiChat");

const {
  saveCommand,
  sendCommand
} = require("../commands/status");

const {
  playCommand
} = require("../commands/play");

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| MESSAGE HANDLER
|--------------------------------------------------------------------------
*/
const attachedSockets = new WeakSet();
const commands = new Map();


/*
|--------------------------------------------------------------------------
| TOPFEROS MD — RECENT MESSAGE KEYS
|--------------------------------------------------------------------------
*/

const recentMessageKeys = new Map();
const MAX_CACHED_MESSAGES = 5000;

function rememberMessageKey(message, sessionId) {
  try {
    const key = message?.key;
    const jid = key?.remoteJid;
    const id = key?.id;

    if (!jid || !id) {
      return;
    }

    const timestamp = Number(message.messageTimestamp);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }

    const cacheId =
      `${String(sessionId || "")}:${jid}:${id}`;

    recentMessageKeys.set(cacheId, {
      remoteJid: jid,
      id,
      fromMe: Boolean(key.fromMe),
      timestamp,
      ...(key.participant
        ? { participant: key.participant }
        : {})
    });

    while (recentMessageKeys.size > MAX_CACHED_MESSAGES) {
      const oldestKey =
        recentMessageKeys.keys().next().value;

      if (!oldestKey) break;

      recentMessageKeys.delete(oldestKey);
    }
  } catch (error) {
    console.error(
      "[MESSAGE CACHE]",
      error?.message || error
    );
  }
}

function getCachedMessageKey(sessionId, jid, messageId) {
  const cacheId =
    `${String(sessionId || "")}:${jid}:${messageId}`;

  return recentMessageKeys.get(cacheId) || null;
}


/*
|--------------------------------------------------------------------------
| REGISTER COMMAND
|--------------------------------------------------------------------------
*/

function registerCommand(name, handler, options = {}) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  if (!normalized || typeof handler !== "function") {
    throw new TypeError(
      `[TOPFEROS MD] Invalid command registration: ${name}`
    );
  }

  const aliases = Array.isArray(options.aliases)
    ? options.aliases
        .map(alias =>
          String(alias).trim().toLowerCase().replace(/^\./, "")
        )
        .filter(Boolean)
    : [];

  commands.set(normalized, {
    handler,
    aliases,
    description: options.description || "",
    usage: options.usage || "",
    category: options.category || "GENERAL"
  });

  return commands.get(normalized);
}

/*
|--------------------------------------------------------------------------
| FIND COMMAND
|--------------------------------------------------------------------------
*/

function findCommand(
  commandName
) {
  const normalized =
    String(commandName || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "");

  if (
    commands.has(normalized)
  ) {
    return {
      name: normalized,
      command:
        commands.get(normalized)
    };
  }

  for (
    const [
      name,
      command
    ] of commands
  ) {
    if (
      command.aliases.includes(
        normalized
      )
    ) {
      return {
        name,
        command
      };
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0

ANTI BUG MESSAGE GUARD
*/

function isUnsafeMessageStructure(message) {
try {
if (!message || typeof message !== "object") {
return true;
}

if (
  !message.key ||
  typeof message.key !== "object" ||
  !message.message ||
  typeof message.message !== "object" ||
  Array.isArray(message.message)
) {
  return true;
}

const messageText = extractMessageText(
  message.message
);

if (
  typeof messageText === "string" &&
  messageText.length > 20000
) {
  return true;
}

return false;

} catch (error) {
return true;
}
}

/*
|--------------------------------------------------------------------------
| EXTRACT MESSAGE TEXT
|--------------------------------------------------------------------------
*/

function extractMessageText(
  message
) {
  if (!message) {
    return "";
  }

  const type =
    getContentType(message);

  if (
    type === "conversation"
  ) {
    return (
      message.conversation ||
      ""
    ).trim();
  }

  if (
    type === "extendedTextMessage"
  ) {
    return (
      message.extendedTextMessage
        ?.text ||
      ""
    ).trim();
  }

  if (
    type === "imageMessage"
  ) {
    return (
      message.imageMessage
        ?.caption ||
      ""
    ).trim();
  }

  if (
    type === "videoMessage"
  ) {
    return (
      message.videoMessage
        ?.caption ||
      ""
    ).trim();
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| GET MESSAGE TYPE
|--------------------------------------------------------------------------
*/

function getMessageType(
  message
) {
  if (!message) {
    return null;
  }

  return getContentType(
    message
  );
}

/*
|--------------------------------------------------------------------------
| GET CHAT JID
|--------------------------------------------------------------------------
*/

function getChatJid(
  message
) {
  return (
    message?.key?.remoteJid ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| GET SENDER JID
|--------------------------------------------------------------------------
*/

function getSenderJid(
  message
) {
  if (
    message?.key?.participant
  ) {
    return message.key.participant;
  }

  return (
    message?.key?.remoteJid ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| GET BOT JID
|--------------------------------------------------------------------------
*/

function getBotJid(
  sock
) {
  return (
    sock?.user?.id ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZE JID
|--------------------------------------------------------------------------
*/

function normalizeJid(
  jid
) {
  return String(
    jid || ""
  )
    .split(":")[0]
    .trim();
}

/*
|--------------------------------------------------------------------------
| NORMALIZE PHONE NUMBER
|--------------------------------------------------------------------------
*/

function normalizePhone(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /@s\.whatsapp\.net$/i,
      ""
    )
    .replace(
      /[^0-9]/g,
      ""
    );
}

/*
|--------------------------------------------------------------------------
| CHECK OWNER
|--------------------------------------------------------------------------
*/

function isOwner(
  message
) {
  const configuredOwner =
    config?.ownerNumber ||
    config?.owner?.number ||
    config?.bot?.ownerNumber ||
    process.env.OWNER_NUMBER ||
    "";

  const ownerNumber =
    normalizePhone(
      configuredOwner
    );

  if (!ownerNumber) {
    return false;
  }

  const senderNumber =
    normalizePhone(
      getSenderJid(message)
    );

  return Boolean(
    senderNumber &&
    senderNumber === ownerNumber
  );
}

/*
|--------------------------------------------------------------------------
| IS BOT MESSAGE
|--------------------------------------------------------------------------
*/

function isFromBot(
  message,
  sock
) {
  if (
    message?.key?.fromMe
  ) {
    return true;
  }

  const sender =
    normalizeJid(
      getSenderJid(message)
    );

  const bot =
    normalizeJid(
      getBotJid(sock)
    );

  return Boolean(
    sender &&
    bot &&
    sender === bot
  );
}

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0

ANTI BOT FILTER — KNOWN BOT NUMBERS
*/

function getKnownBotNumbers() {
const raw =
process.env.ANTI_BOT_NUMBERS || "";

return new Set(
raw
.split(",")
.map((number) => normalizePhone(number))
.filter(Boolean)
);
}

function isKnownBotSender(message, sock) {
if (isFromBot(message, sock)) {
return true;
}

const senderNumber = normalizePhone(
getSenderJid(message)
);

if (!senderNumber) {
return false;
}

return getKnownBotNumbers().has(senderNumber);
}

/*
|--------------------------------------------------------------------------
| IS GROUP
|--------------------------------------------------------------------------
*/

function isGroup(
  jid
) {
  return String(
    jid || ""
  ).endsWith("@g.us");
}

/*
|--------------------------------------------------------------------------
| IS STATUS
|--------------------------------------------------------------------------
*/

function isStatus(
  jid
) {
  return (
    jid ===
    "status@broadcast"
  );
}

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| GET PREFIX FROM SETTINGS
|--------------------------------------------------------------------------
*/

function getPrefix(sessionId = "") {
  try {
    if (sessionId) {
      const session = sessionManager.getSession(sessionId);

      const savedSettings =
        settingPanel.getSessionSettings(sessionId) || {};

      const prefix = String(
        savedSettings.bot?.prefix ||
        session?.bot?.prefix ||
        config?.bot?.prefix ||
        "."
      ).trim();

      return prefix || ".";
    }
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Prefix loading error:",
      error.stack || error.message
    );
  }

  return String(config?.bot?.prefix || ".").trim() || ".";
}

/*
|--------------------------------------------------------------------------
| PARSE COMMAND USING THE SAVED PREFIX
|--------------------------------------------------------------------------
*/

function parseCommand(text, sessionId = "") {
  const prefix = getPrefix(sessionId);

  const cleanText = String(text || "").trim();

  if (!cleanText.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = cleanText
    .slice(prefix.length)
    .trim();

  if (!withoutPrefix) {
    return null;
  }

  const parts = withoutPrefix.split(/\s+/);

  const command = String(parts.shift() || "")
    .toLowerCase();

  return {
    prefix,
    command,
    args: parts,
    text: parts.join(" "),
    raw: withoutPrefix
  };
}

/*
|--------------------------------------------------------------------------
| SEND TEXT
|--------------------------------------------------------------------------
*/

async function sendText(
  sock,
  jid,
  text,
  options = {}
) {
  if (!sock) {
    throw new Error(
      "WhatsApp socket is required."
    );
  }

  if (!jid) {
    throw new Error(
      "Chat JID is required."
    );
  }

  return sock.sendMessage(
    jid,
    {
      text:
        String(text || "")
    },
    options
  );
}

/*
|--------------------------------------------------------------------------
| SEND REACTION
|--------------------------------------------------------------------------
*/

async function reactToMessage(
  sock,
  message,
  emoji
) {
  if (
    !sock ||
    !message?.key ||
    typeof emoji !== "string" ||
    !emoji.trim()
  ) {
    return false;
  }

  try {
    await sock.sendMessage(
      message.key.remoteJid,
      {
        react: {
          text:
            emoji.trim(),
          key:
            message.key
        }
      }
    );

    return true;
  } catch (error) {
    console.error(
      "[MESSAGE] Reaction failed:",
      error?.message ||
        error
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| GET MODE
|--------------------------------------------------------------------------
*/

function getBotMode() {
  return (
    config?.bot?.mode ||
    "Public"
  );
}

/*
|--------------------------------------------------------------------------
| CHECK MODE
|--------------------------------------------------------------------------
*/

function canProcessMessage(
  message
) {
  const mode =
    String(
      getBotMode()
    )
      .trim()
      .toLowerCase();

  const jid =
    getChatJid(message);

  const group =
    isGroup(jid);

  if (mode === "public") {
    return true;
  }

  if (mode === "private") {
    return !group;
  }

  if (
    mode === "group" ||
    mode === "groups"
  ) {
    return group;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| BUILD COMMAND CONTEXT
|--------------------------------------------------------------------------
*/

function buildContext(
  sock,
  message,
  parsed,
  sessionId = ""
) {
  const jid = getChatJid(message);
  const sender = getSenderJid(message);

  return {
    sock,
    message,
    jid,
    sender,
    sessionId: String(sessionId || ""),

    isGroup: isGroup(jid),
    isStatus: isStatus(jid),
    isOwner: isOwner(message),

    command: parsed?.command || null,
    args: parsed?.args || [],
    text: parsed?.text || "",
    prefix: parsed?.prefix || getPrefix(sessionId),

    bot: config?.bot || {},
    config,

    send: (text, options = {}) =>
      sendText(sock, jid, text, options),

    react: (emoji) =>
      reactToMessage(sock, message, emoji)
  };
}

/*
|--------------------------------------------------------------------------
| COMMAND: MENU
|--------------------------------------------------------------------------
*/

registerCommand(
  "menu",
  async (ctx) => {
    await sendMenu(
      ctx.sock,
      ctx.message
    );

    return {
      success: true
    };
  },
  {
    description:
      "Display the TOPFEROS MD command menu.",

    usage:
      ".menu",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: HELP
|--------------------------------------------------------------------------
*/

registerCommand(
  "help",
  async (ctx) => {
    return helpCommand(ctx);
  },
  {
    aliases: ["h"],
    description: "Display the TOPFEROS MD help guide.",
    usage: ".help",
    category: "SYSTEM"
  }
);
/*
|--------------------------------------------------------------------------
| COMMAND: SETTING
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

registerCommand(
  "setting",
  async (ctx) => {
    return await settingsCommand(ctx);
  },
  {
    aliases: ["settings"],
    description: "Display all bot settings and automation status.",
    usage: ".setting",
    category: "SETTINGS"
  }
);
/*
|--------------------------------------------------------------------------
| COMMAND: PARRAIN
|--------------------------------------------------------------------------
*/

registerCommand(
  "parrain",
  async (ctx) => {
    return parrainCommand(
      ctx.sock,
      ctx.message
    );
  },
  {
    description:
      "Generate a TOPFEROS MD Parrain code.",

    usage:
      ".parrain",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PAIR
|--------------------------------------------------------------------------
*/

registerCommand(
  "pair",
  async (ctx) => {
    return pairCommand(
      ctx.sock,
      ctx.message,
      ctx.args
    );
  },
  {
    description:
      "Create an independent WhatsApp session using a pairing code.",

    usage:
      ".pair <phone number>",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: INFO
|--------------------------------------------------------------------------
*/

registerCommand(
  "info",
  async (ctx) => {
    const bot =
      config?.bot || {};

    const info = `
╭━━━〔 ⚙️ BOT INFORMATION 〕━━━╮
┃
┃ 🦁 Name     : ${bot.name || "TOPFEROS MD"}
┃ 📦 Version  : V${bot.version || "2.0.0"}
┃ 🔹 Prefix   : ${bot.prefix || "."}
┃ 🌐 Mode     : ${bot.mode || "Public"}
┃ 📍 Location : ${bot.location || "HAÏTI"}
┃ 🌎 Language : ${bot.language || "English"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🦁 TECH BY TOPFEROS MD 🐑
`.trim();

    await ctx.send(info);

    return {
      success: true
    };
  },
  {
    description:
      "Display bot information.",

    usage:
      ".info",

    category:
      "SYSTEM"
  }
);


/*
|--------------------------------------------------------------------------
| COMMAND: AI — INTEGRATED CHAT AND FORWARD SYSTEM
|--------------------------------------------------------------------------
*/

function getAIForwardNotice(answer) {
  const text = String(answer || "").toLowerCase();

  if (/[àâçéèêëîïôùûüÿœ]/i.test(text) ||
      /\b(bonjour|merci|vous|votre|réponse|question|continuer)\b/i.test(text)) {
    return "💬 *Pour continuer cette conversation :* Transférez-moi cette réponse ou répondez directement à ce message. 🤖";
  }

  if (/\b(hello|thanks|your|answer|question|continue|please)\b/i.test(text)) {
    return "💬 *To continue this conversation:* Forward this answer back to me or reply directly to this message. 🤖";
  }

  return "💬 *Pou kontinye konvèsasyon an:* Fè *Forward* mesaj sa a tounen ban mwen, oswa reponn dirèkteman sou mesaj sa a. 🤖";
}

registerCommand(
  "ai",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        `🤖 Voye kesyon ou konsa:\n${ctx.prefix}ai Ki sa entèlijans atifisyèl ye?`
      );

      return { success: false };
    }

   try {
  const result = await startAIChat(
    ctx.jid,
    ctx.text
  );

  if (result?.busy) {
    await ctx.send(
      "⏳ AI a ap trete yon kesyon. Tanpri tann."
    );

    return { success: false };
}

      if (!result || !result.answer) {
        await ctx.send("❌ AI a pa retounen yon repons.");
        return { success: false };
      }

      const outgoing =
        `${result.answer}\n\n${getAIForwardNotice(result.answer)}`;

      const sent = await ctx.send(outgoing);

      setLastAIMessage(
        ctx.jid,
        sent?.key?.id || null,
        outgoing
      );

      return {
        success: true,
        answer: result.answer
      };
    } catch (error) {
      console.error("[AI CHAT]", error?.stack || error);

      await ctx.send(
        "❌ Mwen pa kapab reponn kounye a. Verifye konfigirasyon Gemini API a epi eseye ankò."
      );

      return { success: false };
    }
  },
  {
    description: "Start a new AI conversation.",
    usage: ".ai <question>",
    category: "AI"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PROMPT
|--------------------------------------------------------------------------
*/

registerCommand(
  "prompt",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        [
          "🤖 Please provide a prompt request.",
          "",
          `Example: ${ctx.prefix}prompt Create a cinematic lion logo`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false
      };
    }

    await ctx.send(
      [
        "🤖 PROMPT REQUEST RECEIVED",
        "",
        `📝 ${ctx.text}`,
        "",
        "⚙️ Prompt AI service is not connected yet.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      pending: true
    };
  },
  {
    description:
      "Generate or improve an AI prompt.",

    usage:
      ".prompt <request>",

    category:
      "AI"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PLAY
|--------------------------------------------------------------------------
*/

registerCommand(
  "play",
  async (ctx) => {
    return playCommand(ctx);
  },
  {
    description:
      "Download and send authorized audio or video media.",

    usage:
      ".play <song|video> <direct-url>",

    category:
      "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: VV2
|--------------------------------------------------------------------------
*/

registerCommand(
  "vv2",
  async (ctx) => {
    return vv2Command(ctx);
  },
  {
    description: "Trete medya nòmal ki site nan mesaj la.",
    usage: ".vv2",
    category: "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: VV2
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

registerCommand(
  vv2CommandModule.name,
  async (ctx) => {
    return await vv2Command(ctx);
  },
  {
    aliases: vv2CommandModule.aliases,
    description: vv2CommandModule.description,
    usage: vv2CommandModule.usage,
    category: "MEDIA"
  }
);


/*
|--------------------------------------------------------------------------
| COMMAND: VVV
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

registerCommand(
  "vvv",
  async (ctx) => {
    await vvvCommand(ctx);
  },
  {
    aliases: [],
    description: "Send media to chat and DM",
    usage: ".vvv",
    category: "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: VIDEO
|--------------------------------------------------------------------------
*/

registerCommand(
  "video",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        [
          "🎬 Please provide a video URL.",
          "",
          `Example: ${ctx.prefix}video https://example.com/video`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false
      };
    }

    await ctx.send(
      [
        "🎬 VIDEO REQUEST RECEIVED",
        "",
        `🔗 ${ctx.text}`,
        "",
        "⚙️ Video service is not connected yet.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      pending: true
    };
  },
  {
    description:
      "Download and send a video.",

    usage:
      ".video <url>",

    category:
      "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| ATTACH STATUS AI
|--------------------------------------------------------------------------
*/

function attachStatusAI(
  sock,
  options = {}
) {
  if (!sock) {
    throw new Error(
      "WhatsApp socket is required."
    );
  }

  if (
    attachedSockets.has(sock)
  ) {
    return false;
  }

  if (
    options.enabled === false
  ) {
    return false;
  }

  attachStatusHandler(
    sock,
    {
      autoStatusReact:
        options.autoStatusReact !== false,

      autoStatusSeen:
        options.autoStatusSeen !== false,

      autoStatusReply:
        options.autoStatusReply !== false
    }
  );

  attachedSockets.add(
    sock
  );

  return true;
}


/*
|--------------------------------------------------------------------------
| AUTO TYPING / AUTO RECORDING
|--------------------------------------------------------------------------
*/

async function startAutoPresence(sock, sessionId, jid) {
  try {
    if (!sock || !sessionId || !jid) {
      return null;
    }

    const settings =
      settingPanel.getSessionSettings(sessionId);

    const automation = settings?.automation || {};

    let presence = null;

    if (automation.fakeRecording === true) {
      presence = "recording";
    } else if (automation.fakeTyping === true) {
      presence = "composing";
    }

    if (!presence) {
      return null;
    }

    await sock.sendPresenceUpdate(presence, jid);

    return presence;
  } catch (error) {
    console.error(
      "[AUTO PRESENCE] Start failed:",
      error?.message || error
    );

    return null;
  }
}

async function stopAutoPresence(sock, jid, presence) {
  if (!sock || !jid || !presence) {
    return;
  }

  try {
    await sock.sendPresenceUpdate("paused", jid);
  } catch (error) {
    console.error(
      "[AUTO PRESENCE] Stop failed:",
      error?.message || error
    );
  }
}


/*
|--------------------------------------------------------------------------
| HANDLE MESSAGE
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

async function handleMessage(sock, message, sessionId) {
  try {
    /*
     * Validate socket and message.
     */
    if (!sock || !message) {
      return {
        success: false,
        reason: "Invalid message."
      };
    }

    rememberMessageKey(message, sessionId);

    /*
    |--------------------------------------------------------------------------
    | ANTI BUG GUARD
    |--------------------------------------------------------------------------
    */

    try {
      const currentSettings =
        settingPanel.getSessionSettings(sessionId) || {};

      const automation =
        currentSettings.automation || {};

      if (
        automation.antiBug === true &&
        isUnsafeMessageStructure(message)
      ) {
        return {
          success: false,
          ignored: true,
          reason: "Anti Bug: invalid message structure."
        };
      }
    } catch (error) {
      console.error(
        "[TOPFEROS MD] Anti Bug error:",
        error?.message || error
      );
    }

    /*
    |--------------------------------------------------------------------------
    | IGNORE BOT MESSAGES
    |--------------------------------------------------------------------------
    */

    if (
      !message?.key?.fromMe &&
      isFromBot(message, sock)
    ) {
      return {
        success: false,
        ignored: true,
        reason: "Message originated from bot."
      };
    }

    const jid = getChatJid(message);

    /*
    |--------------------------------------------------------------------------
    | STATUS HANDLER
    |--------------------------------------------------------------------------
    */

    if (isStatus(jid)) {
      return {
        success: false,
        ignored: true,
        reason: "Status handled by statusHandler."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | BOT MODE
    |--------------------------------------------------------------------------
    */

    if (!canProcessMessage(message)) {
      return {
        success: false,
        ignored: true,
        reason: "Message not allowed in current bot mode."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | ANTI BOT FILTER — SAFE PREPARATION
    |--------------------------------------------------------------------------
    */

    const filterSettings =
      settingPanel.getSessionSettings(sessionId) || {};

    const filterAutomation =
      filterSettings.automation || {};

    if (filterAutomation.antiBotFilter === true) {
      // Bot detection is not connected yet.
      // Do not delete or warn users based on guesses.
    }

    /*
    |--------------------------------------------------------------------------
    | AUTO VIEW ONCE IN PRIVATE DM
    |--------------------------------------------------------------------------
    */

    if (
      !isGroup(jid) &&
      !isStatus(jid) &&
      !message?.key?.fromMe &&
      typeof handleAutoViewOnce === "function"
    ) {
      try {
        const autoViewOnce =
          await handleAutoViewOnce(sock, message);

        if (autoViewOnce?.success) {
          return {
            success: true,
            command: "auto-viewonce",
            result: autoViewOnce,
            sessionId: sessionId || null
          };
        }
      } catch (error) {
        console.error(
          "[AUTO VIEW ONCE]",
          error?.stack || error
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EXTRACT MESSAGE TEXT
    |--------------------------------------------------------------------------
    */

    const messageText =
      extractMessageText(message.message);

    /*
    |--------------------------------------------------------------------------
    | CONTINUE AI CHAT THROUGH REPLY OR FORWARD
    |--------------------------------------------------------------------------
    */

    if (
      !message?.key?.fromMe &&
      messageText &&
      hasSession(jid)
    ) {
      const contextInfo =
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        {};

      const quotedMessageId = contextInfo.stanzaId;

      const isReply = isReplyToLastAIMessage(
        jid,
        quotedMessageId
      );

      const isForwarded = Boolean(
        contextInfo.isForwarded ||
        Number(contextInfo.forwardingScore || 0) > 0
      );

      
const forwardQuestion = getForwardQuestion(
  jid,
  messageText
);

const isAIForward =
  isForwarded && forwardQuestion !== null;

      const parsedAICommand =
        parseCommand(messageText, sessionId);

      const isCommand = Boolean(parsedAICommand);

      const waiting = isWaitingForQuestion(jid);

      if (isAIForward && !forwardQuestion) {
        setWaitingForQuestion(jid, true);

        await sendText(
          sock,
          jid,
          "🤖 Mwen rekonèt repons AI ou transfere a. " +
          "Voye pwochen kesyon ou san prefix .ai."
        );

        return {
          success: true,
          command: "ai-forward-waiting"
        };
      }

      const shouldContinue =
        isReply ||
        (isAIForward && Boolean(forwardQuestion)) ||
        (waiting && !isCommand);

      if (shouldContinue) {
        const continuationText =
          isAIForward && forwardQuestion
            ? forwardQuestion
            : messageText;

        try {
          const result = await continueAIChat(
            jid,
            continuationText
          );

          if (result?.busy) {
            await sendText(
              sock,
              jid,
              "⏳ AI a ap trete yon kesyon. Tanpri tann."
            );

            return {
              success: false,
              reason: "AI session busy."
            };
          }

          if (result?.answer) {
            const outgoing =
              `${result.answer}\n\n${getAIForwardNotice(result.answer)}`;

            const sent = await sendText(
              sock,
              jid,
              outgoing
            );

            setLastAIMessage(
              jid,
              sent?.key?.id || null,
              outgoing
            );

            setWaitingForQuestion(jid, false);

            return {
              success: true,
              command: "ai-continue"
            };
          }
        } catch (error) {
          console.error(
            "[AI CHAT CONTINUE]",
            error?.stack || error
          );

          await sendText(
            sock,
            jid,
            "❌ AI a pa kapab kontinye kounye a. Eseye ankò."
          );

          return {
            success: false,
            reason: "AI continuation failed."
          };
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | COMMANDS: SAVE / SEND WITHOUT PREFIX
    |--------------------------------------------------------------------------
    */

    const plainCommand =
      (messageText || "").trim().toLowerCase();

    if (
      !message?.key?.fromMe &&
      ["save", "send"].includes(plainCommand)
    ) {
      const found = findCommand(plainCommand);

      if (found) {
        const context = buildContext(
          sock,
          message,
          {
            command: plainCommand,
            args: [],
            text: "",
            prefix: ""
          },
          sessionId
        );

        await found.command.handler(context);

        return {
          success: true,
          command: plainCommand,
          sessionId: sessionId || null
        };
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IGNORE MESSAGES WITHOUT COMMAND TEXT
    |--------------------------------------------------------------------------
    */

    if (!messageText) {
      return {
        success: false,
        ignored: true,
        reason: "No command text."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | PARSE COMMAND
    |--------------------------------------------------------------------------
    */

    const parsed =
      parseCommand(messageText, sessionId);

    if (!parsed) {
      return {
        success: false,
        ignored: true,
        reason: "Not a command."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | FIND COMMAND
    |--------------------------------------------------------------------------
    */

    const found = findCommand(parsed.command);

    if (!found) {
      await sendText(
        sock,
        jid,
        [
          `❌ Unknown command: ${getPrefix(sessionId)}${parsed.command}`,
          "",
          `📖 Type ${getPrefix(sessionId)}menu to see available commands.`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false,
        reason: "Unknown command."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | BUILD COMMAND CONTEXT
    |--------------------------------------------------------------------------
    */

    const context = buildContext(
      sock,
      message,
      parsed,
      sessionId
    );

    await reactToMessage(
      sock,
      message,
      "🦁"
    );

    /*
    |--------------------------------------------------------------------------
    | OWNER COMMAND STATISTICS
    |--------------------------------------------------------------------------
    */

    if (context.isOwner) {
      try {
        const ownerStats =
          recordOwnerCommand(found.name);

        context.bot.ownerStats = ownerStats;
      } catch (statsError) {
        console.error(
          "[OWNER STATS] Record failed:",
          statsError?.stack || statsError
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EXECUTE COMMAND WITH AUTO TYPING / RECORDING
    |--------------------------------------------------------------------------
    */

    const presence = await startAutoPresence(
      sock,
      sessionId,
      jid
    );

    let result;

    try {
      result = await found.command.handler(context);
    } finally {
      await stopAutoPresence(
        sock,
        jid,
        presence
      );
    }

    return {
      success: true,
      command: found.name,
      result,
      sessionId: sessionId || null
    };

  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | ERROR LOGGING — NO AUTOMATIC ERROR MESSAGE TO CONTACTS
    |--------------------------------------------------------------------------
    */

    console.error(
      "[MESSAGE HANDLER] Error:",
      error?.stack || error
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }
}

/*
|--------------------------------------------------------------------------
| GET REGISTERED COMMANDS
|--------------------------------------------------------------------------
*/

function getCommands() {
  const result = [];

  for (
    const [
      name,
      command
    ] of commands
  ) {
    result.push({
      name,

      aliases:
        [...command.aliases],

      description:
        command.description,

      usage:
        command.usage,

      category:
        command.category
    });
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| COMMANDS: SAVE / SEND
|--------------------------------------------------------------------------
*/

registerCommand("save", saveCommand, {
  description: "Identify a quoted WhatsApp Status.",
  usage: "save",
  category: "STATUS"
});

registerCommand("send", sendCommand, {
  description: "Identify a quoted WhatsApp Status.",
  usage: "send",
  category: "STATUS"
});

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  handleMessage,

  registerCommand,

  findCommand,

  getCommands,

  parseCommand,

  extractMessageText,

  getMessageType,

  getChatJid,

  getSenderJid,

  isGroup,

  isStatus,

  isFromBot,

  sendText,

  reactToMessage,

  attachStatusAI,

  isOwner,

rememberMessageKey,
getCachedMessageKey,
};