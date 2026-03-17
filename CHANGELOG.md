# CBR Reader — Changelog & Documentazione Progetto

## Struttura del progetto

```
cbr_reader/
├── server.js                 # Backend Express — API REST, estrazione CBR/CBZ, generazione cover
├── package.json              # Dipendenze: express, node-unrar-js, yauzl, sharp
├── package-lock.json
├── progress.json             # Progresso lettura per fumetto (generato automaticamente)
├── .impeccable.md            # Design context — linee guida estetiche del progetto
├── CLAUDE.md                 # Contesto progetto per Claude Code
├── CHANGELOG.md              # Questo file
├── .gitignore                # Esclude node_modules/, cache/, .DS_Store
├── public/
│   ├── index.html            # SPA — struttura HTML (libreria + reader)
│   ├── css/
│   │   └── style.css         # Tema dark & immersivo, layout responsive
│   └── js/
│       └── app.js            # Logica frontend — navigazione, gesture, stato
├── cache/                    # Cache immagini estratte e copertine (generato a runtime)
│   ├── covers/               # Copertine WebP 300x450 generate con sharp
│   └── <comic-hash>/         # Pagine estratte per ogni fumetto aperto
└── node_modules/
```

## Stack tecnologico

| Componente | Tecnologia | Note |
|---|---|---|
| Backend | Node.js + Express | Serve su `0.0.0.0:3000`, accessibile da rete locale |
| Estrazione CBR | `node-unrar-js` | WASM-based, estrae su disco con `targetPath` |
| Estrazione CBZ | `yauzl` | Per i file .cbz (ZIP) |
| Thumbnails | `sharp` | Genera copertine WebP 300x450 |
| Frontend | Vanilla HTML/CSS/JS | Zero framework, mobile-first |

## API Endpoints

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/comics` | Lista tutti i fumetti con progresso lettura |
| POST | `/api/comics/refresh` | Forza refresh della lista fumetti |
| GET | `/api/comics/:id/cover` | Copertina WebP (cached, max-age 24h) |
| GET | `/api/comics/:id/info` | Info fumetto: titolo, numero, conteggio pagine |
| GET | `/api/comics/:id/pages/:page` | Immagine singola pagina (cached, max-age 24h) |
| GET | `/api/progress` | Tutto il progresso di lettura |
| POST | `/api/progress/:id` | Salva progresso (body: `{page, totalPages}`) |

## Sorgente fumetti

- **Path**: `/Volumes/Seagate Basic/DYLAN_DOG/`
- **Struttura**: Due sottocartelle (`001 al 150`, `151 al 310`)
- **Totale**: 310 numeri (294 .cbr, 15 .cbz, 1 .CBR)
- **Naming**: `NNN Titolo.cbr` (es. `001 L'alba dei morti viventi.cbr`)
- **ID fumetto**: Hash MD5 troncato a 12 char del path completo

## Avvio

```bash
cd "/Volumes/Extreme SSD/claude_projects/cbr_reader"
npm start
```

Il server stampa l'indirizzo di rete locale (es. `http://192.168.1.8:3000`) da aprire sul telefono.

---

## Cronologia modifiche

### v1.0 — Setup iniziale

- Creato backend Express con scan ricorsivo della directory fumetti
- Estrazione immagini da CBR (RAR) e CBZ (ZIP) con caching su disco
- Generazione copertine WebP ridimensionate con `sharp`
- API REST per lista fumetti, copertine, pagine, progresso lettura
- Frontend SPA con due viste: Libreria e Reader
- Libreria: griglia copertine con lazy loading (IntersectionObserver), ricerca, filtri per cartella
- Reader: modalità swipe orizzontale con gesture touch
- Tema dark & immersivo con accenti ambra/oro
- Salvataggio progresso lettura su file JSON
- Server esposto su `0.0.0.0` per accesso da rete locale

**Bug fix durante sviluppo:**
- `node-unrar-js` con `createExtractorFromFile` non popola `file.extraction` in memoria — risolto usando `targetPath` per estrarre direttamente su disco e poi leggere i file dal filesystem

### v1.1 — Toolbar fissa e controlli sempre visibili

**Problema**: Header del reader usava un gradiente trasparente quasi invisibile, i controlli si nascondevano automaticamente dopo 4 secondi e non era chiaro come recuperarli. Pulsanti back/home e cambio modalità non visibili.

**Modifiche:**
- Rimosso auto-hide della UI (timer 4s)
- Header del reader: sfondo solido scuro con `backdrop-filter: blur`, sempre visibile
  - Freccia indietro (sinistra) per tornare alla libreria
  - Titolo fumetto + numero pagina al centro
  - Pulsante cambio modalità lettura (destra) con icone swap/scroll
- Nuova toolbar fissa in basso, sempre visibile:
  - Barra di progresso dorata
  - Pulsante "Libreria" (icona casa) per tornare alla home
  - Frecce prev/next + slider pagine al centro
  - Pulsante "Swipe/Scroll" per cambiare modalità
- Frecce di navigazione desktop: appaiono ai lati in hover su schermi >= 768px
- Rimosso il vecchio page-slider flottante e la progress bar assoluta

### v1.2 — Fix scroll verticale su mobile

**Problema**: In modalità scroll verticale, header e toolbar scomparivano perché lo `scroll-reader` con `flex: 1` si espandeva oltre il container, spingendo gli elementi fuori viewport.

**Modifiche:**
- Aggiunto `min-height: 0` a `.swipe-reader` e `.scroll-reader` per impedire overflow del flex child
- Rimosso padding superfluo da `.scroll-container` (non serviva più con toolbar fissa)
- Aggiunte regole `.swipe-reader.hidden` e `.scroll-reader.hidden` dedicate

### v1.3 — Tap to toggle UI (immersive mode)

**Problema**: L'utente voleva poter nascondere/mostrare i controlli con un tap per un'esperienza di lettura più immersiva.

**Modifiche:**
- Aggiunta gesture tap-to-toggle su entrambe le modalità:
  - **Swipe mode**: rilevamento tap nel `touchend` (dx < 5px = nessun movimento = tap)
  - **Scroll mode**: listener `click` sullo scroll-reader (ignora tap su bottoni/input)
- Classe CSS `.chrome-hidden`: header scivola verso l'alto, toolbar verso il basso, con transizione smooth
- Reset automatico: quando si apre un nuovo fumetto, i controlli partono sempre visibili

### v1.4 — Layout full-screen per landscape

**Problema**: In landscape su mobile, il fumetto aveva bordi neri sopra e sotto perché header e toolbar occupavano spazio nel layout flex, riducendo l'area disponibile per l'immagine.

**Modifiche:**
- Header e toolbar convertiti da elementi flex a **overlay in posizione assoluta** (`position: absolute`)
  - Header: `top: 0; left: 0; right: 0`
  - Toolbar: `bottom: 0; left: 0; right: 0`
  - Sfondo semi-trasparente (`rgba(0,0,0,0.85)`) con blur
- Swipe reader e scroll reader ora occupano **tutto lo schermo** (`position: absolute; inset: 0`)
- Rimosso `position: relative` da `#reader` che sovrascriveva il `position: absolute` della classe `.view`, causando la perdita delle dimensioni del container (schermo nero)
- Risultato: l'immagine del fumetto usa il 100% dello schermo in qualsiasi orientamento; tap per nascondere i chrome = full-screen totale

---

## Note tecniche

### Caching
- Le immagini estratte dai CBR/CBZ vengono salvate in `cache/<comic-hash>/`
- Le copertine vengono generate una sola volta in `cache/covers/<comic-hash>.webp`
- La prima apertura di un fumetto è lenta (estrazione completa dell'archivio), le successive sono istantanee
- La lista fumetti è cached in memoria con TTL di 60 secondi

### Progresso lettura
- Salvato in `progress.json` nella root del progetto
- Debounce di 1 secondo per evitare scritture eccessive
- Formato: `{ "<comic-id>": { page, totalPages, timestamp } }`

### Gestione errori
- Se un archivio non può essere estratto, l'errore viene loggato e il client riceve HTTP 500
- Le copertine fallite vengono mostrate come placeholder con il numero del fumetto
- Il lazy loading delle copertine usa IntersectionObserver con margine di 200px

### Accesso da rete locale
- Il server ascolta su `0.0.0.0:3000` (tutte le interfacce)
- All'avvio stampa l'IP locale della macchina per accesso da telefono
- Non è necessaria alcuna configurazione del router per uso su rete locale (stesso WiFi)
