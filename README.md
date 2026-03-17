# CBR Reader

A dark, immersive comic book reader webapp designed for reading CBR/CBZ files from your local filesystem on your phone.

Built for browsing a **Dylan Dog** collection of 310 issues, but works with any CBR/CBZ comic library.

## Features

### Library
- **Cover grid** with auto-generated WebP thumbnails
- **"Stai leggendo"** — horizontal row of in-progress comics at the top, auto-collapses on scroll
- **Search & filter** — find comics by title, number, or folder
- **Organization bar** — filter by All / Favorites / custom folders / custom categories

### Reader
- **Dual reading mode** — horizontal swipe (comic-style) or vertical scroll (webtoon-style), switchable on the fly
- **Tap-to-toggle immersive mode** — tap the page to hide/show controls for distraction-free reading
- **Full-screen landscape** — no wasted space, the comic fills the entire screen
- **Reading progress** — automatically saves your last page for every comic

### Favorites & Organization
- **Tap the heart** on any cover to toggle favorite
- **Color tags** — 8 color palette to visually tag comics
- **Custom folders & categories** — create and assign on the fly
- **Long-press** (mobile) or **right-click** (desktop) for full action sheet

### Notes
- **Per-comic notes** — add, edit, and delete text notes for any comic
- Accessible from the reader toolbar or the action sheet in the library

### General
- **PWA** — install on your home screen for a full-screen, app-like experience (iOS & Android)
- **MongoDB** backend for persistent storage of progress, favorites, notes
- **Mobile-first** — touch gestures, generous tap targets, smooth transitions
- **Local network access** — open it on your phone from the same WiFi, no internet required
- **Remote access** — use Tailscale (or similar VPN) to read from anywhere

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Database | MongoDB (local instance) |
| CBR extraction | node-unrar-js (WASM) |
| CBZ extraction | yauzl |
| Thumbnails | sharp (WebP) |
| Frontend | Vanilla HTML/CSS/JS |

## Prerequisites

- **Node.js** (v18+)
- **MongoDB** running locally on the default port (`mongodb://localhost:27017`)

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

On first run, the app will:
- Connect to MongoDB and create the `cbr_reader` database
- Seed 8 default color tags
- Migrate any existing `progress.json` to MongoDB automatically

## Configuration

Edit the `COMICS_DIR` variable in `server.js` to point to your comics folder:

```js
const COMICS_DIR = '/path/to/your/comics';
```

The app scans subdirectories recursively and supports both `.cbr` (RAR) and `.cbz` (ZIP) files.

## Project Structure

```
cbr_reader/
├── server.js           # Express backend — API, MongoDB, extraction, covers
├── db.js               # MongoDB connection, indexes, color seeding
├── package.json
├── public/
│   ├── index.html      # SPA — library, reader, action sheet, notes panel
│   ├── css/style.css   # Dark theme, responsive layout, all UI components
│   └── js/app.js       # Frontend logic, gestures, favorites, notes
└── cache/              # Auto-generated at runtime
    ├── covers/         # WebP thumbnails (300x450)
    └── <comic-hash>/   # Extracted pages per comic
```

## API

### Comics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comics` | List all comics with progress and favorites |
| POST | `/api/comics/refresh` | Force refresh comics list |
| GET | `/api/comics/:id/cover` | Cover thumbnail (WebP) |
| GET | `/api/comics/:id/info` | Comic metadata + page count |
| GET | `/api/comics/:id/pages/:page` | Single page image |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | All reading progress |
| POST | `/api/progress/:id` | Save reading progress |

### Favorites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/favorites` | All favorites |
| PUT | `/api/favorites/:id` | Set/update favorite |
| DELETE | `/api/favorites/:id` | Remove favorite |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes/:comicId` | Notes for a comic |
| POST | `/api/notes/:comicId` | Add a note |
| PUT | `/api/notes/:comicId/:noteId` | Edit a note |
| DELETE | `/api/notes/:comicId/:noteId` | Delete a note |

### Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-folders` | List folders and categories |
| POST | `/api/user-folders` | Create folder/category |
| DELETE | `/api/user-folders/:id` | Delete folder/category |
| GET | `/api/user-colors` | List color palette |
| POST | `/api/user-colors` | Add custom color |

## Install as App (PWA)

**iPhone (Safari):**
1. Open the reader URL in Safari
2. Tap the **Share** icon (square with arrow)
3. Tap **"Add to Home Screen"**

**Android (Chrome):**
- Tap the **"Install app"** banner, or: menu → "Install app"

The app opens in standalone mode — no browser bar, full-screen, with a custom icon.

## Roadmap

- [x] MongoDB for persistent storage
- [x] Favorites with folders, color tags, and categories
- [x] Per-comic notes
- [x] "Stai leggendo" section with collapsible scroll
- [x] PWA support for home screen install
- [ ] Multi-library support (multiple comic directories)

## License

MIT
