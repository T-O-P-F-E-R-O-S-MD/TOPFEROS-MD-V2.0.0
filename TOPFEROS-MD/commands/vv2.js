"use strict";

// 🦁 TOPFEROS MD V2.0.0
// VV2 / VVV COMMAND REGISTRATION

const {
  vv2Command,
  vvvCommand
} = require("../services/viewOnce");

function init({ logger } = {}) {
  const {
    registerCommand
  } = require("../src/messageHandler");

  registerCommand("vv2", vv2Command, {
    aliases: [],
    description: "Voye medya nòmal ou site a nan menm chat la.",
    usage: ".vv2",
    category: "MEDIA"
  });

  registerCommand("vvv", vvvCommand, {
    aliases: [],
    description: "Voye medya nòmal ou site a nan chat la ak DM.",
    usage: ".vvv",
    category: "MEDIA"
  });

  if (logger) {
    logger.info(
      "🦁 TOPFEROS MD: .vv2 and .vvv registered"
    );
  }
}

module.exports = {
  init
};