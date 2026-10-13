
"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                 VV2 / VVV COMMAND                ║
// ╚════════════════════════════════════════════════════╝

const {
  vv2Command,
  vvvCommand
} = require("../services/viewOnce");

/*
|--------------------------------------------------------------------------
| COMMAND INITIALIZER
|--------------------------------------------------------------------------
*/

function init({
  logger
} = {}) {

  const {
    registerCommand
  } = require("../src/messageHandler");

  /*
  |--------------------------------------------------------------------------
  | VV2 — SAME CHAT
  |--------------------------------------------------------------------------
  */

  registerCommand(
    "vv2",
    vv2Command,
    {
      aliases: [],

      description:
        "Send permitted media in the same chat.",

      usage:
        ".vv2",

      category:
        "*KISI VIEW ONCE PHOTO/ VIDÉO/ AUDIO*/n/n"
    }
  );

  /*
  |--------------------------------------------------------------------------
  | VVV — CHAT + DM
  |--------------------------------------------------------------------------
  */

  registerCommand(
    "vvv",
    vvvCommand,
    {
      aliases: [],

      description:
        "Send permitted media to chat and DM.",

      usage:
        ".vvv",

      category:
        "*KISI VIEW ONCE PHOTO/ VIDÉO/ AUDIO*/n/n"
    }
  );

  if (logger) {
    logger.info(
      "🦁 TOPFEROS MD: .vv2 and .vvv registered"
    );
  }
}

module.exports = {
  init
};
