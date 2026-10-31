"use strict";

/*
 * TOPFEROS MD V2.0.0
 * panel/public/app.js
 *
 * Frontend logic for:
 * - Panel language
 * - Session verification
 * - Settings loading/saving
 * - Connect / disconnect
 * - Automation switches
 * - Group automation
 * - Bot information
 */

(() => {
  const state = {
    sessionId: "",
    language: "en",
    panelData: null,
    languages: {},
    verified: false,
    saving: false
  };

  const API = {
    panel: "/api/panel",
    languages: "/api/languages",
    language: "/api/language",
    translate: "/api/translate",
    verify: "/api/verify",
    pair: "/api/pair",
    settings: "/api/settings",
    session: (id) => `/api/session/${encodeURIComponent(id)}`,
    disconnect: "/api/session/disconnect",
    reconnect: "/api/session/reconnect"
  };

  const $ = (selector, root = document) => {
    return root.querySelector(selector);
  };

  const $$ = (selector, root = document) => {
    return Array.from(root.querySelectorAll(selector));
  };

  function getSessionId() {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get("sessionId") ||
      params.get("session") ||
      localStorage.getItem("topferos_session_id") ||
      ""
    ).trim();
  }

  function setSessionId(sessionId) {
  state.sessionId = String(sessionId || "").trim();

  if (state.sessionId) {
    localStorage.setItem(
      "topferos_session_id",
      state.sessionId
    );
  }

  const sessionInput = $("#sessionId");

  if (sessionInput) {
    sessionInput.value = state.sessionId;
  }
}

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? {
              "Content-Type": "application/json"
            }
          : {}),
        ...(options.headers || {})
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function notify(message, type = "info") {
    const existing = $("#topferos-notification");

    if (existing) {
      existing.remove();
    }

    const notification = document.createElement("div");

    notification.id = "topferos-notification";
    notification.className =
      `topferos-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    window.setTimeout(() => {
      notification.classList.add("hide");

      window.setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  function setLoading(
    button,
    loading,
    loadingText = "Loading..."
  ) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          button.textContent;
      }

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.textContent =
          button.dataset.originalText;

        delete button.dataset.originalText;
      }
    }
  }

  function setConnectionStatus(connected) {
    const statusElements = $$(
      "[data-connection-status], #connectionStatus, .connection-status"
    );

    statusElements.forEach((element) => {
      element.textContent = connected
        ? "🟢 CONNECTED"
        : "🔴 DISCONNECTED";

      element.classList.toggle(
        "connected",
        connected
      );

      element.classList.toggle(
        "disconnected",
        !connected
      );
    });

    const connectButtons = $$(
      "[data-action='connect'], #connectButton, #reconnectButton"
    );

    const disconnectButtons = $$(
      "[data-action='disconnect'], #disconnectButton"
    );

    connectButtons.forEach((button) => {
      button.disabled = connected;
    });

    disconnectButtons.forEach((button) => {
      button.disabled = !connected;
    });
  }

  function setFieldValue(id, value) {
    const element = document.getElementById(id);

    if (!element) return;

    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      updateSwitchVisual(element);
      return;
    }

    element.value = value ?? "";
  }

  function getFieldValue(id, fallback = "") {
    const element = document.getElementById(id);

    if (!element) return fallback;

    if (element.type === "checkbox") {
      return element.checked;
    }

    return element.value;
  }

  function updateSwitchVisual(input) {
    if (!input) return;

    const wrapper =
      input.closest("[data-switch]") ||
      input.closest(".switch") ||
      input.parentElement;

    if (!wrapper) return;

    wrapper.classList.toggle(
      "active",
      input.checked
    );

    wrapper.classList.toggle(
      "inactive",
      !input.checked
    );

    const label = wrapper.querySelector(
      "[data-switch-label], .switch-label, .status-label"
    );

    if (label) {
      label.textContent = input.checked
        ? "🟢 ON"
        : "🔴 OFF";
    }
  }

  function bindSwitches() {
    $$("input[type='checkbox']").forEach(
      (input) => {
        updateSwitchVisual(input);

        if (input.dataset.switchBound === "true") {
          return;
        }

        input.dataset.switchBound = "true";

        input.addEventListener(
          "change",
          () => {
            updateSwitchVisual(input);
          }
        );
      }
    );
  }

function normalizeAutomation(settings = {}) {
  return {
    alwaysOnline: settings.alwaysOnline !== false,
    fakeTyping: settings.fakeTyping === true,
    fakeRecording: settings.fakeRecording === true,
    autoStatusSeen: settings.autoStatusSeen !== false,
    autoStatusReply: settings.autoStatusReply !== false,
    autoStatusReact: settings.autoStatusReact !== false,

    autoReact: settings.autoReact === true,
    autoReactMode: settings.autoReactMode || "all",
    autoReactEmojis: Array.isArray(settings.autoReactEmojis)
      ? settings.autoReactEmojis
      : [],

    antiSpam: settings.antiSpam === true,
    antiSpamMode: settings.antiSpamMode || "warn",

    antiDelete: settings.antiDelete !== false,
    antiCall: settings.antiCall === true,
    antiBug: settings.antiBug === true,

    antiBotMode: settings.antiBotMode || "both",
    botDetection: settings.botDetection === true,
    autoScan: settings.autoScan === true,
    botScore: settings.botScore === true,
    adminNotification: settings.adminNotification === true,
    autoKick: settings.autoKick === true,
    antiBotFilter: settings.antiBotFilter === true,
    antiBotAction: settings.antiBotAction || "Delete",

    antiDeleteMode: settings.antiDeleteMode || "private",

    antiBlockNumbers: Array.isArray(settings.antiBlockNumbers)
      ? settings.antiBlockNumbers
      : []
  };
}

  function normalizeBot(settings = {}) {
    return {
      ownerNumber:
        settings.ownerNumber || "",

      name:
        settings.name ||
        "TOPFEROS MD",

      location:
        settings.location ||
        "HAÏTI",

      age:
        settings.age ?? 14,

      prefix:
        settings.prefix || ".",

      footer:
        settings.footer ||
        "🦁 TECH BY TOPFEROS MD 🐑",

      mode:
        settings.mode ||
        "Public",

      language:
        settings.language ||
        state.language ||
        "en"
    };
  }

  function normalizeGroupAutomation(
    settings = {}
  ) {
    return {
      enabled:
        settings.enabled === true,

      groupGid:
        settings.groupGid || "",

      timezone:
        settings.timezone ||
        "Atlantic/Port-au-Prince",

      closeTime:
        settings.closeTime ||
        "15:00",

      openTime:
        settings.openTime ||
        "06:00",

      principles:
        settings.principles || "",

      warningLimit:
        Number(settings.warningLimit || 3)
    };
  }

  function fillBotSettings(bot = {}) {
    const data = normalizeBot(bot);

    setFieldValue(
      "ownerNumber",
      data.ownerNumber
    );

    setFieldValue(
      "botName",
      data.name
    );

    setFieldValue(
      "location",
      data.location
    );

    setFieldValue(
      "age",
      data.age
    );

    setFieldValue(
      "prefix",
      data.prefix
    );

    setFieldValue(
      "footer",
      data.footer
    );

    setFieldValue(
      "mode",
      data.mode
    );

    setFieldValue(
      "botLanguage",
      data.language
    );
  }

  function fillAutomationSettings(
    automation = {}
  ) {
    const data =
      normalizeAutomation(automation);

    setFieldValue(
      "alwaysOnline",
      data.alwaysOnline
    );

    setFieldValue(
      "fakeTyping",
      data.fakeTyping
    );

    setFieldValue(
      "fakeRecording",
      data.fakeRecording
    );

    setFieldValue(
      "autoStatusSeen",
      data.autoStatusSeen
    );

    setFieldValue(
      "autoStatusReply",
      data.autoStatusReply
    );

    setFieldValue(
      "autoStatusReact",
      data.autoStatusReact
    );

    setFieldValue(
      "antiDelete",
      data.antiDelete
    );

    setFieldValue(
      "antiCall",
      data.antiCall
    );

    setFieldValue(
      "antiBug",
      data.antiBug
    );

    setFieldValue(
      "antiBotFilter",
      data.antiBotFilter
    );

     antiBotMode:
  [
    "Groups Only",
    "Private Messages Only",
    "Both"
  ].includes(settings.antiBotMode)
    ? settings.antiBotMode
    : "Both",

    setFieldValue(
      "antiDeleteMode",
      data.antiDeleteMode
    );

    setFieldValue(
      "antiBotAction",
      data.antiBotAction
    );

    setFieldValue(
  "antiBotMode",
  data.antiBotMode
);

    const numbers =
      Array.isArray(
        data.antiBlockNumbers
      )
        ? data.antiBlockNumbers.join("\n")
        : "";

    setFieldValue(
      "antiBlockNumbers",
      numbers
    );

    bindSwitches();
  }

  function fillGroupSettings(group = {}) {
    const data =
      normalizeGroupAutomation(group);

    setFieldValue(
      "groupAutomationEnabled",
      data.enabled
    );

    setFieldValue(
      "groupGid",
      data.groupGid
    );

    setFieldValue(
      "timezone",
      data.timezone
    );

    setFieldValue(
      "closeTime",
      data.closeTime
    );

    setFieldValue(
      "openTime",
      data.openTime
    );

    setFieldValue(
      "groupPrinciples",
      data.principles
    );

    setFieldValue(
      "warningLimit",
      data.warningLimit
    );

    bindSwitches();
  }

  function collectBotSettings() {
    const age = Number(
      getFieldValue("age", 14)
    );

    return {
      ownerNumber:
        getFieldValue("ownerNumber"),

      name:
        getFieldValue(
          "botName",
          "TOPFEROS MD"
        ).trim(),

      location:
        getFieldValue(
          "location",
          "HAÏTI"
        ).trim(),

      age:
        Number.isFinite(age)
          ? age
          : 14,

      prefix:
        getFieldValue(
          "prefix",
          "."
        ).trim() || ".",

      footer:
        getFieldValue(
          "footer",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ).trim(),

      mode:
        getFieldValue(
          "mode",
          "Public"
        ),

      language:
        getFieldValue(
          "botLanguage",
          state.language
        )
    };
  }

  function collectAutomationSettings() {
    const antiBlockText =
      getFieldValue(
        "antiBlockNumbers",
        ""
      );

    const antiBlockNumbers =
      antiBlockText
        .split(/\r?\n|,/)
        .map((number) =>
          number.trim()
        )
        .filter(Boolean);

    return {
      alwaysOnline:
        Boolean(
          getFieldValue(
            "alwaysOnline"
          )
        ),

      fakeTyping:
        Boolean(
          getFieldValue(
            "fakeTyping"
          )
        ),

      fakeRecording:
        Boolean(
          getFieldValue(
            "fakeRecording"
          )
        ),

      autoStatusSeen:
        Boolean(
          getFieldValue(
            "autoStatusSeen"
          )
        ),

      autoStatusReply:
        Boolean(
          getFieldValue(
            "autoStatusReply"
          )
        ),

      autoStatusReact:
        Boolean(
          getFieldValue(
            "autoStatusReact"
          )
        ),

      antiDelete:
        Boolean(
          getFieldValue(
            "antiDelete"
          )
        ),

      antiCall:
        Boolean(
          getFieldValue(
            "antiCall"
          )
        ),

      antiBug:
        Boolean(
          getFieldValue(
            "antiBug"
          )
        ),

      antiBotFilter:
        Boolean(
          getFieldValue(
            "antiBotFilter"
          )
        ),

      antiBotMode:
      getFieldValue(
        "antiBotMode",
           "Both"
         ),

      antiDeleteMode:
        getFieldValue(
          "antiDeleteMode",
          "private"
        ),

      antiBotAction:
        getFieldValue(
          "antiBotAction",
          "Delete"
        ),

      antiBlockNumbers
    };
  }

  function collectGroupSettings() {
    const warningLimit =
      Number(
        getFieldValue(
          "warningLimit",
          3
        )
      );

    return {
      enabled:
        Boolean(
          getFieldValue(
            "groupAutomationEnabled"
          )
        ),

      groupGid:
        getFieldValue(
          "groupGid"
        ).trim(),

      timezone:
        getFieldValue(
          "timezone",
          "Atlantic/Port-au-Prince"
        ),

      closeTime:
        getFieldValue(
          "closeTime",
          "15:00"
        ),

      openTime:
        getFieldValue(
          "openTime",
          "06:00"
        ),

      principles:
        getFieldValue(
          "groupPrinciples"
        ),

      warningLimit:
        Number.isFinite(
          warningLimit
        )
          ? warningLimit
          : 3
    };
  }

  function collectSettings() {
    return {
      bot: collectBotSettings(),
      automation:
        collectAutomationSettings(),
      groupAutomation:
        collectGroupSettings()
    };
  }

  function validateSettings(
    settings
  ) {
    const bot = settings.bot;

    if (!bot.name) {
      return "BOT NAME cannot be empty.";
    }

    if (!bot.prefix) {
      return "PREFIX cannot be empty.";
    }

    if (!bot.footer) {
      return "FOOTER cannot be empty.";
    }

    if (
      ![
        "Public",
        "Privé",
        "Group"
      ].includes(bot.mode)
    ) {
      return "Invalid bot mode.";
    }

    if (
      !Number.isFinite(
        Number(bot.age)
      ) ||
      Number(bot.age) < 1
    ) {
      return "AGE must be a valid number.";
    }

    return null;
  }

  async function loadPanelData() {
    const data =
      await request(API.panel);

    state.panelData = data;

    if (data?.language) {
      state.language =
        data.language;
    }

    if (data?.languages) {
      state.languages =
        normalizeLanguages(
          data.languages
        );
    }

    return data;
  }

  function normalizeLanguages(
    languages
  ) {
    if (!languages) {
      return {};
    }

    /*
     * language.js V2 returns:
     * {
     *   en: "English",
     *   fr: "French",
     *   es: "Spanish",
     *   es_do: "Dominican Spanish",
     *   pt: "Portuguese",
     *   zh: "Chinese",
     *   ht: "Haitian Creole"
     * }
     */

    if (
      !Array.isArray(languages) &&
      typeof languages === "object"
    ) {
      return {
        ...languages
      };
    }

    if (Array.isArray(languages)) {
      const result = {};

      languages.forEach(
        (language) => {
          if (
            typeof language ===
            "string"
          ) {
            result[language] =
              language;
            return;
          }

          const code =
            language?.code ||
            language?.id ||
            language?.value;

          const name =
            language?.name ||
            language?.label ||
            code;

          if (code) {
            result[code] =
              name;
          }
        }
      );

      return result;
    }

    return {};
  }

  async function loadLanguages() {
    const data =
      await request(
        API.languages
      );

    state.languages =
      normalizeLanguages(
        data?.languages ||
        data?.available ||
        data
      );

    renderLanguageOptions();

    return state.languages;
  }

  function renderLanguageOptions() {
    const selects = $$(
      "#language, #panelLanguage, #botLanguage, [data-language-select]"
    );

    if (!selects.length) {
      return;
    }

    const languages =
      normalizeLanguages(
        state.languages
      );

    const entries =
      Object.entries(
        languages
      );

    if (!entries.length) {
      return;
    }

    selects.forEach(
      (select) => {
        const current =
          select.value ||
          state.language;

        select.innerHTML = "";

        entries.forEach(
          ([code, label]) => {
            const option =
              document.createElement(
                "option"
              );

            option.value = code;
            option.textContent =
              label;

            if (
              code === current ||
              (
                !current &&
                code === state.language
              )
            ) {
              option.selected =
                true;
            }

            select.appendChild(
              option
            );
          }
        );

        if (
          state.language &&
          languages[state.language]
        ) {
          select.value =
            state.language;
        }
      }
    );
  }

  
  async function changeLanguage(language) {
    if (!language) return;

    state.language = language;

    // Kenbe lang itilizatè a chwazi a.
    localStorage.setItem(
      "topferos_panel_language",
      language
    );

    try {
      await request(API.language, {
        method: "POST",
        body: JSON.stringify({
          sessionId: state.sessionId,
          language
        })
      });
    } catch (error) {
      console.error(
        "Unable to save panel language:",
        error
      );
    }

    renderLanguageOptions();

    // Tradui paj la tousuit apre chwa a.
    await translatePage();
  }

  async function translatePage() {
    const elements = $$("[data-i18n]");

    for (const element of elements) {
      const key = element.dataset.i18n;
      if (!key) continue;

      try {
        const result = await request(API.translate, {
          method: "POST",
          body: JSON.stringify({
            key,
            language: state.language
          })
        });

        if (
          result?.success &&
          typeof result.text === "string" &&
          result.text !== key
        ) {
          element.textContent = result.text;
        }
      } catch (error) {
        console.error(
          "Translation failed for:",
          key,
          error
        );
      }
    }
  }


  async function verifySession(
    sessionId = state.sessionId
  ) {
    if (!sessionId) {
      state.verified = false;
      setConnectionStatus(false);
      return false;
    }

    setSessionId(sessionId);

    try {
      const data =
        await request(
          API.session(
            state.sessionId
          )
        );

      const connected =
        data?.connected === true ||
        data?.session?.connected === true ||
        data?.status ===
          "connected";

      const exists =
        data?.exists !== false;

      state.verified =
        Boolean(exists);

      setConnectionStatus(
        connected
      );

      return state.verified;
    } catch (error) {
      state.verified = false;

      setConnectionStatus(false);

      notify(
        error.message,
        "error"
      );

      return false;
    }
  }

  async function verifyNumberAndCode(
    number,
    code
  ) {
    const cleanNumber =
      String(
        number || ""
      ).trim();

    const cleanCode =
      String(
        code || ""
      ).trim();

    if (
      !cleanNumber ||
      !cleanCode
    ) {
      notify(
        "NUMBER and CODE are required.",
        "error"
      );

      return false;
    }

    try {
      const data =
        await request(
          API.verify,
          {
            method: "POST",
            body: JSON.stringify({
              number:
                cleanNumber,
              code:
                cleanCode,
              sessionId:
                state.sessionId
            })
          }
        );

      if (data?.sessionId) {
        setSessionId(
          data.sessionId
        );
      }

      /*
       * Backend already returned
       * HTTP 2xx, therefore the
       * verification request itself
       * succeeded.
       */
      state.verified = true;

      notify(
        "Session verified successfully.",
        "success"
      );

      return true;
    } catch (error) {
      state.verified = false;

      notify(
        error.message,
        "error"
      );

      return false;
    }
  }

  async function loadSettings() {
    if (!state.sessionId) {
      return null;
    }

    const data =
      await request(
        `${API.settings}?sessionId=${encodeURIComponent(
          state.sessionId
        )}`
      );

    const settings =
      data?.settings ||
      data?.data ||
      data;

    if (settings?.bot) {
      fillBotSettings(
        settings.bot
      );
    }

    if (settings?.automation) {
      fillAutomationSettings(
        settings.automation
      );
    }

    if (
      settings?.groupAutomation
    ) {
      fillGroupSettings(
        settings.groupAutomation
      );
    }

    if (settings?.language) {
      state.language =
        settings.language;
    }

    renderLanguageOptions();
    bindSwitches();

    return settings;
  }

  async function saveSettings() {
    if (state.saving) {
      return false;
    }

    if (!state.sessionId) {
      notify(
        "No session selected.",
        "error"
      );

      return false;
    }

    const settings =
      collectSettings();

    const validationError =
      validateSettings(
        settings
      );

    if (validationError) {
      notify(
        validationError,
        "error"
      );

      return false;
    }

    state.saving = true;

    const buttons = $$(
      "[data-action='save'], #saveButton"
    );

    buttons.forEach(
      (button) => {
        setLoading(
          button,
          true,
          "Saving..."
        );
      }
    );

    try {
      await request(
        API.settings,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId:
              state.sessionId,

            bot:
              settings.bot,

            automation:
              settings.automation,

            groupAutomation:
              settings.groupAutomation,

            settings
          })
        }
      );

      notify(
        "Settings saved successfully.",
        "success"
      );

      return true;
    } catch (error) {
      notify(
        error.message,
        "error"
      );

      return false;
    } finally {
      state.saving = false;

      buttons.forEach(
        (button) => {
          setLoading(
            button,
            false
          );
        }
      );
    }
  }

  async function disconnectSession() {
    if (!state.sessionId) {
      notify(
        "No session selected.",
        "error"
      );

      return false;
    }

    const buttons = $$(
      "[data-action='disconnect'], #disconnectButton"
    );

    buttons.forEach(
      (button) => {
        setLoading(
          button,
          true,
          "Disconnecting..."
        );
      }
    );

    try {
      await request(
        API.disconnect,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId:
              state.sessionId
          })
        }
      );

      setConnectionStatus(
        false
      );

      notify(
        "Disconnected. Session credentials were kept.",
        "success"
      );

      return true;
    } catch (error) {
      notify(
        error.message,
        "error"
      );

      return false;
    } finally {
      buttons.forEach(
        (button) => {
          setLoading(
            button,
            false
          );
        }
      );
    }
  }

  async function reconnectSession() {
    if (!state.sessionId) {
      notify(
        "No session selected.",
        "error"
      );

      return false;
    }

    const buttons = $$(
      "[data-action='connect'], #connectButton, #reconnectButton"
    );

    buttons.forEach(
      (button) => {
        setLoading(
          button,
          true,
          "Connecting..."
        );
      }
    );

    try {
      await request(
        API.reconnect,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId:
              state.sessionId
          })
        }
      );

      notify(
        "Reconnect requested.",
        "success"
      );

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            1500
          );
        }
      );

      await verifySession();

      return true;
    } catch (error) {
      notify(
        error.message,
        "error"
      );

      return false;
    } finally {
      buttons.forEach(
        (button) => {
          setLoading(
            button,
            false
          );
        }
      );
    }
  }

async function requestPairingCode() {
  const numberInput = $("#ownerNumber");
  const resultBox = $("#pairingResult");
  const codeInput = $("#pairingCode");
  const messageBox = $("#pairingMessage");
  const connectButton = $("#connectButton");

  const number = String(
    numberInput?.value || ""
  ).replace(/\D/g, "");

  if (number.length < 8 || number.length > 15) {
    notify(
      "Antre nimewo WhatsApp ou ak kòd peyi a.",
      "error"
    );
    return false;
  }

  if (resultBox) {
    resultBox.hidden = true;
  }

  setLoading(
    connectButton,
    true,
    "Requesting code..."
  );

  try {
    const data = await request(API.pair, {
      method: "POST",
      body: JSON.stringify({ number })
    });

    if (!data?.success || !data?.pairingCode) {
      throw new Error(
        data?.message || "WhatsApp pa retounen yon kòd pairing."
      );
    }

    if (data.sessionId) {
      setSessionId(data.sessionId);
    }

    if (codeInput) {
      codeInput.value = data.pairingCode;
    }

    if (resultBox) {
      resultBox.hidden = false;
    }

    if (messageBox) {
      messageBox.textContent =
        "Sou WhatsApp: Linked devices > Link a device > Link with phone number, epi antre kòd la.";
    }

    notify(
      "Kòd WhatsApp la pare. Antre li sou telefòn ou.",
      "success"
    );

    return true;
  } catch (error) {
    notify(
      error.message || "Nou pa kapab jwenn kòd la.",
      "error"
    );
    return false;
  } finally {
    setLoading(connectButton, false);
  }
}

async function copyPairingCode() {
  const codeInput = $("#pairingCode");
  const code = codeInput?.value?.trim();

  if (!code) {
    notify("Pa gen kòd pou kopye.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    notify("Kòd la kopye.", "success");
  } catch {
    codeInput.focus();
    codeInput.select();

    const copied = document.execCommand("copy");

    notify(
      copied ? "Kòd la kopye." : "Chwazi kòd la epi kopye li.",
      copied ? "success" : "error"
    );
  }
}


  function bindButtons() {
    $$("[data-action]").forEach((button) => {
      if (button.dataset.bound === "true") {
        return;
      }

      button.dataset.bound = "true";

      const action = button.dataset.action;

      if (action === "save") {
        button.addEventListener("click", saveSettings);
      } else if (action === "disconnect") {
        button.addEventListener("click", disconnectSession);
      } else if (action === "connect") {
        button.addEventListener("click", requestPairingCode);
      } else if (action === "reconnect") {
        button.addEventListener("click", reconnectSession);
      }
    });

    const saveButton = $("#saveButton");

    if (saveButton && saveButton.dataset.bound !== "true") {
      saveButton.dataset.bound = "true";
      saveButton.addEventListener("click", saveSettings);
    }

    const disconnectButton = $("#disconnectButton");

    if (
      disconnectButton &&
      disconnectButton.dataset.bound !== "true"
    ) {
      disconnectButton.dataset.bound = "true";
      disconnectButton.addEventListener(
        "click",
        disconnectSession
      );
    }

    const reconnectButton = $("#reconnectButton");

    if (
      reconnectButton &&
      reconnectButton.dataset.bound !== "true"
    ) {
      reconnectButton.dataset.bound = "true";
      reconnectButton.addEventListener(
        "click",
        reconnectSession
      );
    }

    const copyButton = $("#copyPairingCode");

    if (copyButton && copyButton.dataset.bound !== "true") {
      copyButton.dataset.bound = "true";
      copyButton.addEventListener("click", copyPairingCode);
    }
  }


  function bindLanguageControls() {
    $$(
      "#language, #panelLanguage, [data-language-select]"
    ).forEach(
      (select) => {
        if (
          select.dataset.bound ===
          "true"
        ) {
          return;
        }

        select.dataset.bound =
          "true";

        select.addEventListener(
          "change",
          () => {
            changeLanguage(
              select.value
            );
          }
        );
      }
    );
  }

  function bindAutoRefresh() {
    if (
      window.__TOPFEROS_AUTO_REFRESH__
    ) {
      return;
    }

    window.__TOPFEROS_AUTO_REFRESH__ =
      true;

    window.setInterval(
      async () => {
        if (!state.sessionId) {
          return;
        }

        try {
          await verifySession();
        } catch {
          /*
           * Do not interrupt
           * the panel.
           */
        }
      },
      5000
    );
  }

  async function initialize() {
    setSessionId(
      getSessionId()
    );

    bindButtons();
    bindSwitches();
    bindLanguageControls();

    try {
      await loadPanelData();
    } catch {
      /*
       * Panel data can be loaded later.
       */
    }

    try {
      await loadLanguages();
    } catch {
      /*
       * Language endpoint may
       * not be ready yet.
       */
    }

    renderLanguageOptions();
    bindLanguageControls();

    if (state.sessionId) {
      const verified =
        await verifySession();

      if (verified) {
        try {
          await loadSettings();
        } catch (error) {
          notify(
            error.message,
            "error"
          );
        }
      }
    }

    await translatePage();

    bindButtons();
    bindSwitches();
    bindLanguageControls();
    bindAutoRefresh();
  }

  /*
   * Public functions.
   * HTML buttons can call
   * these directly.
   */

  window.TOPFEROS = {
    state,

    initialize,

    getSessionId,
    setSessionId,

    verifySession,
    verifyNumberAndCode,

    loadPanelData,
    loadLanguages,
    loadSettings,

    saveSettings,

    connect:
      reconnectSession,

    reconnect:
      reconnectSession,

    disconnect:
      disconnectSession,

    changeLanguage,
    translatePage,

    collectSettings,

    notify
  };

  /*
   * Backward-compatible
   * global functions for
   * HTML onclick handlers.
   */

  window.verifySettings =
    verifySession;

  window.saveSettings =
    saveSettings;

  window.reconnectSettings =
    reconnectSession;

  window.disconnectSettings =
    disconnectSession;

  window.selectSettingsLanguage =
    changeLanguage;

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }
})();