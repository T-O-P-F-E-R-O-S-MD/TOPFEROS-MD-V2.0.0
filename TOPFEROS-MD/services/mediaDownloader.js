
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const axios = require("axios");
const { spawn } = require("child_process");

const PROJECT_DIR = path.resolve(__dirname, "..");
const PYTHON_PACKAGES = path.join(PROJECT_DIR, "python-packages");
const TEMP_DIR = path.join(os.tmpdir(), "topferos-md-media");
const MAX_REDIRECTS = 5;

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

function createTempFile(extension = "bin") {
  ensureTempDir();
  const id = crypto.randomBytes(12).toString("hex");
  return path.join(TEMP_DIR, `${Date.now()}-${id}.${extension}`);
}

function normalizeUrl(value) {
  const input = String(value || "").trim();

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("A valid HTTP or HTTPS URL is required.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  return parsed.toString();
}

function getExtension(url, contentType = "") {
  try {
    const extension = path.extname(new URL(url).pathname)
      .replace(".", "")
      .toLowerCase();

    if (extension && /^[a-z0-9]{1,8}$/.test(extension)) {
      return extension;
    }
  } catch {}

  const types = {
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return types[String(contentType).toLowerCase().split(";")[0].trim()] || "bin";
}

function runYtDlp(url, outputTemplate) {
  return new Promise((resolve, reject) => {
    const pythonPath = [
      PYTHON_PACKAGES,
      process.env.PYTHONPATH || ""
    ].filter(Boolean).join(path.delimiter);

    const child = spawn(
      "python3",
      [
        "-m", "yt_dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--restrict-filenames",
        "--max-filesize", "100M",
        "--socket-timeout", "30",
        "-o", outputTemplate,
        url
      ],
      {
        env: { ...process.env, PYTHONPATH: pythonPath },
        windowsHide: true
      }
    );

    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", error => {
      reject(new Error(`yt-dlp could not start: ${error.message}`));
    });

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}.`));
        return;
      }

      const prefix = outputTemplate.split(".%(ext)s")[0];
      const files = fs.readdirSync(TEMP_DIR)
        .filter(name => name.startsWith(path.basename(prefix) + "."))
        .map(name => path.join(TEMP_DIR, name))
        .filter(file => {
          try {
            return fs.statSync(file).isFile() && fs.statSync(file).size > 0;
          } catch {
            return false;
          }
        });

      if (!files.length) {
        reject(new Error("yt-dlp finished but no output media file was found."));
        return;
      }

      files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      resolve(files[0]);
    });
  });
}

async function downloadMedia(inputUrl, options = {}) {
  const url = normalizeUrl(inputUrl);
  ensureTempDir();

  const isDirectFile = /\.(mp3|m4a|aac|ogg|wav|mp4|m4v|mov|webm|jpg|jpeg|png|webp)(?:$)/i
    .test(new URL(url).pathname);

  if (!isDirectFile && options.useYtDlp !== false) {
    const template = createTempFile("download").replace(/\.download$/, ".%(ext)s");
    const filePath = await runYtDlp(url, template);
    const stats = fs.statSync(filePath);

    return {
      success: true,
      url,
      path: filePath,
      size: stats.size,
      contentType: "",
      extension: path.extname(filePath).slice(1)
    };
  }

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: Number(options.timeout || 120000),
    maxRedirects: Number(options.maxRedirects || MAX_REDIRECTS),
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 300,
    headers: { "User-Agent": "TOPFEROS-MD/2.0.0" }
  });

  const contentType = String(response.headers["content-type"] || "");
  const extension = options.extension || getExtension(url, contentType);
  const output = options.output || createTempFile(extension);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(output);
    const fail = error => {
      writer.destroy();
      fs.rm(output, { force: true }, () => {});
      reject(error);
    };

    response.data.on("error", fail);
    writer.on("error", fail);
    writer.on("finish", resolve);
    response.data.pipe(writer);
  });

  const stats = fs.statSync(output);
  return {
    success: true,
    url,
    path: output,
    size: stats.size,
    contentType,
    extension
  };
}

function isMediaFile(filePath) {
  try {
    return Boolean(
      filePath &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile() &&
      fs.statSync(filePath).size > 0
    );
  } catch {
    return false;
  }
}

function removeFile(filePath) {
  if (!filePath) return false;

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.warn("[MEDIA DOWNLOADER] Cleanup failed:", error.message);
    return false;
  }
}

module.exports = {
  TEMP_DIR,
  ensureTempDir,
  createTempFile,
  normalizeUrl,
  getExtension,
  downloadMedia,
  isMediaFile,
  removeFile
};
