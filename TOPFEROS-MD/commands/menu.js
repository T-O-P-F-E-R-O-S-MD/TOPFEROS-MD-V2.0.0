
"use strict";

const config = require("../src/config");

function cleanText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function getUserTag(message) {
  const participant =
    message?.key?.participant ||
    message?.participant ||
    "";

  const number = participant.split("@")[0];

  return number ? `@${number}` : "@user";
}

function buildMenu(message) {
  const botName = cleanText(
    config?.bot?.name,
    "TOPFEROS MD"
  );

  const version = cleanText(
    config?.bot?.version,
    "2.0.0"
  );

  const prefix = cleanText(
    config?.bot?.prefix,
    "."
  );

  const mode = cleanText(
    config?.bot?.mode,
    "Public"
  );

  const location = cleanText(
    config?.bot?.location,
    "HAÏTI"
  );

  const user = getUserTag(message);

  return `
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃      🦁 ${botName} 🐑
┃          V${version}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭───────❖ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ❖───────╮
│
│ 🎉 🦁 TOPFEROS MD V${version} ONLINE 🎉
│
│ ⚡ Prefix   : ${prefix}
│ 🌐 Mode     : ${mode}
│ 👤 User     : ${user}
│ 📍 Location : ${location}
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐅𝐄𝐀𝐓𝐔𝐑𝐄𝐒 ❖──────╮
│
│ 🟢 Always Online
│ ⌨️ Fake Typing
│ 🎙️ Fake Recording
│ 👁️ Auto Status Seen
│ 💬 Auto Status Reply
│ ❤️ Auto Status React
│ 📞 Anti Call
│ 🛡️ Anti Delete
│ 🤖 Anti Bot Protection
│ 👁️ ViewOnce / VV2
│ 👥 Group Management
│ 🕦 Group Automation
│ 🧠 Smart AI & Auto Chat
│ 🎵 Music & Media
│ 🎬 Video Download
│ 🎀 & Many More Features...
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐆𝐄𝐍𝐄𝐑𝐀𝐋 𝐌𝐄𝐍𝐔 ❖──────╮
│
│ 📋 ${prefix}menu
│ 📖 ${prefix}help
│ ℹ️ ${prefix}info
│ 🤖 ${prefix}botinfo
│ 💚 ${prefix}alive
│ ⚡ ${prefix}ping
│ ⏱️ ${prefix}runtime
│ 👑 ${prefix}owner
│ 🧮 ${prefix}calc
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐀𝐈 & 𝐂𝐇𝐀𝐓 ❖──────╮
│
│ 🧠 ${prefix}ai
│ 💭 ${prefix}prompt
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐈𝐎𝐍 ❖──────╮
│
│ 🔗 ${prefix}pair
│ 🎟️ ${prefix}parrain
│ ⚙️ ${prefix}setting
│ ⚙️ ${prefix}settings
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐕𝐈𝐄𝐖 𝐎𝐍𝐂𝐄 ❖──────╮
│
│ 👁️ ${prefix}vv2
│ 👁️ ${prefix}vvv
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐌𝐄𝐃𝐈𝐀 & 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 ❖──────╮
│
│ 🎵 ${prefix}play
│ 🎬 ${prefix}video
│ 🎞️ ${prefix}film
│ 📺 ${prefix}serie
│ 📸 ${prefix}ss
│ 🔗 ${prefix}shorturl
│ 🔳 ${prefix}qr
│ 🌍 ${prefix}translate
│ 🗣️ ${prefix}tts
│ 🎨 ${prefix}sticker
│ 🖼️ ${prefix}toimg
│ 🏷️ ${prefix}take
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐌𝐄𝐒𝐒𝐀𝐆𝐄 & 𝐒𝐓𝐀𝐓𝐔𝐒 ❖──────╮
│
│ 🗑️ ${prefix}del
│ 🗑️ ${prefix}delt
│ 🧹 ${prefix}delete
│ 💾 ${prefix}save
│ 📤 ${prefix}send
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐆𝐑𝐎𝐔𝐏 𝐌𝐄𝐍𝐔 ❖──────╮
│
│ 🔗 ${prefix}link
│ ➕ ${prefix}add @member
│ ❌ ${prefix}kick @member
│ ⬆️ ${prefix}promote @member
│ ⬇️ ${prefix}demote @admin
│ 👥 ${prefix}groupinfo
│ 📢 ${prefix}tagall
│ 🕵️ ${prefix}hidetag
│ 🚪 ${prefix}open
│ 🔒 ${prefix}close
│ 🔇 ${prefix}mute
│ 🔊 ${prefix}unmute
│ 🧹 ${prefix}remove
│ ✏️ ${prefix}setname
│ 📝 ${prefix}setdesc
│ 🖼️ ${prefix}setpic
│ 📲 ${prefix}gstatus
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭──────❖ 𝐐𝐔𝐈𝐂𝐊 𝐌𝐄𝐍𝐔 ❖──────╮
│
│ 📋 Type ${prefix}menu
│    ➜ To view the command menu
│
│ 👁️ Type ${prefix}vv2
│    ➜ Decode a replied ViewOnce
│
│ ⚙️ Type ${prefix}setting
│    ➜ Open the settings portal
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌐 Web Connect
└──➤ https://topferos-md-v2-0-0.onrender.com

🌐 Web Channel
└──➤ https://whatsapp.com/channel/0029VbDJULz30LKTYe95S91l

╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│ 🦁  TECH BY TOPFEROS MD 🐑
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
`.trim();
}

async function sendMenu(sock, message) {
  if (!sock || !message) {
    throw new Error("Socket or message is missing.");
  }

  const jid = message.key?.remoteJid;

  if (!jid) {
    throw new Error("Message remoteJid is missing.");
  }

  const menuText = buildMenu(message);

  await sock.sendMessage(
    jid,
    {
      text: menuText,
      mentions: message.key?.participant
        ? [message.key.participant]
        : []
    },
    {
      quoted: message
    }
  );

  return menuText;
}

module.exports = {
  buildMenu,
  sendMenu
};
