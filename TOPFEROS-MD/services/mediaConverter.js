"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| MEDIA CONVERTER
|--------------------------------------------------------------------------
|
| Converts downloaded media into WhatsApp-friendly formats.
|
| Requirements:
|   - FFmpeg must be installed on the host.
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const TEMP_DIR = path.join(
  os.tmpdir(),
  "topferos-md-media"
);
const { execFileSync } = require("child_process");

const PYTHON_PACKAGES = path.resolve(
  __dirname,
  "..",
  "python-packages"
);

function getFFmpegPath() {
  const pythonPath = [
    PYTHON_PACKAGES,
    process.env.PYTHONPATH || ""
  ].filter(Boolean).join(path.delimiter);

  try {
    return execFileSync(
      "python3",
      [
        "-c",
        "import sys; sys.path.insert(0, sys.argv[1]); import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())",
        PYTHON_PACKAGES
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PYTHONPATH: pythonPath },
        timeout: 15000
      }
    ).trim();
  } catch (error) {
    throw new Error(
      `Could not locate FFmpeg: ${error.message}`
    );
  }
}

/*
|--------------------------------------------------------------------------
| INITIALIZE TEMP DIRECTORY
|--------------------------------------------------------------------------
*/

function ensureTempDir() {
  fs.mkdirSync(
    TEMP_DIR,
    {
      recursive: true
    }
  );

  return TEMP_DIR;
}

/*
|--------------------------------------------------------------------------
| TEMP FILE
|--------------------------------------------------------------------------
*/

function createTempFile(
  extension
) {
  ensureTempDir();

  const id =
    crypto
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

function fileExists(
  filePath
) {
  try {
    return Boolean(
      filePath &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile()
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

function runFFmpeg(
  input,
  output,
  args = []
) {
  return new Promise(
    (resolve, reject) => {
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

      const ffmpegPath = getFFmpegPath();

const process =
  spawn(
    ffmpegPath,
    ffmpegArgs,
    {
      windowsHide: true
    }
  );

      let stderr = "";

      process.stderr.on(
        "data",
        (chunk) => {
          stderr +=
            chunk.toString();
        }
      );

      process.on(
        "error",
        (error) => {
          reject(
            new Error(
              `FFmpeg could not start: ${error.message}`
            )
          );
        }
      );

      process.on(
        "close",
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                stderr.trim() ||
                  `FFmpeg exited with code ${code}.`
              )
            );

            return;
          }

          if (
            !fileExists(output)
          ) {
            reject(
              new Error(
                "FFmpeg finished but output file was not created."
              )
            );

            return;
          }

          resolve(output);
        }
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| CONVERT TO WHATSAPP AUDIO
|--------------------------------------------------------------------------
*/

async function convertToAudio(
  input
) {
  if (
    !fileExists(input)
  ) {
    throw new Error(
      "Input audio file does not exist."
    );
  }

  const output =
    createTempFile("mp3");

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
}

/*
|--------------------------------------------------------------------------
| CONVERT TO WHATSAPP VIDEO
|--------------------------------------------------------------------------
*/

async function convertToVideo(
  input
) {
  if (
    !fileExists(input)
  ) {
    throw new Error(
      "Input video file does not exist."
    );
  }

  const output =
    createTempFile("mp4");

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
}

/*
|--------------------------------------------------------------------------
| REMOVE FILE
|--------------------------------------------------------------------------
*/

function removeFile(
  filePath
) {
  if (
    !filePath
  ) {
    return false;
  }

  try {
    if (
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }

    return true;
  } catch (error) {
    console.warn(
      "[MEDIA] Could not remove file:",
      error?.message ||
        error
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| REMOVE FILES
|--------------------------------------------------------------------------
*/

function removeFiles(
  files = []
) {
  for (
    const file of files
  ) {
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
  runFFmpeg,
  convertToAudio,
  convertToVideo,
  removeFile,
  removeFiles
};