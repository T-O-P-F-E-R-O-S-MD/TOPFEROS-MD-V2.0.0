"use strict";

const path = require("path");
const fs = require("fs");
const pino = require("pino");

const {
  translatePayload
} = require("./whatsappTranslator");

const settingPanel =
  require("./settingPanel");

const antiDelete =
  require("../services/antiDelete");

const baileys = require("@whiskeysockets/baileys");

const makeWASocket = baileys.default;

const {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = baileys;

const config = require("./config");

const sessionManager = require("./sessionManager");

const {
  handleMessage
} = require("./messageHandler");

const {
  attachStatusHandler
} = require("./statusHandler");
/*
|--------------------------------------------------------------------------
| LOGGER
|--------------------------------------------------------------------------
*/

const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    "info"
});

/*
|--------------------------------------------------------------------------
| MESSAGE RETRY STORE
|--------------------------------------------------------------------------
*/

const MESSAGE_CACHE_LIMIT = 500;
const messageCache = new Map();

function cacheMessage(message) {
  const key = message?.key;

  if (!key?.remoteJid || !key?.id || !message?.message) {
    return;
  }

  const cacheKey = `${key.remoteJid}:${key.id}`;

  // Mete dènye mesaj la nan fen Map la.
  messageCache.delete(cacheKey);
  messageCache.set(cacheKey, message.message);

  // Limite memwa a pou li pa grandi san limit.
  while (messageCache.size > MESSAGE_CACHE_LIMIT) {
    const oldestKey = messageCache.keys().next().value;
    messageCache.delete(oldestKey);
  }
}

async function getCachedMessage(key) {
  if (!key?.remoteJid || !key?.id) {
    return undefined;
  }

  return messageCache.get(`${key.remoteJid}:${key.id}`);
}

/*
|--------------------------------------------------------------------------
| SESSION DIRECTORY
|--------------------------------------------------------------------------
*/

const SESSIONS_DIR =
  path.resolve(
    config?.session?.directory ||
      process.env.SESSIONS_DIR ||
      path.join(
        process.cwd(),
        "sessions"
      )
  );

if (
  !fs.existsSync(
    SESSIONS_DIR
  )
) {
  fs.mkdirSync(
    SESSIONS_DIR,
    {
      recursive: true
    }
  );
}

/*
|--------------------------------------------------------------------------
| ACTIVE SESSIONS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| src/sessionManager.js is the single
| source of truth for active V2 sessions.
|
| Credentials remain on disk when a session
| is removed from active memory.
|--------------------------------------------------------------------------
*/

const activeSessions = {
  get(sessionId) {
    return sessionManager.getSession(
      sessionId
    );
  },

  set(sessionId, session) {
    return sessionManager.registerSession(
      sessionId,
      session
    );
  },

  delete(sessionId) {
    return Boolean(
      sessionManager.removeSession(
        sessionId
      )
    );
  },

  has(sessionId) {
    return sessionManager.hasSession(
      sessionId
    );
  },

  keys() {
    return sessionManager
      .getActiveSessions()
      .map(
        (session) =>
          session.sessionId
      )[Symbol.iterator]();
  }
};

const reconnectTimers =
  new Map();

const manuallyStopped =
  new Set();

/*
|--------------------------------------------------------------------------
| DEFAULT AUTOMATIONS
|--------------------------------------------------------------------------
*/

function getDefaultAutomationSettings() {
  const automation =
    config?.automation || {};

  return {
    alwaysOnline:
      automation.alwaysOnline === true,

    fakeTyping:
      automation.fakeTyping === true,

    fakeRecording:
      automation.fakeRecording === true,

    autoStatusSeen:
      automation.autoStatusSeen !== false,

    autoStatusReply:
      automation.autoStatusReply !== false,

    autoStatusReact:
      automation.autoStatusReact !== false,

    antiDelete:
      automation.antiDelete !== false,

    antiDeleteMode:
      automation.antiDeleteMode ||
      "private",

    antiCall:
      automation.antiCall === true,

    antiBug:
      automation.antiBug === true,

    antiBotFilter:
      automation.antiBotFilter === true,

    antiBotAction:
      automation.antiBotAction ||
      "Delete",

    antiBlock:
      Array.isArray(
        config?.security
          ?.antiBlockNumbers
      )
        ? [
            ...config.security
              .antiBlockNumbers
          ]
        : []
  };
}

/*
|--------------------------------------------------------------------------
| NORMALIZE NUMBER
|--------------------------------------------------------------------------
*/

function normalizeNumber(number) {
  return String(
    number || ""
  )
    .replace(/\D/g, "")
    .trim();
}

/*
|--------------------------------------------------------------------------
| SESSION ID
|--------------------------------------------------------------------------
*/

function getSessionId(number) {
  const sessionId =
    normalizeNumber(number);

  if (!sessionId) {
    throw new Error(
      "A valid WhatsApp number is required."
    );
  }

  return sessionId;
}

/*
|--------------------------------------------------------------------------
| SESSION PATH
|--------------------------------------------------------------------------
*/

function getSessionPath(
  sessionId
) {
  return path.join(
    SESSIONS_DIR,
    sessionId
  );
}

/*
|--------------------------------------------------------------------------
| GET SESSION
|--------------------------------------------------------------------------
*/

function getSession(
  sessionId
) {
  return activeSessions.get(
    String(sessionId)
  );
}

/*
|--------------------------------------------------------------------------
| GET ACTIVE SESSIONS
|--------------------------------------------------------------------------
*/

function getActiveSessions() {
  return activeSessions;
}

/*
|--------------------------------------------------------------------------
| GET SESSION QR
|--------------------------------------------------------------------------
*/

function getSessionQR(
  number
) {
  const sessionId =
    getSessionId(number);

  const session =
    activeSessions.get(
      sessionId
    );

  return (
    session?.qr ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| CHECK CONNECTION
|--------------------------------------------------------------------------
*/

function isConnected(
  number
) {
  const sessionId =
    getSessionId(number);

  const session =
    activeSessions.get(
      sessionId
    );

  return (
    session?.connected === true
  );
}

/*
|--------------------------------------------------------------------------
| GET SESSION AUTOMATION
|--------------------------------------------------------------------------
*/

function getSessionAutomation(
  number
) {
  const sessionId =
    getSessionId(number);

  const session =
    activeSessions.get(
      sessionId
    );

  if (!session) {
    return null;
  }

  return {
    ...session.automation
  };
}

/*
|--------------------------------------------------------------------------
| UPDATE SESSION AUTOMATION
|--------------------------------------------------------------------------
*/

function updateSessionAutomation(
  number,
  updates = {}
) {
  const sessionId =
    getSessionId(number);

  const session =
    activeSessions.get(
      sessionId
    );

  if (!session) {
    return null;
  }

  session.automation = {
    ...session.automation,
    ...updates
  };

  session.automation.alwaysOnline =
    session.automation.alwaysOnline === true;

  session.automation.fakeTyping =
    session.automation.fakeTyping === true;

  session.automation.fakeRecording =
    session.automation.fakeRecording === true;

  session.automation.autoStatusSeen =
    session.automation.autoStatusSeen !== false;

  session.automation.autoStatusReply =
    session.automation.autoStatusReply !== false;

  session.automation.autoStatusReact =
    session.automation.autoStatusReact !== false;

  session.automation.antiDelete =
    session.automation.antiDelete !== false;

  session.automation.antiCall =
    session.automation.antiCall === true;

  session.automation.antiBug =
    session.automation.antiBug === true;

  session.automation.antiBotFilter =
    session.automation.antiBotFilter === true;

  return {
    ...session.automation
  };
}

/*
|--------------------------------------------------------------------------
| WELCOME MESSAGE
|--------------------------------------------------------------------------
*/

function createWelcomeMessage(
  userNumber
) {
  const user =
    String(
      userNumber || ""
    ).replace(
      /\D/g,
      ""
    );

  const botName =
    config?.bot?.name ||
    "TOPFEROS MD";

  const botVersion =
    config?.bot?.version ||
    "2.0.0";

  const prefix =
    config?.bot?.prefix ||
    ".";

  const mode =
    config?.bot?.mode ||
    "Public";

  const language =
    config?.bot?.language ||
    "English";

  const footer =
    config?.bot?.footer ||
    "🦁 TECH BY TOPFEROS MD 🐑";

 return `
╭━━━〔 🦁 TOPFEROS MD V2.0.0 🐑 〕━━━╮
┃
┃ 🎉 WELCOME TO TOPFEROS MD
┃
┃ 🟢 CONNECTION SUCCESSFUL
┃
┃ 👤 USER
┃ └─ @${user}
┃
┃ 🟢 STATUS: ONLINE & READY
┃
┃ ⚙️ BOT INFORMATION
┃ ├─ Name     : ${botName}
┃ ├─ Version  : V${botVersion}
┃ ├─ Prefix   : ${prefix}
┃ ├─ Mode     : ${mode}
┃ └─ Language : ${language}
┃
┃ ✨ AVAILABLE FEATURES
┃
┃ 👥 GROUP
┃ ├─ Group Management
┃ ├─ Group Rules
┃ ├─ Warning System
┃ └─ Group Automation
┃
┃ 🛡️ SECURITY
┃ ├─ Anti-Delete
┃ ├─ Anti-Call
┃ ├─ Anti-Bug Protection
┃ ├─ Anti-Bot Filter
┃ └─ Anti-Block
┃
┃ ⚡ AUTOMATION
┃ ├─ Always Online
┃ ├─ Auto Status
┃ ├─ Auto Reply
┃ ├─ Auto React
┃ ├─ Fake Typing
┃ └─ Fake Recording
┃
┃ 🤖 AI
┃ └─ AI Assistant & Prompt System
┃
┃ 🎵 MEDIA
┃ ├─ Music Search & Download
┃ ├─ Video Download
┃ └─ Media Tools
┃
┃ ⚙️ SYSTEM
┃ ├─ Multi-Session
┃ ├─ Language System
┃ └─ Custom Configuration
┃
┃ 📖 COMMANDS
┃ └─ Type ${prefix}menu to explore
┃
┃ ⚙️ SETTINGS
┃ └─ Type ${prefix}setting to configure
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${footer}
`;
}

/*
|--------------------------------------------------------------------------
| SEND WELCOME MESSAGE WITH BOT LOGO
|--------------------------------------------------------------------------
*/

async function sendWelcomeMessage(
  sock,
  sessionId
) {
  try {
    if (!sock?.user?.id) {
      logger.warn(
        `[${sessionId}] Cannot send welcome message: bot JID unavailable.`
      );
      return false;
    }

    const jid =
      sock.user.id.split(":")[0] +
      "@s.whatsapp.net";

    const message =
      createWelcomeMessage(sessionId);

    const logoPath = path.join(
      __dirname,
      "..",
      "assets",
      "logo.png"
    );

    if (fs.existsSync(logoPath)) {
      const logo = await fs.promises.readFile(
        logoPath
      );

      await sock.sendMessage(jid, {
        image: logo,
        caption: message,
        mentions: [jid]
      });
    } else {
      logger.warn(
        `[${sessionId}] Bot logo not found: ${logoPath}`
      );

      await sock.sendMessage(jid, {
        text: message,
        mentions: [jid]
      });
    }

    logger.info(
      `[${sessionId}] Welcome message sent.`
    );

    return true;
  } catch (error) {
    logger.error(
      {
        error:
          error?.stack ||
          error?.message ||
          String(error)
      },
      `[${sessionId}] Failed to send welcome message.`
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| WAIT FOR PAIRING READY
|--------------------------------------------------------------------------
*/
function waitForPairingReady(
  sock,
  sessionId,
  timeoutMs = 5000
) {
  return new Promise((resolve, reject) => {
    let finished = false;

    function cleanup() {
      clearTimeout(timer);
      sock.ev.off(
        "connection.update",
        onUpdate
      );
    }

    function finish(error) {
      if (finished) return;

      finished = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    function onUpdate(update) {
      if (update.connection === "close") {
        const disconnectError =
          update.lastDisconnect?.error;

        const statusCode =
          disconnectError?.output?.statusCode;

        const detail =
          disconnectError?.message ||
          "Pa gen detay sou erè koneksyon an.";

        finish(
          new Error(
            `WhatsApp fèmen koneksyon an. Status=${
              statusCode || "unknown"
            }. ${detail}`
          )
        );
      }
    }

    const current =
      activeSessions.get(sessionId);

    if (
      !current ||
      current.sock !== sock
    ) {
      finish(
        new Error(
          "Sesyon WhatsApp la pa aktif ankò."
        )
      );

      return;
    }

    sock.ev.on(
      "connection.update",
      onUpdate
    );

    const timer = setTimeout(() => {
      finish();
    }, timeoutMs);
  });
}
/*
|--------------------------------------------------------------------------
| CONNECT SESSION
|--------------------------------------------------------------------------
*/

async function connectSession(
  number,
  options = {}
) {
  const sessionId =
    getSessionId(number);

  /*
   * Prevent duplicate sockets.
   */

  const existing =
    activeSessions.get(
      sessionId
    );

  if (
    existing?.sock
  ) {
    return existing.sock;
  }

  manuallyStopped.delete(
    sessionId
  );

  const sessionPath =
    getSessionPath(
      sessionId
    );

  if (
    !fs.existsSync(
      sessionPath
    )
  ) {
    fs.mkdirSync(
      sessionPath,
      {
        recursive: true
      }
    );
  }

  /*
   * Load multi-file authentication.
   */

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      sessionPath
    );

  /*
   * Fetch latest supported version.
   */

  let version;

  try {
    const latest =
      await fetchLatestBaileysVersion();

    if (
      Array.isArray(
        latest?.version
      )
    ) {
      version =
        latest.version;
    }
  } catch (error) {
    logger.warn(
      {
        error:
          error?.message ||
          String(error)
      },
      `[${sessionId}] Could not fetch latest WhatsApp version.`
    );
  }

  /*
   * Session automation.
   */

  const automation = {
    ...getDefaultAutomationSettings(),
    ...(options.automation || {})
  };

  /*
   * Normalize automation.
   */

  automation.autoStatusReact =
    automation.autoStatusReact !== false;

  automation.autoStatusSeen =
    automation.autoStatusSeen !== false;

  automation.autoStatusReply =
    automation.autoStatusReply !== false;

  /*
   * Socket configuration.
   */

  const socketConfig = {
    auth: {
      creds:
        state.creds,

      keys:
        makeCacheableSignalKeyStore(
          state.keys,
          logger
        )
    },

getMessage: getCachedMessage,

    browser:
      Browsers.ubuntu(
        "Chrome"
      ),

    printQRInTerminal:
      false,

    syncFullHistory:
      false,

    markOnlineOnConnect:
      automation.alwaysOnline === true
  };

  if (version) {
    socketConfig.version =
      version;
  }

  /*
   * Create socket.
   */

  const sock =
    makeWASocket(
      socketConfig
    );

  // Tradui mesaj WhatsApp k ap soti yo dapre lang panel la.
  const originalSendMessage = sock.sendMessage.bind(sock);

  sock.sendMessage = async function (jid, content, sendOptions) {
    try {
      const selectedLanguage =
        settingPanel.getPanelLanguage(sessionId);

      // Jwenn non bot ak footer sesyon aktyèl la.
      const currentSession =
        sessionManager.getSession(sessionId);

      const botName =
        currentSession?.bot?.name ||
        config.bot?.name ||
        "TOPFEROS MD";

      const footer =
        currentSession?.bot?.footer ||
        config.bot?.footer ||
        "🦁 TECH BY TOPFEROS MD 🐑";

      if (
        content &&
        typeof content === "object" &&
        (
          typeof content.text === "string" ||
          typeof content.caption === "string"
        )
      ) {
        
const translatedContent = await translatePayload(
  content,
  selectedLanguage,
  {
    botName,
    footer
  }
);

        return originalSendMessage(
          jid,
          translatedContent,
          sendOptions
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, sessionId },
        "Outgoing translation failed."
      );
    }

    return originalSendMessage(jid, content, sendOptions);
  };

  /*
   * Store session.
   */

const session = {
  sock,

  sessionId,

  number:
    sessionId,

  sessionPath,

  automation,

  registered:
    state.creds.registered === true,

  connected:
    false,
    welcomeSent:
      false,

    qr:
      null,

    pairing:
      false,

    pairingCode:
      null,

    pairingNumber:
      null,

    createdAt:
      Date.now(),

    lastConnectedAt:
      null
  };

  activeSessions.set(
    sessionId,
    session
  );

  /*
   * Save credentials continuously.
   */

  sock.ev.on(
  "creds.update",
  async (creds) => {
    await saveCreds(creds);

    const currentSession =
      activeSessions.get(
        sessionId
      );

    if (currentSession) {
      currentSession.registered =
        state.creds.registered === true;
    }
  }
);

  /* |--------------------------------------------------------------------------
   | STATUS HANDLER
   |--------------------------------------------------------------------------
   */

  try {
    attachStatusHandler(
      sock,
      {
        autoStatusReact:
          automation.autoStatusReact === true,

        autoStatusSeen:
          automation.autoStatusSeen === true,

        autoStatusReply:
          automation.autoStatusReply === true,

        aiModel:
          config?.ai?.model || undefined
      }
    );
  } catch (error) {
    logger.error(
      {
        error:
          error?.stack ||
          error?.message ||
          String(error)
      },
      `[${sessionId}] Failed to attach status handler.`
    );
  }

  /* |--------------------------------------------------------------------------
   | CONNECTION UPDATE
   |--------------------------------------------------------------------------
   */

  sock.ev.on(
    "connection.update",
    async (
      update
    ) => {
      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      /*
       * QR generated.
       */

      if (qr) {
        const current =
          activeSessions.get(
            sessionId
          );

        if (current) {
          current.qr =
            qr;
        }

        logger.info(
          `[${sessionId}] WhatsApp pairing QR generated.`
        );
      }

      /*
       * CONNECTED.
       */

      if (
        connection ===
        "open"
      ) {
        const current =
          activeSessions.get(
            sessionId
          );

        if (!current) {
          return;
        }

        current.connected =
          true;

        current.lastConnectedAt =
          Date.now();

        current.qr =
          null;

        current.pairing =
          false;

        current.pairingCode =
          null;

        logger.info(
          `[${sessionId}] 🟢 TOPFEROS MD V2.0.0 connected.`
        );

        logger.info(
          `[${sessionId}] Automations: ` +
          `alwaysOnline=${automation.alwaysOnline}, ` +
          `autoStatusSeen=${automation.autoStatusSeen}, ` +
          `autoStatusReply=${automation.autoStatusReply}, ` +
          `autoStatusReact=${automation.autoStatusReact}, ` +
          `antiDelete=${automation.antiDelete}, ` +
          `antiDeleteMode=${automation.antiDeleteMode}`
        );

        /*
         * Send welcome only once for
         * this socket connection.
         */

        if (
          !current.welcomeSent
        ) {
          current.welcomeSent =
            true;

          await sendWelcomeMessage(
            sock,
            sessionId
          );
        }

        /*
         * Clear reconnect timer.
         */

        const timer =
          reconnectTimers.get(
            sessionId
          );

        if (timer) {
          clearTimeout(
            timer
          );

          reconnectTimers.delete(
            sessionId
          );
        }
      }

      /*
       * CONNECTION CLOSED.
       */

      if (
        connection ===
        "close"
      ) {
        const current =
          activeSessions.get(
            sessionId
          );

        if (current) {
          current.connected =
            false;
        }

        /*
         * Manual disconnect.
         */

        if (
          manuallyStopped.has(
            sessionId
          )
        ) {
          logger.info(
            `[${sessionId}] 🔴 Session stopped manually.`
          );

          return;
        }

        /*
         * Disconnect status.
         */

        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        const shouldReconnect =
          statusCode !==
          DisconnectReason.loggedOut;

        logger.warn(
          `[${sessionId}] Connection closed. ` +
          `Status=${statusCode || "unknown"} ` +
          `Reconnect=${shouldReconnect}`
        );

        /*
         * Logged out:
         * keep session files untouched,
         * but do not reconnect automatically.
         */

        if (!shouldReconnect) {
  logger.error(
    `[${sessionId}] WhatsApp session logged out.`
  );

  /*
   * WhatsApp session closed permanently.
   * Invalidate the old panel access code.
   */

  settingPanel.clearPanelAccessCode(
    sessionId
  );

  settingPanel.removePanelSession(
    sessionId
  );

  activeSessions.delete(
    sessionId
  );

  return;
}

        /*
         * Prevent duplicate reconnect timers.
         */

        if (
          reconnectTimers.has(
            sessionId
          )
        ) {
          return;
        }

        const reconnectDelay =
          Number(
            config?.connection
              ?.reconnectDelay
          ) ||
          5000;

        const timer =
          setTimeout(
            async () => {
              reconnectTimers.delete(
                sessionId
              );

              if (
                manuallyStopped.has(
                  sessionId
                )
              ) {
                return;
              }

              try {
                activeSessions.delete(
                  sessionId
                );

                await connectSession(
                  sessionId,
                  {
                    automation
                  }
                );
              } catch (error) {
                logger.error(
                  {
                    error:
                      error?.stack ||
                      error?.message ||
                      String(error)
                  },
                  `[${sessionId}] Reconnection failed.`
                );
              }
            },
            reconnectDelay
          );

        reconnectTimers.set(
          sessionId,
          timer
        );
      }
    }
  );


/*
|--------------------------------------------------------------------------
| ANTI CALL — REJTE APÈL YO LÈ OPSYON AN AKTIVE
|--------------------------------------------------------------------------
*/

sock.ev.on("call", async (calls) => {
  try {
    if (!Array.isArray(calls)) {
      return;
    }

    const settings =
      settingPanel.getSessionSettings(sessionId);

    const automation =
      settings?.automation || {};

    if (automation.antiCall !== true) {
      return;
    }

    for (const call of calls) {
      try {
        // Rejte sèlman apèl k ap antre yo.
        if (
          !call?.id ||
          !call?.from ||
          call.status !== "offer"
        ) {
          continue;
        }

        if (typeof sock.rejectCall !== "function") {
          logger.warn(
            `[${sessionId}] Anti Call: rejectCall pa disponib nan socket la.`
          );
          continue;
        }

        await sock.rejectCall(
          call.id,
          call.from
        );

        logger.info(
          `[${sessionId}] Anti Call: apèl antre a rejte.`
        );
      } catch (error) {
        logger.error(
          {
            error:
              error?.stack ||
              error?.message ||
              String(error)
          },
          `[${sessionId}] Anti Call error.`
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        error:
          error?.stack ||
          error?.message ||
          String(error)
      },
      `[${sessionId}] Anti Call settings error.`
    );
  }
});

  /* |--------------------------------------------------------------------------
   | NORMAL MESSAGE EVENTS
   |--------------------------------------------------------------------------
   */

sock.ev.on(
  "messages.upsert",
  async (event) => {
    if (
      !event ||
      !Array.isArray(event.messages)
    ) {
      return;
    }

    for (const message of event.messages) {
      try {
        if (!message?.message) {
          continue;
        }

        const remoteJid =
          message.key?.remoteJid || "";

        // Pa trete status kòm mesaj nòmal.
        if (remoteJid === "status@broadcast") {
          continue;
        }

        // Detekte mesaj efasman (REVOKE).
        if (message.message.protocolMessage) {
          await antiDelete.handleDeleteEvent(
            sock,
            sessionId,
            message
          );

          continue;
        }

        // Konsève mesaj ki ka efase pita.
        await antiDelete.handleIncomingMessage(
          sessionId,
          message
        );

        // Kenbe cache mesaj ki deja egziste a.
        cacheMessage(message);

        // Kontinye tretman nòmal kòmand yo.
        await handleMessage(
          sock,
          message,
          sessionId
        );
      } catch (error) {
        logger.error(
          {
            error:
              error?.stack ||
              error?.message ||
              String(error)
          },
          `[${sessionId}] Message handler error.`
        );
      }
    }
  }
);

// Retounen socket la epi fèmen connectSession().
  return sock;
}

/*
|--------------------------------------------------------------------------
| PAIR SESSION
|--------------------------------------------------------------------------
|
| Creates an isolated WhatsApp session and
| requests a WhatsApp Pairing Code.
|
| Example:
|
| .pair 509XXXXXXXX
|
| Number format:
| country code + number
| digits only
|
|--------------------------------------------------------------------------
*/
async function pairSession(number) {
  const sessionId = getSessionId(number);

  if (sessionId.length < 8 || sessionId.length > 15) {
    throw new Error("Nimewo WhatsApp la pa valab.");
  }

  let session = activeSessions.get(sessionId);

  if (session?.connected) {
    throw new Error("Nimewo sa a deja konekte.");
  }

  if (session?.pairing) {
    throw new Error("Gen yon demann kòd ki deja an kou.");
  }

  if (session?.sock) {
    manuallyStopped.add(sessionId);

    const timer = reconnectTimers.get(sessionId);

    if (timer) {
      clearTimeout(timer);
      reconnectTimers.delete(sessionId);
    }

    try {
      session.sock.end(undefined);
    } catch (error) {
      logger.warn(
        `[${sessionId}] Fèmti ansyen socket la: ${
          error?.message || String(error)
        }`
      );
    }

    activeSessions.delete(sessionId);
  }
  manuallyStopped.delete(sessionId);

  try {
    const sock = await connectSession(sessionId);
    session = activeSessions.get(sessionId);

    if (!session || !sock) {
      throw new Error("Nou pa kapab kreye sesyon WhatsApp la.");
    }

    if (session.registered || sock.authState?.creds?.registered) {
      throw new Error(
        "Sesyon sa a deja anrejistre. Eseye rekonekte li."
      );
    }

    session.pairing = true;
    session.pairingNumber = sessionId;
    session.pairingCode = null;

    await waitForPairingReady(sock, sessionId);

    if (activeSessions.get(sessionId)?.sock !== sock) {
      throw new Error(
        "Sesyon an chanje pandan demann kòd la. Eseye ankò."
      );
    }

    const code = await sock.requestPairingCode(sessionId);

    if (!code || !String(code).trim()) {
      throw new Error("WhatsApp pa retounen yon kòd koneksyon.");
    }

    session.pairingCode = String(code).trim();

    logger.info(
      `[${sessionId}] Pairing code generated successfully.`
    );

    return {
      sessionId,
      pairingCode: session.pairingCode
    };
  } catch (error) {
    const current = activeSessions.get(sessionId);

    if (current) {
      current.pairing = false;
      current.pairingNumber = null;
      current.pairingCode = null;
    }

    logger.error(
      {
        error: error?.stack || error?.message || String(error)
      },
      `[${sessionId}] Pairing failed.`
    );

    throw error;
  }
}
/*
|--------------------------------------------------------------------------
| DISCONNECT SESSION
|--------------------------------------------------------------------------
|
| IMPORTANT:
| - Socket is closed
| - Session remains on disk
| - Credentials are NOT deleted
| - User can reconnect later
|--------------------------------------------------------------------------
*/

async function disconnectSession(
  number
) {
  const sessionId =
    getSessionId(number);

  manuallyStopped.add(
    sessionId
  );

  /*
   * Cancel reconnect timer.
   */

  const timer =
    reconnectTimers.get(
      sessionId
    );

  if (timer) {
    clearTimeout(
      timer
    );

    reconnectTimers.delete(
      sessionId
    );
  }

  /*
   * Get active session.
   */

  const session =
    activeSessions.get(
      sessionId
    );

  if (!session?.sock) {
    return false;
  }

  /*
   * Close socket only.
   */

  try {
    session.sock.end(
      undefined
    );
  } catch (error) {
    logger.warn(
      {
        error:
          error?.message ||
          String(error)
      },
      `[${sessionId}] Error while closing WhatsApp socket.`
    );
  }

  /*
   * Remove from active memory.
   *
   * Authentication files remain untouched.
   */

  activeSessions.delete(
    sessionId
  );

  logger.info(
    `[${sessionId}] 🔴 WhatsApp disconnected without deleting session credentials.`
  );

  return true;
}

/*
|--------------------------------------------------------------------------
| RECONNECT SESSION
|--------------------------------------------------------------------------
*/

async function reconnectSession(
  number
) {
  const sessionId =
    getSessionId(number);

  manuallyStopped.delete(
    sessionId
  );

  /*
   * Cancel pending reconnect timer.
   */

  const timer =
    reconnectTimers.get(
      sessionId
    );

  if (timer) {
    clearTimeout(
      timer
    );

    reconnectTimers.delete(
      sessionId
    );
  }

  /*
   * Close old socket if present.
   */

  const existing =
    activeSessions.get(
      sessionId
    );

  if (existing?.sock) {
    try {
      existing.sock.end(
        undefined
      );
    } catch {
      /*
       * Ignore socket close errors.
       */
    }

    activeSessions.delete(
      sessionId
    );
  }

  /*
   * Reuse stored authentication.
   */

  return connectSession(
    sessionId
  );
}

/*
|--------------------------------------------------------------------------
| DISCONNECT ALL SESSIONS
|--------------------------------------------------------------------------
|
| Used during application shutdown.
| Credentials remain preserved.
|--------------------------------------------------------------------------
*/

async function disconnectAllSessions() {
  const sessionIds = [
    ...activeSessions.keys()
  ];

  for (
    const sessionId of
      sessionIds
  ) {
    try {
      await disconnectSession(
        sessionId
      );
    } catch (error) {
      logger.error(
        {
          error:
            error?.message ||
            String(error)
        },
        `[${sessionId}] Failed to disconnect session during shutdown.`
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  connectSession,

  pairSession,

  disconnectSession,

  reconnectSession,

  disconnectAllSessions,

  getSession,

  getActiveSessions,

  getSessionQR,

  isConnected,

  getSessionAutomation,

  updateSessionAutomation,

  getDefaultAutomationSettings,

  createWelcomeMessage,

  sendWelcomeMessage,

  getSessionId,

  getSessionPath,

  normalizeNumber,

  SESSIONS_DIR
};