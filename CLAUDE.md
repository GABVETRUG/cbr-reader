# CBR Reader — Comic Book Web Reader

## Project Overview
A self-hosted webapp for reading CBR (Comic Book Archive) files from a local filesystem, accessible from mobile phones on the local network.

## Tech Stack
- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS — mobile-first, no heavy frameworks
- **File handling:** CBR extraction (RAR archives containing images)

## Design Context

### Users
Comic book readers accessing their personal CBR collection from a mobile phone on a local network. Primary device is a smartphone, used casually at home.

### Brand Personality
**Immersive. Effortless. Cinematic.**

### Aesthetic Direction
- Dark & immersive theme. Deep blacks/charcoal, comic art pops with full vibrancy.
- Minimal chrome. Controls fade during reading. The comic page IS the interface.
- Single warm accent color (amber/gold) for interactive elements.
- Smooth, physics-based transitions. Gentle fade-ins.
- Anti-references: No file-manager look, no enterprise UI, no bright white backgrounds.

### Design Principles
1. **Content is King** — Comic page dominates viewport. Hide what isn't needed.
2. **Touch-First** — Designed for thumbs on glass. Generous tap targets, natural gestures.
3. **Seamless Flow** — Fluid transitions, no jarring jumps.
4. **Quiet Until Needed** — Controls reveal on tap, fade on their own.
5. **Warm & Inviting** — Cozy and personal, not cold or technical.

### Features
- Cover art library grid
- Dual navigation: horizontal swipe + vertical scroll (user-switchable)
- Reading progress / bookmarks
- Pinch-to-zoom with pan
