# LAN Cinema

![License](https://img.shields.io/badge/license-MIT-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![Prisma](https://img.shields.io/badge/Prisma-SQLite-teal)

**LAN Cinema** is a polished, open-source personal streaming platform designed for your local network or personal server. Stream Movies, Series, and Anime seamlessly with a Netflix-inspired UI, multi-profile support, real-time Watch Together rooms, and hardware-accelerated transcoding.

## Features

- **Movies, Series & Anime Support**: Automatically organizes files into categorized libraries with season & episode tracking.
- **Smart File Scanner**: Walks your media directory, parses complex release filenames (S01E01, resolution, codecs, year), and auto-detects posters & subtitles (.srt).
- **Multi-Profile System**: Separate watch history, progress, and continue-watching queues for each family member or friend.
- **Watch Together (Sync Playback)**: Real-time synchronized video playback with live chat and emoji reactions powered by Socket.IO.
- **Built-in Transcoder**: Automatically detects incompatible video codecs (like 10-bit Hi10P MKVs) and provides 1-click or queue-based FFmpeg transcoding to MP4 (H.264 + AAC).
- **Mobile-Friendly**: Connect your phone instantly via local IP or QR code to control playback or stream on mobile devices.

## Folder Structure

Place your media files inside the `media/` directory in your project root:

```text
media/
├── Movies/
│   ├── Inception (2010).mkv
│   └── Interstellar (2014).mp4
├── Series/
│   └── Breaking Bad/
│       ├── Season 1/
│       │   ├── Breaking.Bad.S01E01.mkv
│       │   └── Breaking.Bad.S01E01.id.srt
│       └── Season 2/
└── Anime/
    └── Attack on Titan/
        ├── Season 1/
        │   └── Attack.on.Titan.S01E01.mkv
        └── Season 2/
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **FFmpeg & FFprobe** installed and added to your system PATH (required for stream probing and transcoding).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/lan-cinema.git
   cd lan-cinema
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   MEDIA_ROOT="./media"
   PORT=3000
   ```

4. **Initialize database & build**:
   ```bash
   npx prisma db push
   npm run build
   ```

5. **Start the server**:
   ```bash
   npm start
   ```
   Or simply run `start.bat` on Windows.

6. Open your browser and go to `http://localhost:3000` (or `http://<your-local-ip>:3000` from other devices on your LAN).

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React
- **Database**: Prisma ORM with SQLite
- **Real-time**: Socket.IO (for Watch Together & chat)
- **Media Processing**: Fluent FFmpeg
- **Styling**: Tailwind CSS

## License

Distributed under the [MIT License](LICENSE). See `LICENSE` for more information.
