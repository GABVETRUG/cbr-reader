/* ========================================
   CBR Reader — App Logic v2
   ======================================== */

(function () {
  'use strict';

  // --- State ---
  const state = {
    comics: [],
    filteredComics: [],
    currentComic: null,
    currentPage: 0,
    totalPages: 0,
    readingMode: localStorage.getItem('readingMode') || 'swipe',
    searchQuery: '',
    activeFolder: '',
    folders: [],
    // v2
    userFolders: [],
    userCompartments: [],
    userColors: [],
    activeView: 'all',
    actionSheetComicId: null
  };

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);

  const dom = {
    library: $('#library'),
    reader: $('#reader'),
    comicsGrid: $('#comicsGrid'),
    loadingOverlay: $('#loadingOverlay'),
    comicCount: $('#comicCount'),
    searchToggle: $('#searchToggle'),
    searchBar: $('#searchBar'),
    searchInput: $('#searchInput'),
    filterToggle: $('#filterToggle'),
    filterBar: $('#filterBar'),
    orgBar: $('#orgBar'),
    readingSection: $('#readingSection'),
    readingRow: $('#readingRow'),
    // Reader
    backBtn: $('#backBtn'),
    readerHeader: $('#readerHeader'),
    readerComicTitle: $('#readerComicTitle'),
    readerPageInfo: $('#readerPageInfo'),
    readingModeBtn: $('#readingModeBtn'),
    modeIconSwipe: $('#modeIconSwipe'),
    modeIconScroll: $('#modeIconScroll'),
    swipeReader: $('#swipeReader'),
    swipeContainer: $('#swipeContainer'),
    scrollReader: $('#scrollReader'),
    scrollContainer: $('#scrollContainer'),
    prevPageBtn: $('#prevPageBtn'),
    nextPageBtn: $('#nextPageBtn'),
    progressFill: $('#progressFill'),
    pageRange: $('#pageRange'),
    toolbarBackBtn: $('#toolbarBackBtn'),
    toolbarPrevBtn: $('#toolbarPrevBtn'),
    toolbarNextBtn: $('#toolbarNextBtn'),
    toolbarNotesBtn: $('#toolbarNotesBtn'),
    toolbarModeBtn: $('#toolbarModeBtn'),
    toolbarModeLabel: $('#toolbarModeLabel'),
    // Action sheet
    actionSheet: $('#actionSheet'),
    actionSheetTitle: $('#actionSheetTitle'),
    actionSheetClose: $('#actionSheetClose'),
    favActionLabel: $('#favActionLabel'),
    colorPalette: $('#colorPalette'),
    folderActionLabel: $('#folderActionLabel'),
    compartmentActionLabel: $('#compartmentActionLabel'),
    // Notes panel
    notesPanel: $('#notesPanel'),
    notesList: $('#notesList'),
    noteInput: $('#noteInput'),
    saveNoteBtn: $('#saveNoteBtn'),
    closeNotesBtn: $('#closeNotesBtn'),
    // Prompt dialog
    promptDialog: $('#promptDialog'),
    promptDialogTitle: $('#promptDialogTitle'),
    promptDialogInput: $('#promptDialogInput'),
    promptDialogCancel: $('#promptDialogCancel'),
    promptDialogOk: $('#promptDialogOk')
  };

  // --- API helpers ---

  const api = {
    async getComics() { return (await fetch('/api/comics')).json(); },
    async getComicInfo(id) { return (await fetch(`/api/comics/${id}/info`)).json(); },
    async saveProgress(id, page, totalPages) {
      await fetch(`/api/progress/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page, totalPages }) });
    },
    async getFavorites() { return (await fetch('/api/favorites')).json(); },
    async setFavorite(id, data) {
      await fetch(`/api/favorites/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    },
    async removeFavorite(id) { await fetch(`/api/favorites/${id}`, { method: 'DELETE' }); },
    async getNotes(comicId) { return (await fetch(`/api/notes/${comicId}`)).json(); },
    async addNote(comicId, text) { return (await fetch(`/api/notes/${comicId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })).json(); },
    async updateNote(comicId, noteId, text) { await fetch(`/api/notes/${comicId}/${noteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); },
    async deleteNote(comicId, noteId) { await fetch(`/api/notes/${comicId}/${noteId}`, { method: 'DELETE' }); },
    async getUserFolders() { return (await fetch('/api/user-folders')).json(); },
    async createUserFolder(name, type) { await fetch('/api/user-folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) }); },
    async getUserColors() { return (await fetch('/api/user-colors')).json(); }
  };

  // --- Library ---

  async function initLibrary() {
    try {
      const [comics, foldersData, colors] = await Promise.all([
        api.getComics(),
        api.getUserFolders(),
        api.getUserColors()
      ]);

      state.comics = comics;
      state.filteredComics = [...comics];
      state.userFolders = foldersData.folders || [];
      state.userCompartments = foldersData.compartments || [];
      state.userColors = colors;

      const folderSet = new Set(comics.map(c => c.folder).filter(Boolean));
      state.folders = [...folderSet].sort();

      renderFilters();
      renderOrgBar();
      renderComics();
      updateCount();

      dom.loadingOverlay.classList.remove('active');
    } catch (err) {
      console.error('Failed to load comics:', err);
      dom.loadingOverlay.querySelector('p').textContent = 'Errore nel caricamento...';
    }
  }

  function renderFilters() {
    if (state.folders.length <= 1) return;
    const chips = [`<button class="filter-chip active" data-folder="">Tutti</button>`];
    for (const folder of state.folders) {
      chips.push(`<button class="filter-chip" data-folder="${escapeHtml(folder)}">${escapeHtml(folder)}</button>`);
    }
    dom.filterBar.innerHTML = chips.join('');
    dom.filterBar.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        dom.filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFolder = chip.dataset.folder;
        applyFilters();
      });
    });
  }

  function renderOrgBar() {
    const chips = [
      `<button class="org-chip${state.activeView === 'all' ? ' active' : ''}" data-view="all">Tutti</button>`,
      `<button class="org-chip${state.activeView === 'favorites' ? ' active' : ''}" data-view="favorites">Preferiti</button>`
    ];
    for (const f of state.userFolders) {
      chips.push(`<button class="org-chip${state.activeView === 'folder:' + f.name ? ' active' : ''}" data-view="folder:${escapeAttr(f.name)}">📁 ${escapeHtml(f.name)}</button>`);
    }
    for (const c of state.userCompartments) {
      chips.push(`<button class="org-chip${state.activeView === 'compartment:' + c.name ? ' active' : ''}" data-view="compartment:${escapeAttr(c.name)}">🏷 ${escapeHtml(c.name)}</button>`);
    }
    dom.orgBar.innerHTML = chips.join('');
    dom.orgBar.querySelectorAll('.org-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        dom.orgBar.querySelectorAll('.org-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeView = chip.dataset.view;
        applyFilters();
      });
    });
  }

  function applyFilters() {
    state.filteredComics = state.comics.filter(c => {
      // Folder filter (filesystem folders)
      const matchFolder = !state.activeFolder || c.folder === state.activeFolder;
      // Search filter
      const matchSearch = !state.searchQuery ||
        c.title.toLowerCase().includes(state.searchQuery) ||
        (c.number !== null && String(c.number).includes(state.searchQuery)) ||
        c.filename.toLowerCase().includes(state.searchQuery);
      // Organization view filter
      let matchView = true;
      if (state.activeView === 'favorites') {
        matchView = c.favorite && c.favorite.isFavorite;
      } else if (state.activeView.startsWith('folder:')) {
        const fname = state.activeView.slice(7);
        matchView = c.favorite && c.favorite.folder === fname;
      } else if (state.activeView.startsWith('compartment:')) {
        const cname = state.activeView.slice(12);
        matchView = c.favorite && c.favorite.compartment === cname;
      }
      return matchFolder && matchSearch && matchView;
    });
    renderComics();
    updateCount();
  }

  function updateCount() {
    const total = state.filteredComics.length;
    const read = state.filteredComics.filter(c => c.progress).length;
    const favs = state.comics.filter(c => c.favorite && c.favorite.isFavorite).length;
    let text = `${total} fumetti`;
    if (read > 0) text += ` \u00b7 ${read} letti`;
    if (favs > 0) text += ` \u00b7 ${favs} preferiti`;
    dom.comicCount.textContent = text;
  }

  // --- Reading Section ---

  function renderReadingSection() {
    // Comics with progress, not finished, sorted by most recent
    const reading = state.comics
      .filter(c => c.progress && c.progress.page > 0 && c.progress.page < c.progress.totalPages - 1)
      .sort((a, b) => (b.progress.timestamp || 0) - (a.progress.timestamp || 0))
      .slice(0, 15);

    if (reading.length === 0) {
      dom.readingSection.classList.add('hidden');
      return;
    }

    dom.readingSection.classList.remove('hidden');
    dom.readingRow.innerHTML = reading.map(comic => {
      const pct = Math.round((comic.progress.page / comic.progress.totalPages) * 100);
      return `
        <div class="reading-card" data-id="${comic.id}">
          <div class="comic-cover">
            <img src="/api/comics/${comic.id}/cover" alt="${escapeAttr(comic.title)}">
            <div class="comic-progress"><div class="comic-progress-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="reading-info">
            <div class="comic-title">${escapeHtml(comic.title)}</div>
            <div class="reading-progress-text">${pct}%</div>
          </div>
        </div>`;
    }).join('');

    dom.readingRow.querySelectorAll('.reading-card').forEach(card => {
      card.addEventListener('click', () => openComic(card.dataset.id));
    });
  }

  // --- Render Comics Grid ---

  const HEART_SVG = `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  function renderComics() {
    renderReadingSection();

    if (state.filteredComics.length === 0) {
      dom.comicsGrid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <p>Nessun fumetto trovato</p>
        </div>`;
      return;
    }

    const html = state.filteredComics.map((comic) => {
      const progressHtml = comic.progress
        ? `<div class="comic-progress"><div class="comic-progress-fill" style="width: ${Math.round((comic.progress.page / comic.progress.totalPages) * 100)}%"></div></div>`
        : '';
      const numberText = comic.number !== null ? `#${comic.number}` : '';
      const fav = comic.favorite;
      const isFav = fav && fav.isFavorite;
      const favBtnHtml = `<button class="card-favorite${isFav ? ' is-fav' : ''}" data-fav-id="${comic.id}">${HEART_SVG}</button>`;
      const colorHtml = fav && fav.color
        ? `<div class="card-color-dot" style="background:${fav.color}"></div>`
        : '';

      return `
        <div class="comic-card" data-id="${comic.id}">
          <div class="comic-cover">
            <div class="cover-placeholder skeleton"><span>${comic.number || '?'}</span></div>
            <img data-src="/api/comics/${comic.id}/cover" alt="${escapeAttr(comic.title)}" class="loading" loading="lazy">
            ${favBtnHtml}${colorHtml}${progressHtml}
          </div>
          <div class="comic-title">${escapeHtml(comic.title)}</div>
          ${numberText ? `<div class="comic-number">${numberText}</div>` : ''}
        </div>`;
    }).join('');

    dom.comicsGrid.innerHTML = html;
    dom.comicsGrid.scrollTop = 0;

    // Lazy load covers
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.onload = () => { img.classList.remove('loading'); img.classList.add('loaded'); const p = img.parentElement.querySelector('.cover-placeholder'); if (p) p.style.opacity = '0'; };
          img.onerror = () => { img.style.display = 'none'; };
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    dom.comicsGrid.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
  }

  // --- Grid event delegation (single listener for all cards) ---

  let gridPressTimer = null;
  let gridDidLongPress = false;
  let gridDidScroll = false;
  let gridTouchTarget = null;

  dom.comicsGrid.addEventListener('touchstart', (e) => {
    // Heart button — stop here
    const favBtn = e.target.closest('.card-favorite');
    if (favBtn) return;

    const card = e.target.closest('.comic-card');
    if (!card) return;

    gridTouchTarget = card.dataset.id;
    gridDidLongPress = false;
    gridDidScroll = false;
    gridPressTimer = setTimeout(() => {
      gridDidLongPress = true;
      openActionSheet(gridTouchTarget);
    }, 500);
  }, { passive: true });

  dom.comicsGrid.addEventListener('touchmove', () => {
    gridDidScroll = true;
    clearTimeout(gridPressTimer);
  }, { passive: true });

  dom.comicsGrid.addEventListener('touchend', (e) => {
    clearTimeout(gridPressTimer);
    // Heart button
    const favBtn = e.target.closest('.card-favorite');
    if (favBtn) {
      toggleFavoriteFromButton(favBtn);
      return;
    }
    if (gridTouchTarget && !gridDidLongPress && !gridDidScroll) {
      openComic(gridTouchTarget);
    }
    gridTouchTarget = null;
  }, { passive: true });

  // Desktop click + contextmenu
  dom.comicsGrid.addEventListener('click', (e) => {
    if (e.pointerType === 'touch') return;
    const favBtn = e.target.closest('.card-favorite');
    if (favBtn) { toggleFavoriteFromButton(favBtn); return; }
    const card = e.target.closest('.comic-card');
    if (card) openComic(card.dataset.id);
  });

  dom.comicsGrid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.comic-card');
    if (card) { e.preventDefault(); openActionSheet(card.dataset.id); }
  });

  async function toggleFavoriteFromButton(btn) {
    const comicId = btn.dataset.favId;
    const comic = state.comics.find(c => c.id === comicId);
    if (!comic) return;
    const isFav = comic.favorite && comic.favorite.isFavorite;
    if (isFav) {
      await api.removeFavorite(comicId);
      comic.favorite = null;
    } else {
      await setFavoriteField(comicId, { isFavorite: true });
    }
    btn.classList.toggle('is-fav', !isFav);
    updateCount();
  }

  // --- Action Sheet ---

  function openActionSheet(comicId) {
    state.actionSheetComicId = comicId;
    const comic = state.comics.find(c => c.id === comicId);
    if (!comic) return;

    const fav = comic.favorite;
    dom.actionSheetTitle.textContent = comic.title;
    dom.favActionLabel.textContent = fav && fav.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
    const favItem = dom.actionSheet.querySelector('[data-action="toggleFavorite"]');
    favItem.classList.toggle('is-active', !!(fav && fav.isFavorite));

    // Current folder/compartment labels
    dom.folderActionLabel.textContent = fav && fav.folder ? `Cartella: ${fav.folder}` : 'Cartella';
    dom.compartmentActionLabel.textContent = fav && fav.compartment ? `Categoria: ${fav.compartment}` : 'Categoria';

    // Render color palette
    renderColorPalette(fav ? fav.color : null);

    dom.actionSheet.classList.remove('hidden');
  }

  function closeActionSheet() {
    dom.actionSheet.classList.add('hidden');
    state.actionSheetComicId = null;
  }

  function renderColorPalette(activeColor) {
    const none = `<div class="color-dot color-dot-none${!activeColor ? ' active' : ''}" data-color=""></div>`;
    const dots = state.userColors.map(c =>
      `<div class="color-dot${c.hex === activeColor ? ' active' : ''}" data-color="${c.hex}" style="background:${c.hex}" title="${escapeAttr(c.label)}"></div>`
    ).join('');
    dom.colorPalette.innerHTML = none + dots;

    dom.colorPalette.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', async (e) => {
        e.stopPropagation();
        const color = dot.dataset.color || null;
        await setFavoriteField(state.actionSheetComicId, { color });
        renderColorPalette(color);
      });
    });
  }

  async function setFavoriteField(comicId, fields) {
    const comic = state.comics.find(c => c.id === comicId);
    if (!comic) return;
    const current = comic.favorite || { isFavorite: true, color: null, folder: null, compartment: null };
    const updated = { ...current, ...fields };
    if (!updated.isFavorite && !updated.color && !updated.folder && !updated.compartment) {
      await api.removeFavorite(comicId);
      comic.favorite = null;
    } else {
      if (fields.color || fields.folder || fields.compartment) updated.isFavorite = true;
      await api.setFavorite(comicId, updated);
      comic.favorite = updated;
    }
    applyFilters();
    renderOrgBar();
  }

  // Action sheet event handlers
  dom.actionSheetClose.addEventListener('click', closeActionSheet);
  dom.actionSheet.querySelector('.action-sheet-backdrop').addEventListener('click', closeActionSheet);

  dom.actionSheet.querySelector('[data-action="toggleFavorite"]').addEventListener('click', async () => {
    const comic = state.comics.find(c => c.id === state.actionSheetComicId);
    if (!comic) return;
    const isFav = comic.favorite && comic.favorite.isFavorite;
    if (isFav) {
      await api.removeFavorite(comic.id);
      comic.favorite = null;
      showToast('Rimosso dai preferiti');
    } else {
      await setFavoriteField(comic.id, { isFavorite: true });
      showToast('Aggiunto ai preferiti');
    }
    closeActionSheet();
  });

  dom.actionSheet.querySelector('[data-action="assignFolder"]').addEventListener('click', async () => {
    const names = state.userFolders.map(f => f.name);
    const result = await showPromptDialog('Cartella', 'Nome della cartella', names);
    if (result === null) return;
    if (result && !names.includes(result)) {
      await api.createUserFolder(result, 'folder');
      state.userFolders.push({ name: result });
    }
    await setFavoriteField(state.actionSheetComicId, { folder: result || null });
    closeActionSheet();
    showToast(result ? `Cartella: ${result}` : 'Cartella rimossa');
  });

  dom.actionSheet.querySelector('[data-action="assignCompartment"]').addEventListener('click', async () => {
    const names = state.userCompartments.map(c => c.name);
    const result = await showPromptDialog('Categoria', 'Nome della categoria', names);
    if (result === null) return;
    if (result && !names.includes(result)) {
      await api.createUserFolder(result, 'compartment');
      state.userCompartments.push({ name: result });
    }
    await setFavoriteField(state.actionSheetComicId, { compartment: result || null });
    closeActionSheet();
    showToast(result ? `Categoria: ${result}` : 'Categoria rimossa');
  });

  dom.actionSheet.querySelector('[data-action="openNotes"]').addEventListener('click', () => {
    const comicId = state.actionSheetComicId;
    closeActionSheet();
    openNotesPanel(comicId);
  });

  // --- Prompt Dialog ---

  function showPromptDialog(title, placeholder, suggestions) {
    return new Promise((resolve) => {
      dom.promptDialogTitle.textContent = title;
      dom.promptDialogInput.placeholder = placeholder || '';
      dom.promptDialogInput.value = '';
      dom.promptDialog.classList.remove('hidden');
      dom.promptDialogInput.focus();

      // Show suggestion chips if any
      const existingChips = dom.promptDialog.querySelector('.prompt-suggestions');
      if (existingChips) existingChips.remove();

      if (suggestions && suggestions.length > 0) {
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'prompt-suggestions';
        chipsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
        for (const s of suggestions) {
          const chip = document.createElement('button');
          chip.className = 'org-chip';
          chip.textContent = s;
          chip.style.cssText = 'font-size:12px;padding:6px 12px;';
          chip.addEventListener('click', () => {
            dom.promptDialogInput.value = s;
          });
          chipsDiv.appendChild(chip);
        }
        // Add "none" option
        const noneChip = document.createElement('button');
        noneChip.className = 'org-chip';
        noneChip.textContent = 'Nessuna';
        noneChip.style.cssText = 'font-size:12px;padding:6px 12px;color:var(--text-muted);';
        noneChip.addEventListener('click', () => { dom.promptDialogInput.value = ''; });
        chipsDiv.appendChild(noneChip);
        dom.promptDialogInput.parentElement.insertBefore(chipsDiv, dom.promptDialogInput);
      }

      function cleanup() {
        dom.promptDialog.classList.add('hidden');
        dom.promptDialogOk.removeEventListener('click', onOk);
        dom.promptDialogCancel.removeEventListener('click', onCancel);
        dom.promptDialog.querySelector('.prompt-dialog-backdrop').removeEventListener('click', onCancel);
      }
      function onOk() { cleanup(); resolve(dom.promptDialogInput.value.trim()); }
      function onCancel() { cleanup(); resolve(null); }

      dom.promptDialogOk.addEventListener('click', onOk);
      dom.promptDialogCancel.addEventListener('click', onCancel);
      dom.promptDialog.querySelector('.prompt-dialog-backdrop').addEventListener('click', onCancel);
    });
  }

  // --- Notes Panel ---

  let notesPanelComicId = null;

  async function openNotesPanel(comicId) {
    notesPanelComicId = comicId;
    dom.noteInput.value = '';
    dom.notesPanel.classList.remove('hidden');
    await renderNotes(comicId);
  }

  function closeNotesPanel() {
    dom.notesPanel.classList.add('hidden');
    notesPanelComicId = null;
  }

  async function renderNotes(comicId) {
    const notes = await api.getNotes(comicId);
    if (notes.length === 0) {
      dom.notesList.innerHTML = '<div class="notes-empty">Nessuna nota</div>';
      return;
    }
    dom.notesList.innerHTML = notes.map(n => `
      <div class="note-card" data-note-id="${n._id}">
        <div class="note-card-text">${escapeHtml(n.text)}</div>
        <div class="note-card-footer">
          <span class="note-card-date">${formatDate(n.updatedAt || n.createdAt)}</span>
          <div class="note-card-actions">
            <button class="edit-note">Modifica</button>
            <button class="delete-note">Elimina</button>
          </div>
        </div>
      </div>
    `).join('');

    // Wire up edit/delete
    dom.notesList.querySelectorAll('.note-card').forEach(card => {
      const noteId = card.dataset.noteId;

      card.querySelector('.edit-note').addEventListener('click', async () => {
        const textEl = card.querySelector('.note-card-text');
        const currentText = textEl.textContent;
        const result = await showPromptDialog('Modifica nota', 'Testo della nota', []);
        if (result === null) return;
        dom.promptDialogInput.value = currentText; // pre-fill handled differently — let's use inline
        await api.updateNote(comicId, noteId, result);
        await renderNotes(comicId);
        showToast('Nota aggiornata');
      });

      card.querySelector('.delete-note').addEventListener('click', async () => {
        await api.deleteNote(comicId, noteId);
        await renderNotes(comicId);
        showToast('Nota eliminata');
      });
    });
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  dom.closeNotesBtn.addEventListener('click', closeNotesPanel);
  dom.notesPanel.querySelector('.notes-panel-backdrop').addEventListener('click', closeNotesPanel);

  dom.saveNoteBtn.addEventListener('click', async () => {
    const text = dom.noteInput.value.trim();
    if (!text || !notesPanelComicId) return;
    await api.addNote(notesPanelComicId, text);
    dom.noteInput.value = '';
    await renderNotes(notesPanelComicId);
    showToast('Nota salvata');
  });

  // --- Reader ---

  async function openComic(comicId) {
    const comic = state.comics.find(c => c.id === comicId);
    if (!comic) return;

    state.currentComic = comic;
    showView('reader');

    dom.readerComicTitle.textContent = comic.title;
    dom.readerPageInfo.textContent = 'Caricamento...';

    try {
      const info = await api.getComicInfo(comicId);
      state.totalPages = info.pageCount;
      state.currentPage = comic.progress ? Math.min(comic.progress.page, state.totalPages - 1) : 0;

      dom.pageRange.max = state.totalPages - 1;
      dom.pageRange.value = state.currentPage;

      uiVisible = true;
      dom.readerHeader.classList.remove('chrome-hidden');
      document.querySelector('.reader-toolbar').classList.remove('chrome-hidden');

      updateModeIcons();

      if (state.readingMode === 'swipe') {
        initSwipeReader();
      } else {
        initScrollReader();
      }

      updateReaderUI();
    } catch (err) {
      console.error('Failed to open comic:', err);
      showToast('Errore nel caricamento del fumetto');
      showView('library');
    }
  }

  function closeReader() {
    showView('library');
    state.currentComic = null;
    dom.swipeContainer.innerHTML = '';
    dom.scrollContainer.innerHTML = '';
    refreshLibrary();
  }

  async function refreshLibrary() {
    const [comics, foldersData] = await Promise.all([api.getComics(), api.getUserFolders()]);
    state.comics = comics;
    state.userFolders = foldersData.folders || [];
    state.userCompartments = foldersData.compartments || [];
    renderOrgBar();
    applyFilters();
  }

  // --- Mode Icons ---

  function updateModeIcons() {
    if (state.readingMode === 'swipe') {
      dom.modeIconSwipe.classList.remove('svg-hidden');
      dom.modeIconScroll.classList.add('svg-hidden');
      dom.toolbarModeLabel.textContent = 'Swipe';
    } else {
      dom.modeIconSwipe.classList.add('svg-hidden');
      dom.modeIconScroll.classList.remove('svg-hidden');
      dom.toolbarModeLabel.textContent = 'Scroll';
    }
  }

  // --- Swipe Reader ---

  function initSwipeReader() {
    dom.swipeReader.classList.remove('hidden');
    dom.scrollReader.classList.add('hidden');

    const pages = [];
    for (let i = 0; i < state.totalPages; i++) {
      pages.push(`<div class="swipe-page" data-page="${i}"><img data-src="/api/comics/${state.currentComic.id}/pages/${i}" alt="Pagina ${i + 1}"></div>`);
    }
    dom.swipeContainer.innerHTML = pages.join('');
    updateSwipePosition(false);
    loadVisiblePages();
    setupSwipeGestures();
  }

  function updateSwipePosition(animate = true) {
    if (!animate) dom.swipeContainer.classList.add('dragging');
    else dom.swipeContainer.classList.remove('dragging');
    dom.swipeContainer.style.transform = `translateX(${-state.currentPage * 100}%)`;
    if (!animate) requestAnimationFrame(() => dom.swipeContainer.classList.remove('dragging'));
    loadVisiblePages();
  }

  function loadVisiblePages() {
    [state.currentPage - 1, state.currentPage, state.currentPage + 1].forEach(i => {
      if (i < 0 || i >= state.totalPages) return;
      const page = dom.swipeContainer.querySelector(`[data-page="${i}"]`);
      if (!page) return;
      const img = page.querySelector('img');
      if (img && img.dataset.src && !img.src) img.src = img.dataset.src;
    });
  }

  function setupSwipeGestures() {
    let startX = 0, currentX = 0, startY = 0, isDragging = false, isHorizontal = null;
    const container = dom.swipeReader;

    container.addEventListener('touchstart', (e) => {
      startX = currentX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      isHorizontal = null;
      dom.swipeContainer.classList.add('dragging');
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const dx = currentX - startX, dy = e.touches[0].clientY - startY;
      if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!isHorizontal) return;
      dom.swipeContainer.style.transform = `translateX(${-state.currentPage * container.offsetWidth + dx}px)`;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      dom.swipeContainer.classList.remove('dragging');
      const dx = currentX - startX;
      const threshold = container.offsetWidth * 0.15;
      if (isHorizontal && Math.abs(dx) > threshold) {
        if (dx < 0 && state.currentPage < state.totalPages - 1) goToPage(state.currentPage + 1);
        else if (dx > 0 && state.currentPage > 0) goToPage(state.currentPage - 1);
        else updateSwipePosition(true);
      } else {
        updateSwipePosition(true);
        if (Math.abs(dx) < 5) toggleUI();
      }
      startX = currentX = 0;
    }, { passive: true });
  }

  // --- Scroll Reader ---

  function initScrollReader() {
    dom.scrollReader.classList.remove('hidden');
    dom.swipeReader.classList.add('hidden');

    const pages = [];
    for (let i = 0; i < state.totalPages; i++) {
      pages.push(`<div class="scroll-page" data-page="${i}"><img data-src="/api/comics/${state.currentComic.id}/pages/${i}" alt="Pagina ${i + 1}" loading="lazy"></div>`);
    }
    dom.scrollContainer.innerHTML = pages.join('');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '400px' });
    dom.scrollContainer.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));

    dom.scrollReader.addEventListener('click', (e) => {
      if (e.target.closest('button, input, a')) return;
      toggleUI();
    });

    dom.scrollReader.addEventListener('scroll', onScrollReaderScroll, { passive: true });

    if (state.currentPage > 0) {
      setTimeout(() => {
        const target = dom.scrollContainer.querySelector(`[data-page="${state.currentPage}"]`);
        if (target) target.scrollIntoView({ behavior: 'instant' });
      }, 100);
    }
  }

  function onScrollReaderScroll() {
    const pages = dom.scrollContainer.querySelectorAll('.scroll-page');
    const midPoint = dom.scrollReader.scrollTop + dom.scrollReader.clientHeight / 2;
    let currentPage = 0;
    for (const page of pages) {
      if (page.offsetTop + page.offsetHeight / 2 < midPoint) currentPage = parseInt(page.dataset.page, 10);
    }
    if (currentPage !== state.currentPage) {
      state.currentPage = currentPage;
      updateReaderUI();
      debouncedSaveProgress();
    }
  }

  // --- Navigation ---

  function goToPage(page) {
    if (page < 0 || page >= state.totalPages) return;
    state.currentPage = page;
    if (state.readingMode === 'swipe') updateSwipePosition(true);
    else {
      const target = dom.scrollContainer.querySelector(`[data-page="${page}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
    updateReaderUI();
    debouncedSaveProgress();
  }

  function updateReaderUI() {
    dom.readerPageInfo.textContent = `${state.currentPage + 1} / ${state.totalPages}`;
    dom.pageRange.value = state.currentPage;
    dom.progressFill.style.width = `${((state.currentPage + 1) / state.totalPages) * 100}%`;
  }

  // --- UI Toggle ---

  let uiVisible = true;
  function toggleUI() {
    uiVisible = !uiVisible;
    dom.readerHeader.classList.toggle('chrome-hidden', !uiVisible);
    document.querySelector('.reader-toolbar').classList.toggle('chrome-hidden', !uiVisible);
  }

  // --- Reading Mode Toggle ---

  function toggleReadingMode() {
    state.readingMode = state.readingMode === 'swipe' ? 'scroll' : 'swipe';
    localStorage.setItem('readingMode', state.readingMode);
    updateModeIcons();
    if (state.readingMode === 'swipe') { initSwipeReader(); showModeIndicator('Scorrimento orizzontale'); }
    else { initScrollReader(); showModeIndicator('Scorrimento verticale'); }
  }

  function showModeIndicator(text) {
    let indicator = document.querySelector('.mode-indicator');
    if (!indicator) { indicator = document.createElement('div'); indicator.className = 'mode-indicator'; document.body.appendChild(indicator); }
    indicator.textContent = text;
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 1500);
  }

  // --- Progress ---

  let saveTimeout = null;
  function debouncedSaveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (state.currentComic) api.saveProgress(state.currentComic.id, state.currentPage, state.totalPages);
    }, 1000);
  }

  // --- Toast ---

  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  // --- View Management ---

  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(name).classList.add('active');
    document.body.style.overflow = name === 'reader' ? 'hidden' : '';
  }

  // --- Utilities ---

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escapeAttr(str) { return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // --- Event Listeners ---

  // Search
  dom.searchToggle.addEventListener('click', () => {
    dom.searchBar.classList.toggle('hidden');
    if (!dom.searchBar.classList.contains('hidden')) dom.searchInput.focus();
  });
  dom.searchInput.addEventListener('input', (e) => { state.searchQuery = e.target.value.toLowerCase().trim(); applyFilters(); });

  // Filter toggle — show both bars
  dom.filterToggle.addEventListener('click', () => {
    dom.filterBar.classList.toggle('hidden');
    dom.orgBar.classList.toggle('hidden');
  });

  // Reader buttons
  dom.backBtn.addEventListener('click', closeReader);
  dom.readingModeBtn.addEventListener('click', toggleReadingMode);
  dom.toolbarBackBtn.addEventListener('click', closeReader);
  dom.toolbarPrevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  dom.toolbarNextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
  dom.toolbarModeBtn.addEventListener('click', toggleReadingMode);
  dom.prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  dom.nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
  dom.pageRange.addEventListener('input', (e) => goToPage(parseInt(e.target.value, 10)));

  // Notes button in reader toolbar
  dom.toolbarNotesBtn.addEventListener('click', () => {
    if (state.currentComic) openNotesPanel(state.currentComic.id);
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!dom.reader.classList.contains('active')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goToPage(state.currentPage - 1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goToPage(state.currentPage + 1); }
    else if (e.key === 'Escape') closeReader();
  });

  // --- Reading section collapse on scroll ---
  let lastScrollTop = 0;
  dom.comicsGrid.addEventListener('scroll', () => {
    const st = dom.comicsGrid.scrollTop;
    if (st > 60) {
      dom.readingSection.classList.add('collapsed');
    } else if (st < 10) {
      dom.readingSection.classList.remove('collapsed');
    }
    lastScrollTop = st;
  }, { passive: true });

  // --- Init ---
  initLibrary();
})();
