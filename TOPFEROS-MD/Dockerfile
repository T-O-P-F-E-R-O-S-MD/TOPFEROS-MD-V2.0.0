
FROM node:22-bookworm-slim

# Install FFmpeg and yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Verify both tools during the build
RUN echo "===== FFMPEG VERSION =====" \
    && ffmpeg -version \
    && echo "===== YT-DLP VERSION =====" \
    && yt-dlp --version

# Application directory
WORKDIR /app

# Install dependencies first for better build caching
COPY package*.json ./
RUN npm install

# Copy the complete project
COPY . .

# Render provides the PORT environment variable
EXPOSE 3000

# Start TOPFEROS MD
CMD ["npm", "start"]
