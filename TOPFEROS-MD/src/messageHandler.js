"use strict";

const {
  getContentType
} = require("@whiskeysockets/baileys");

const config = require("./config");

const sessionManager =
  require("./sessionManager");

const {
  recordOwnerCommand
} = require("./ownerStats");

const {
  handleAutoViewOnce
} = require("../services/viewOnce");

const {
  attachStatusHandler
} = require("./statusHandler");

const {
  sendMenu
} = require("../commands/menu");

const {
  parrainCommand
} = require("../commands/parrain");

const {
  pairCommand
} = require("../commands/pair");

const {
  aiCommand
} = require("../commands/ai");

const {
  playCommand
} = require("../commands/play");

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| MESSAGE HANDLER
|--------------------------------------------------------------------------
*/

const attachedSockets =
  new WeakSet();

const commands =
  new Map();

/*
|--------------------------------------------------------------------------
| REGISTER COMMAND
|--------------------------------------------------------------------------
*/

function registerCommand(
  name,
  handler,
  options = {}
) {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    throw new Error(
      "Command name is required."
    );
  }

  if (
    typeof handler !== "function"
  ) {
    throw new Error(
      `Handler for .${name} must be a function.`
    );
  }

  const commandName =
    name
      .trim()
      .toLowerCase()
      .replace(/^\./, "");

  const aliases =
    Array.isArray(options.aliases)
      ? options.aliases
          .map((alias) =>
            String(alias)
              .trim()
              .toLowerCase()
              .replace(/^\./, "")
          )
          .filter(Boolean)
      : [];

  commands.set(
    commandName,
    {
      handler,
      aliases,
      description:
        options.description || "",
      usage:
        options.usage ||
        `.${commandName}`,
      category:
        options.category ||
        "GENERAL"
    }
  );
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
| GET PREFIX
|--------------------------------------------------------------------------
*/

function getPrefix(
  sessionId = ""
) {
  if (sessionId) {
    try {
      const session =
        sessionManager.getSession(
          sessionId
        );

      const sessionPrefix =
        String(
          session?.bot?.prefix ||
          ""
        ).trim();

      if (sessionPrefix) {
        return sessionPrefix;
      }
    } catch {
      // Fall back to global configuration.
    }
  }

  return (
    config?.bot?.prefix ||
    "."
  );
}

/*
|--------------------------------------------------------------------------
| PARSE COMMAND
|--------------------------------------------------------------------------
*/

function parseCommand(
  text,
  sessionId = ""
) {
  const prefix =
  getPrefix(
    sessionId
  );

  const cleanText =
    String(text || "")
      .trim();

  if (
    !cleanText.startsWith(
      prefix
    )
  ) {
    return null;
  }

  const withoutPrefix =
    cleanText
      .slice(prefix.length)
      .trim();

  if (!withoutPrefix) {
    return null;
  }

  const parts =
    withoutPrefix.split(
      /\s+/
    );

  const command =
    String(
      parts.shift() || ""
    ).toLowerCase();

  return {
    prefix,
    command,
    args: parts,
    text:
      parts.join(" "),
    raw:
      withoutPrefix
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
  parsed
) {
  const jid =
    getChatJid(message);

  const sender =
    getSenderJid(message);

  return {
    sock,

    message,

    jid,

    sender,

    isGroup:
      isGroup(jid),

    isStatus:
      isStatus(jid),

    isOwner:
      isOwner(message),

    command:
      parsed?.command ||
      null,

    args:
      parsed?.args ||
      [],

    text:
      parsed?.text ||
      "",

    prefix:
      parsed?.prefix ||
      getPrefix(),

    bot:
      config?.bot ||
      {},

    config,

    send:
      (text, options = {}) =>
        sendText(
          sock,
          jid,
          text,
          options
        ),

    react:
      (emoji) =>
        reactToMessage(
          sock,
          message,
          emoji
        )
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
| COMMAND: AI
|--------------------------------------------------------------------------
*/

registerCommand(
  "ai",
  async (ctx) => {
    return aiCommand(ctx);
  },
  {
    description:
      "Ask the TOPFEROS AI assistant.",

    usage:
      ".ai <question>",

    category:
      "AI"
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
| COMMAND: SETTING
|--------------------------------------------------------------------------
*/

registerCommand(
  "setting",
  async (ctx) => {
    const panelUrl =
      config?.panels?.settingsUrl ||
      process.env.SETTINGS_PANEL_URL ||
      "";

    if (!panelUrl) {
      await ctx.send(
        [
          "⚙️ TOPFEROS MD SETTINGS",
          "",
          "❌ The Settings Panel URL has not been configured yet.",
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
        "⚙️ TOPFEROS MD SETTINGS",
        "",
        "🔗 Open the Settings Panel:",
        panelUrl,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      url: panelUrl
    };
  },
  {
    description:
      "Open the TOPFEROS MD Settings Panel.",

    usage:
      ".setting",

    category:
      "SETTINGS"
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
| HANDLE MESSAGE
|--------------------------------------------------------------------------
*/

async function handleMessage(
  sock,
  message,
  sessionId
) {
  try {
    if (
      !sock ||
      !message
    ) {
      return {
        success: false,
        reason:
          "Invalid message."
      };
    }

    /*
     * Ignore messages sent by the bot.
     */

    if (
  !message?.key?.fromMe &&
  isFromBot(
    message,
    sock
  )
) {
  return {
    success: false,
    ignored: true,
    reason:
      "Message originated from bot."
  };
}

    const jid =
      getChatJid(message);

    /*
     * Status is handled separately.
     */

    if (
      isStatus(jid)
    ) {
      return {
        success: false,
        ignored: true,
        reason:
          "Status handled by statusHandler."
      };
    }

    /*
     * Check bot mode.
     */

    if (
      !canProcessMessage(
        message
      )
    ) {
      return {
        success: false,
        ignored: true,
        reason:
          "Message not allowed in current bot mode."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | AUTO VIEW ONCE IN PRIVATE DM
    |--------------------------------------------------------------------------
    */

    if (
      !isGroup(jid) &&
      !isStatus(jid) &&
      !message?.key?.fromMe
    ) {
      const autoViewOnce =
        await handleAutoViewOnce(
          sock,
          message
        );

      if (
        autoViewOnce?.success
      ) {
      return {
  success: true,
  command: "auto-viewonce",
  result: autoViewOnce,
  sessionId: sessionId || null
};  
      }
    }

    /*
     * Extract message text.
     */

    const messageText =
      extractMessageText(
        message.message
      );

    if (
      !messageText
    ) {
      return {
        success: false,
        ignored: true,
        reason:
          "No command text."
      };
    }

    /*
     * Parse command.
     */

    const parsed =
  parseCommand(
    messageText,
    sessionId
  );

    if (!parsed) {
      return {
        success: false,
        ignored: true,
        reason:
          "Not a command."
      };
    }

    /*
     * Find command.
     */

    const found =
      findCommand(
        parsed.command
      );

    if (!found) {
      await sendText(
        sock,
        jid,
        [
          `❌ Unknown command: ${getPrefix()}${parsed.command}`,
          "",
          `📖 Type ${getPrefix()}menu to see available commands.`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false,
        reason:
          "Unknown command."
      };
    }

    /*
     * Build command context.
     */

    const context =
      buildContext(
        sock,
        message,
        parsed
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
    |
    | Only valid registered commands used by
    | the configured OWNER are counted.
    |
    |--------------------------------------------------------------------------
    */

    if (
      context.isOwner
    ) {
      try {
        const ownerStats =
          recordOwnerCommand(
            found.name
          );

        /*
         * Keep the latest statistics
         * available to the command context.
         */

        context.bot.ownerStats =
          ownerStats;
      } catch (statsError) {
        console.error(
          "[OWNER STATS] Record failed:",
          statsError?.stack ||
            statsError
        );
      }
    }

    /*
     * Execute command.
     */

    const result =
      await found.command.handler(
        context
      );

    return {
      success: true,

      command:
        found.name,

      result,

      sessionId:
        sessionId || null
    };
  } catch (error) {
    console.error(
      "[MESSAGE HANDLER] Error:",
      error?.stack ||
        error
    );

    try {
      const jid =
        getChatJid(
          message
        );

      if (jid) {
        await sendText(
          sock,
          jid,
          [
            "❌ An error occurred while processing your request.",
            "",
            "🦁 TECH BY TOPFEROS MD 🐑"
          ].join("\n")
        );
      }
    } catch {
      /*
       * Do not throw a second error.
       */
    }

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

  isOwner
};