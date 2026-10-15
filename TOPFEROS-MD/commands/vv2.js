"use strict";

// 🦁 TOPFEROS MD V2.0.0
// VV2 / VVV COMMAND REGISTRATION

const fs = require('fs');
const path = require('path');
const {
  downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const SAVE_DIR = path.join(__dirname, 'media-saves');
fs.mkdirSync(SAVE_DIR, { recursive: true });

const MEDIA_TYPES = [
  'image',
  'video',
  'audio',
  'document'
];

function getMediaType(message) {
  if (!message) return null;

  for (const type of MEDIA_TYPES) {
    if (message[`${type}Message`]) {
      return type;
    }
  }

  return null;
}

function isViewOnce(message) {
  if (!message) return false;

  if (
    message.viewOnceMessage ||
    message.viewOnceMessageV2 ||
    message.viewOnceMessageV2Extension
  ) {
    return true;
  }

  return false;
}

function getQuotedMessage(message) {
  const context =
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.documentMessage?.contextInfo;

  return context?.quotedMessage || null;
}

async function downloadAndSave(mediaMessage, type) {
  const stream = await downloadContentFromMessage(
    mediaMessage,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    throw new Error('Medya a vid.');
  }

  // Limite gwosè a 25 MB.
  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error('Medya a twò gwo (maksimòm 25 MB).');
  }

  const extensions = {
    image: 'jpg',
    video: 'mp4',
    audio: 'bin',
    document: 'bin'
  };

  const filename =
    `media_${Date.now()}.${extensions[type] || 'bin'}`;

  const filepath = path.join(SAVE_DIR, filename);

  fs.writeFileSync(filepath, buffer, { flag: 'wx' });

  return filename;
}

// Mete fonksyon sa a nan message handler bot ou a.
async function handleVVCommands(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;

  const chatId = msg.key.remoteJid;
  const isDM = chatId.endsWith('@s.whatsapp.net');

  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    '';

  const command = body.trim().split(/\s+/)[0].toLowerCase();

  if (!['.vv2', '.vvv', '.vvhelp'].includes(command)) {
    return;
  }

  if (command === '.vvhelp') {
    return sock.sendMessage(chatId, {
      text:
        '📌 KÒMAND MEDYA\n\n' +
        '.vv2 — Reponn yon medya nòmal nan menm chat la.\n' +
        '.vvv — Voye medya nòmal la ak kòmand sa a nan DM bot la.\n\n' +
        'Medya View Once ki pwoteje yo pa sipòte.'
    }, { quoted: msg });
  }

  // .vvv disponib sèlman nan DM bot la.
  if (command === '.vvv' && !isDM) {
    return sock.sendMessage(chatId, {
      text: '⚠️ Sèvi ak .vvv nan DM bot la.'
    }, { quoted: msg });
  }

  // .vv2 bezwen yon mesaj medya nòmal an referans.
  // .vvv ka itilize medya ki vini ak kòmand lan,
  // oswa yon medya nòmal itilizatè a site.
  const quoted = getQuotedMessage(msg.message);
  const currentMessage = msg.message;

  if (
    isViewOnce(currentMessage) ||
    isViewOnce(quoted)
  ) {
    return sock.sendMessage(chatId, {
      text: '🔒 Medya View Once sa a pa ka trete pa fonksyon sa a.'
    }, { quoted: msg });
  }

  let mediaMessage;
  let type;

  if (command === '.vv2') {
    if (!quoted) {
      return sock.sendMessage(chatId, {
        text: '📌 Reponn yon imaj, videyo, odyo oswa dokiman nòmal ak .vv2.'
      }, { quoted: msg });
    }

    type = getMediaType(quoted);
    mediaMessage = type ? quoted[`${type}Message`] : null;
  } else {
    type = getMediaType(currentMessage);
    mediaMessage = type ? currentMessage[`${type}Message`] : null;

    if (!mediaMessage && quoted) {
      type = getMediaType(quoted);
      mediaMessage = type ? quoted[`${type}Message`] : null;
    }
  }

  if (!mediaMessage || !type) {
    return sock.sendMessage(chatId, {
      text: '❌ Mwen pa jwenn medya nòmal pou konsève.'
    }, { quoted: msg });
  }

  try {
    const filename = await downloadAndSave(mediaMessage, type);

    await sock.sendMessage(chatId, {
      text:
        '✅ Medya a konsève avèk siksè!\n' +
        `📁 Fichye: ${filename}\n` +
        '📂 Dosye: media-saves'
    }, { quoted: msg });
  } catch (error) {
    console.error('VV command error:', error.message);

    await sock.sendMessage(chatId, {
      text: '❌ Mwen pa t kapab konsève medya a. Verifye koneksyon an, gwosè medya a ak aksè depo a.'
    }, { quoted: msg });
  }
}

module.exports = { handleVVCommands };