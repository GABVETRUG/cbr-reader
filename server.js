const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createExtractorFromFile } = require('node-unrar-js');
const yauzl = require('yauzl');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const COMICS_DIR = '/Volumes/Seagate Basic/DYLAN_DOG';
const CACHE_DIR = path.join(__dirname, 'cache');
const PROGRESS_FILE = path.join(__dirname, 'progress.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Utility functions ---

function comicId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|bmp|webp|tiff?)$/i.test(name);
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// Scan comics directory recursively
function scanComics() {
  const comics = [];
  function walk(dir, folder) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, entry.name);
      } else if (/\.(cbr|cbz)$/i.test(entry.name)) {
        const id = comicId(fullPath);
        const nameWithoutExt = path.basename(entry.name, path.extname(entry.name));
        // Extract number prefix if present
        const numMatch = nameWithoutExt.match(/^(\d+)\s+(.+)$/);
        comics.push({
          id,
          filename: entry.name,
          path: fullPath,
          title: numMatch ? numMatch[2] : nameWithoutExt,
          number: numMatch ? parseInt(numMatch[1], 10) : null,
          folder: folder || '',
          type: path.extname(entry.name).toLowerCase().replace('.', '')
        });
      }
    }
  }
  walk(COMICS_DIR, '');
  comics.sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    return naturalSort(a.filename, b.filename);
  });
  return comics;
}

// Cache the comics list (refresh on demand)
let comicsCache = null;
let comicsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

function getComics() {
  const now = Date.now();
  if (!comicsCache || now - comicsCacheTime > CACHE_TTL) {
    comicsCache = scanComics();
    comicsCacheTime = now;
  }
  return comicsCache;
}

// Extract images from CBR (RAR)
async function extractCbrImages(filePath) {
  const cacheKey = comicId(filePath);
  const cacheDir = path.join(CACHE_DIR, cacheKey);

  // Check if already extracted
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir).filter(f => isImageFile(f)).sort(naturalSort);
    if (files.length > 0) return files.map(f => path.join(cacheDir, f));
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const extractor = await createExtractorFromFile({
    filepath: filePath,
    targetPath: cacheDir
  });

  // Extract all files to cacheDir
  const extracted = extractor.extract();
  // Consume the iterator to ensure extraction completes
  for (const _ of extracted.files) { /* extracted to disk */ }

  // Files are extracted to cacheDir, but may be in subdirectories — flatten them
  const results = [];
  function collectFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full);
      } else if (isImageFile(entry.name)) {
        // Move to cacheDir root if in subdirectory
        if (dir !== cacheDir) {
          const dest = path.join(cacheDir, entry.name);
          fs.renameSync(full, dest);
          results.push(dest);
        } else {
          results.push(full);
        }
      }
    }
  }
  collectFiles(cacheDir);

  results.sort((a, b) => naturalSort(path.basename(a), path.basename(b)));
  return results;
}

// Extract images from CBZ (ZIP)
function extractCbzImages(filePath) {
  return new Promise((resolve, reject) => {
    const cacheKey = comicId(filePath);
    const cacheDir = path.join(CACHE_DIR, cacheKey);

    // Check if already extracted
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir).filter(f => isImageFile(f)).sort(naturalSort);
      if (files.length > 0) {
        resolve(files.map(f => path.join(cacheDir, f)));
        return;
      }
    }

    fs.mkdirSync(cacheDir, { recursive: true });

    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      const results = [];
      const pending = [];

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName) || !isImageFile(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        const baseName = path.basename(entry.fileName);
        const outPath = path.join(cacheDir, baseName);

        pending.push(new Promise((res, rej) => {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return rej(err);
            const writeStream = fs.createWriteStream(outPath);
            readStream.pipe(writeStream);
            writeStream.on('finish', () => {
              results.push(outPath);
              res();
            });
            writeStream.on('error', rej);
          });
        }));

        zipfile.readEntry();
      });

      zipfile.on('end', async () => {
        await Promise.all(pending);
        results.sort((a, b) => naturalSort(path.basename(a), path.basename(b)));
        resolve(results);
      });

      zipfile.on('error', reject);
    });
  });
}

async function extractImages(comic) {
  if (comic.type === 'cbr') {
    return await extractCbrImages(comic.path);
  } else {
    return await extractCbzImages(comic.path);
  }
}

// Generate cover thumbnail
async function generateCover(comic) {
  const coverDir = path.join(CACHE_DIR, 'covers');
  if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

  const coverPath = path.join(coverDir, `${comic.id}.webp`);
  if (fs.existsSync(coverPath)) return coverPath;

  const images = await extractImages(comic);
  if (images.length === 0) return null;

  await sharp(images[0])
    .resize(300, 450, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(coverPath);

  return coverPath;
}

// --- API Routes ---

// List all comics
app.get('/api/comics', (req, res) => {
  const comics = getComics();
  const progress = loadProgress();
  const result = comics.map(c => ({
    id: c.id,
    title: c.title,
    number: c.number,
    folder: c.folder,
    filename: c.filename,
    progress: progress[c.id] || null
  }));
  res.json(result);
});

// Refresh comics list
app.post('/api/comics/refresh', (req, res) => {
  comicsCache = null;
  const comics = getComics();
  res.json({ count: comics.length });
});

// Get comic cover
app.get('/api/comics/:id/cover', async (req, res) => {
  const comics = getComics();
  const comic = comics.find(c => c.id === req.params.id);
  if (!comic) return res.status(404).json({ error: 'Comic not found' });

  try {
    const coverPath = await generateCover(comic);
    if (!coverPath) return res.status(404).json({ error: 'No cover' });
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(coverPath);
  } catch (err) {
    console.error(`Error generating cover for ${comic.filename}:`, err.message);
    res.status(500).json({ error: 'Failed to generate cover' });
  }
});

// Get comic page count
app.get('/api/comics/:id/info', async (req, res) => {
  const comics = getComics();
  const comic = comics.find(c => c.id === req.params.id);
  if (!comic) return res.status(404).json({ error: 'Comic not found' });

  try {
    const images = await extractImages(comic);
    res.json({
      id: comic.id,
      title: comic.title,
      number: comic.number,
      folder: comic.folder,
      pageCount: images.length
    });
  } catch (err) {
    console.error(`Error getting info for ${comic.filename}:`, err.message);
    res.status(500).json({ error: 'Failed to get comic info' });
  }
});

// Get specific page
app.get('/api/comics/:id/pages/:page', async (req, res) => {
  const comics = getComics();
  const comic = comics.find(c => c.id === req.params.id);
  if (!comic) return res.status(404).json({ error: 'Comic not found' });

  const pageNum = parseInt(req.params.page, 10);

  try {
    const images = await extractImages(comic);
    if (pageNum < 0 || pageNum >= images.length) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(images[pageNum]);
  } catch (err) {
    console.error(`Error getting page ${pageNum} for ${comic.filename}:`, err.message);
    res.status(500).json({ error: 'Failed to get page' });
  }
});

// --- Reading Progress ---

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/progress', (req, res) => {
  res.json(loadProgress());
});

app.post('/api/progress/:id', (req, res) => {
  const progress = loadProgress();
  progress[req.params.id] = {
    page: req.body.page,
    totalPages: req.body.totalPages,
    timestamp: Date.now()
  };
  saveProgress(progress);
  res.json({ ok: true });
});

// --- SPA fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         📚 CBR Reader is running         ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}          ║`);
  console.log(`  ║  Network: http://${localIP}:${PORT}    ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Comics directory: ${COMICS_DIR}`);
  console.log(`  Open the Network URL on your phone!`);
  console.log('');
});
