# CBR Reader

A dark, immersive comic book reader webapp designed for reading CBR/CBZ files from your local filesystem on your phone.

Built for browsing a **Dylan Dog** collection of 310 issues, but works with any CBR/CBZ comic library.

## Features

- **Library grid** with auto-generated cover thumbnails
- **Dual reading mode** — horizontal swipe (comic-style) or vertical scroll (webtoon-style), switchable on the fly
- **Tap-to-toggle immersive mode** — tap the page to hide/show controls for distraction-free reading
- **Full-screen landscape** — no wasted space, the comic fills the entire screen
- **Reading progress** — automatically saves your last page for every comic
- **Search & filter** — find comics by title, number, or folder
- **Mobile-first** — touch gestures, generous tap targets, smooth transitions
- **Local network access** — open it on your phone from the same WiFi, no internet required

## Screenshots

The UI follows a dark & immersive design with amber/gold accents — controls fade into the background so the comic art takes center stage.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| CBR extraction | node-unrar-js (WASM) |
| CBZ extraction | yauzl |
| Thumbnails | sharp (WebP) |
| Frontend | Vanilla HTML/CSS/JS |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/GABVETRUG/cbr-reader.git
cd cbr-reader

# Install dependencies
npm install

# Start the server
npm start
```

The server starts on port **3000** and prints the local network URL:

```
  ╔══════════════════════════════════════════╗
  ║         📚 CBR Reader is running         ║
  ╠══════════════════════════════════════════╣
  ║  Local:   http://localhost:3000          ║
  ║  Network: http://192.168.1.x:3000       ║
  ╚══════════════════════════════════════════╝
```

Open the **Network URL** on your phone (same WiFi) to start reading.

## Configuration

Edit the `COMICS_DIR` variable in `server.js` to point to your comics folder:

```js
const COMICS_DIR = '/path/to/your/comics';
```

The app scans subdirectories recursively and supports both `.cbr` (RAR) and `.cbz` (ZIP) files.

## Project Structure

```
cbr_reader/
├── server.js           # Express backend — API, extraction, cover generation
├── db.js               # Database connection (coming in v2)
├── package.json
├── public/
│   ├── index.html      # SPA — library + reader views
│   ├── css/style.css   # Dark theme, responsive layout
│   └── js/app.js       # Frontend logic, gestures, state
└── cache/              # Auto-generated at runtime
    ├── covers/         # WebP thumbnails (300x450)
    └── <comic-hash>/   # Extracted pages per comic
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comics` | List all comics with progress |
| GET | `/api/comics/:id/cover` | Cover thumbnail (WebP) |
| GET | `/api/comics/:id/info` | Comic metadata + page count |
| GET | `/api/comics/:id/pages/:page` | Single page image |
| POST | `/api/progress/:id` | Save reading progress |

## Roadmap

- [ ] MongoDB for persistent storage
- [ ] Favorites with folders, color tags, and categories
- [ ] Per-comic notes
- [ ] PWA support for home screen install

## License

MIT
