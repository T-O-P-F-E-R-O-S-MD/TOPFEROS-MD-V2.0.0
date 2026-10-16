
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| MEDIA CONVERTER
|--------------------------------------------------------------------------
|
| Konvèti fichye medya pou WhatsApp.
| FFmpeg jwenn li atravè imageio-ffmpeg.
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");

const TEMP_DIR = path.join(
  os.tmpdir(),
  "topferos-md-media"
);

const PYTHON_PACKAGES = path.resolve(
  __dirname,
  "..",
  "python-packages"
);

/*
|--------------------------------------------------------------------------
| GET FFMPEG PATH
|--------------------------------------------------------------------------
*/

function getFFmpegPath() {
  const pythonPath = [
    PYTHON_PACKAGES,
    process.env.PYTHONPATH || ""
  ]
    .filter(Boolean)
    .join(path.delimiter);

  try {
    const ffmpegPath = execFileSync(
      "python3",
      [
        "-c",
        "import sys; sys.path.insert(0, sys.argv[1]); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())",
        PYTHON_PACKAGES
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PYTHONPATH: pythonPath
        },
        timeout: 15000
      }
    ).trim();

    if (!ffmpegPath) {
      throw new Error("Chemen FFmpeg la vid.");
    }

    return ffmpegPath;
  } catch (error) {
    throw new Error(
      `Li pa posib jwenn FFmpeg: ${error.message}`
    );
  }
}

/*
|--------------------------------------------------------------------------
| TEMP DIRECTORY
|--------------------------------------------------------------------------
*/

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, {
    recursive: true
  });

  return TEMP_DIR;
}

/*
|--------------------------------------------------------------------------
| CREATE TEMP FILE
|--------------------------------------------------------------------------
*/

function createTempFile(extension = "bin") {
  ensureTempDir();

  const id = crypto
    .randomBytes(12)
    .toString("hex");

  return path.join(
    TEMP_DIR,
    `${Date.now()}-${id}.${extension}`
  );
}

/*
|--------------------------------------------------------------------------
| CHECK FILE
|--------------------------------------------------------------------------
*/

function fileExists(filePath) {
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

/*
|--------------------------------------------------------------------------
| RUN FFMPEG
|--------------------------------------------------------------------------
*/

function runFFmpeg(input, output, args = []) {
  return new Promise((resolve, reject) => {
    if (!fileExists(input)) {
      reject(
        new Error("Fichye antre a pa egziste oswa li vid.")
      );
      return;
    }

    ensureTempDir();

    let ffmpegPath;

    try {
      ffmpegPath = getFFmpegPath();
    } catch (error) {
      reject(error);
      return;
    }

    const ffmpegArgs = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      ...args,
      output
    ];

    const child = spawn(
      ffmpegPath,
      ffmpegArgs,
      {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"]
      }
    );

    let stderr = "";
    let settled = false;

    function fail(error) {
      if (settled) return;

      settled = true;

      try {
        fs.rmSync(output, { force: true });
      } catch {}

      reject(error);
    }

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();

      if (stderr.length > 20000) {
        stderr = stderr.slice(-20000);
      }
    });

    child.on("error", error => {
      fail(
        new Error(
          `FFmpeg pa t kapab demare: ${error.message}`
        )
      );
    });

    child.on("close", code => {
      if (settled) return;

      if (code !== 0) {
        fail(
          new Error(
            stderr.trim() ||
            `FFmpeg fini ak kòd erè ${code}.`
          )
        );
        return;
      }

      if (!fileExists(output)) {
        fail(
          new Error(
            "FFmpeg fini, men fichye rezilta a pa egziste oswa li vid."
          )
        );
        return;
      }

      settled = true;
      resolve(output);
    });
  });
}

/*
|--------------------------------------------------------------------------
| CONVERT TO MP3
|--------------------------------------------------------------------------
*/

async function convertToAudio(input) {
  if (!fileExists(input)) {
    throw new Error(
      "Fichye odyo oswa videyo antre a pa egziste."
    );
  }

  const output = createTempFile("mp3");

  try {
    await runFFmpeg(
      input,
      output,
      [
        "-vn",
        "-map_metadata",
        "-1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2"
      ]
    );

    return output;
  } catch (error) {
    removeFile(output);
    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| CONVERT TO MP4
|--------------------------------------------------------------------------
*/

async function convertToVideo(input) {
  if (!fileExists(input)) {
    throw new Error(
      "Fichye videyo antre a pa egziste."
    );
  }

  const output = createTempFile("mp4");

  try {
    await runFFmpeg(
      input,
      output,
      [
        "-map_metadata",
        "-1",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart"
      ]
    );

    return output;
  } catch (error) {
    removeFile(output);
    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| REMOVE ONE FILE
|--------------------------------------------------------------------------
*/

function removeFile(filePath) {
  if (!filePath) return false;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return true;
  } catch (error) {
    console.warn(
      "[MEDIA CONVERTER] Erè pandan netwayaj:",
      error.message
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| REMOVE MULTIPLE FILES
|--------------------------------------------------------------------------
*/

function removeFiles(files = []) {
  for (const file of files) {
    removeFile(file);
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  TEMP_DIR,
  ensureTempDir,
  createTempFile,
  fileExists,
  getFFmpegPath,
  runFFmpeg,
  convertToAudio,
  convertToVideo,
  removeFile,
  removeFiles
};
