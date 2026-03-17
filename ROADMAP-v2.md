# CBR Reader v2 — Roadmap: MongoDB + Preferiti + Note

## Obiettivo

Migrare il salvataggio dati da `progress.json` a MongoDB e aggiungere:
- Sistema preferiti con organizzazione (cartelle, colori, categorie)
- Note testuali per ogni fumetto

---

## 1. Schema MongoDB

**Database:** `cbr_reader` (istanza locale `mongodb://localhost:27017`)

### Collection: `progress`
| Campo | Tipo | Note |
|-------|------|------|
| `_id` | string | comicId (hash MD5 12 char) |
| `page` | number | Pagina corrente (0-indexed) |
| `totalPages` | number | Totale pagine |
| `timestamp` | number | Date.now() |

### Collection: `favorites`
| Campo | Tipo | Note |
|-------|------|------|
| `_id` | string | comicId |
| `isFavorite` | boolean | |
| `color` | string/null | Hex color tag (es. `#d4a054`) |
| `folder` | string/null | Nome cartella utente |
| `compartment` | string/null | Nome categoria utente |
| `createdAt` | number | timestamp creazione |
| `updatedAt` | number | timestamp ultimo aggiornamento |

### Collection: `notes`
| Campo | Tipo | Note |
|-------|------|------|
| `_id` | ObjectId | Auto-generato |
| `comicId` | string | Index, ref a comic |
| `text` | string | Contenuto della nota |
| `createdAt` | number | |
| `updatedAt` | number | |

### Collection: `user_folders`
| Campo | Tipo | Note |
|-------|------|------|
| `_id` | ObjectId | |
| `name` | string | Nome della cartella/categoria |
| `type` | string | `"folder"` o `"compartment"` |
| `createdAt` | number | |

Unique index su `{ name, type }`.

### Collection: `user_colors`
| Campo | Tipo | Note |
|-------|------|------|
| `_id` | ObjectId | |
| `hex` | string | Colore hex (es. `#ff5555`) |
| `label` | string | Etichetta (es. `"Rosso"`) |
| `createdAt` | number | |

Seed di 8 colori di default al primo avvio.

---

## 2. Nuovi API Endpoints

### Preferiti
```
GET    /api/favorites              → Lista tutti i preferiti
PUT    /api/favorites/:id          → Imposta/aggiorna { isFavorite, color, folder, compartment }
DELETE /api/favorites/:id          → Rimuovi dai preferiti
```

### Note
```
GET    /api/notes/:comicId         → Lista note per fumetto
POST   /api/notes/:comicId         → Aggiungi nota { text }
PUT    /api/notes/:comicId/:noteId → Modifica nota { text }
DELETE /api/notes/:comicId/:noteId → Elimina nota
```

### Cartelle e Categorie utente
```
GET    /api/user-folders           → { folders: [...], compartments: [...] }
POST   /api/user-folders           → Crea { name, type: "folder"|"compartment" }
DELETE /api/user-folders/:id       → Elimina
```

### Palette colori
```
GET    /api/user-colors            → Lista colori disponibili
POST   /api/user-colors            → Aggiungi { hex, label }
```

### Endpoint esistenti modificati
```
GET    /api/comics                 → Aggiunge campo "favorite" per ogni fumetto
GET    /api/progress               → Legge da MongoDB
POST   /api/progress/:id           → Scrive su MongoDB
```

---

## 3. Nuova dipendenza

```json
"mongodb": "^6.3.0"
```

Driver nativo MongoDB (no Mongoose — coerente con lo stile semplice del progetto).

---

## 4. Nuovo file: `db.js`

Modulo condiviso per la connessione MongoDB:
- `connect()` — connessione + creazione indici
- `getDb()` — ritorna istanza db
- `close()` — chiude connessione
- Creazione indici automatica: `notes.comicId`, `user_folders.{name,type}` unique

---

## 5. Migrazione progress.json → MongoDB

Al primo avvio con MongoDB:
1. Check se `progress.json` esiste
2. Se collection `progress` è vuota → bulk insert da JSON
3. Rinomina `progress.json` → `progress.json.bak`
4. Operazione idempotente (skip se dati già presenti)

---

## 6. Modifiche Frontend

### Nuovi componenti UI

#### Action Sheet (bottom sheet)
- Attivato da **long-press** su card fumetto in libreria
- Opzioni: Toggle Preferito, Colore, Cartella, Categoria, Note
- Slide-up con backdrop semi-trasparente + blur

#### Indicatori sulle card
- **Cuore** (top-right della cover) per i preferiti
- **Pallino colorato** (top-left) per il color tag

#### Barra Organizzazione
- Nuova riga di chip sotto i filtri: "Tutti" / "Preferiti" / cartelle / categorie
- Filtra la griglia in base alla selezione

#### Pannello Note (nel reader)
- Nuovo pulsante "Note" nella toolbar del reader
- Pannello slide-up con lista note + textarea per aggiungere
- Ogni nota mostra testo, data, pulsanti modifica/elimina

### Modifiche allo state JS
```js
// Nuovi campi in state
favorites: {}           // { comicId: { isFavorite, color, folder, compartment } }
userFolders: []         // nomi cartelle utente
userCompartments: []    // nomi categorie utente
userColors: []          // palette colori
activeView: 'all'       // filtro attivo: 'all' | 'favorites' | nome cartella/categoria
```

---

## 7. Ordine di implementazione

| Step | Descrizione | File |
|------|-------------|------|
| 1 | `npm install mongodb` | package.json |
| 2 | Creare `db.js` (connessione + indici) | db.js (nuovo) |
| 3 | Migrazione progress + endpoint async | server.js |
| 4 | **TEST**: verificare app funziona con MongoDB | — |
| 5 | Endpoint preferiti + cartelle/colori | server.js |
| 6 | Endpoint note | server.js |
| 7 | Aggiornare `GET /api/comics` con join preferiti | server.js |
| 8 | HTML: action sheet, pannello note, barra organizzazione | index.html |
| 9 | CSS: stili nuovi componenti | style.css |
| 10 | JS: stato, API, render, gesture, logica UI | app.js |
| 11 | Seed colori di default | db.js / server.js |
| 12 | **TEST end-to-end** | — |

---

## 8. Verifica finale

```bash
# Verificare MongoDB
mongosh
use cbr_reader
db.progress.find().limit(3)
db.favorites.find()
db.notes.find()
db.user_folders.find()
db.user_colors.find()
```

- [ ] Progresso salvato/caricato da MongoDB
- [ ] Long-press su card → action sheet funzionante
- [ ] Toggle preferito → cuore visibile
- [ ] Assegnare colore → pallino sulla card
- [ ] Assegnare cartella/categoria
- [ ] Filtrare per preferiti/cartella/categoria
- [ ] Note nel reader → aggiungere/modificare/eliminare
- [ ] App funzionante su mobile (landscape + portrait)
- [ ] `progress.json` migrato e rinominato in `.bak`

---

## 9. Decisioni architetturali

| Decisione | Motivazione |
|-----------|-------------|
| Driver nativo MongoDB (no Mongoose) | Coerente con lo stile semplice del progetto, nessun overhead ORM |
| `comicId` come `_id` in `progress` e `favorites` | Index gratuito, upsert pulito, un documento per fumetto |
| Collection separata per `notes` | Un fumetto può avere più note, serve ObjectId + index |
| Long-press per action sheet | Mantiene il layout card pulito, gesture naturale su mobile |
| Organizzazione flat (no cartelle annidate) | Evita complessità ad albero, un campo folder + un campo compartment |
| Colori come hex nella favorites | Semplice, diretto. `user_colors` è solo palette di riferimento per UI |
