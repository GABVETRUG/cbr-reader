/* ========================================
   CBR Reader — App Logic
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
    folders: []
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
    // Reader top bar
    backBtn: $('#backBtn'),
    readerHeader: $('#readerHeader'),
    readerComicTitle: $('#readerComicTitle'),
    readerPageInfo: $('#readerPageInfo'),
    readingModeBtn: $('#readingModeBtn'),
    modeIconSwipe: $('#modeIconSwipe'),
    modeIconScroll: $('#modeIconScroll'),
    // Reader content
    swipeReader: $('#swipeReader'),
    swipeContainer: $('#swipeContainer'),
    scrollReader: $('#scrollReader'),
    scrollContainer: $('#scrollContainer'),
    // Desktop nav arrows
    prevPageBtn: $('#prevPageBtn'),
    nextPageBtn: $('#nextPageBtn'),
    // Bottom toolbar
    progressFill: $('#progressFill'),
    pageRange: $('#pageRange'),
    toolbarBackBtn: $('#toolbarBackBtn'),
    toolbarPrevBtn: $('#toolbarPrevBtn'),
    toolbarNextBtn: $('#toolbarNextBtn'),
    toolbarModeBtn: $('#toolbarModeBtn'),
    toolbarModeLabel: $('#toolbarModeLabel'),
    toolbarModeIconH: $('#toolbarModeIconH')
  };

  // --- API ---
  async function fetchComics() {
    const res = await fetch('/api/comics');
    return res.json();
  }

  async function fetchComicInfo(id) {
    const res = await fetch(`/api/comics/${id}/info`);
    return res.json();
  }

  async function saveProgress(id, page, totalPages) {
    await fetch(`/api/progress/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, totalPages })
    });
  }

  // --- Library ---

  async function initLibrary() {
    try {
      state.comics = await fetchComics();
      state.filteredComics = [...state.comics];

      const folderSet = new Set(state.comics.map(c => c.folder).filter(Boolean));
      state.folders = [...folderSet].sort();

      renderFilters();
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

  function applyFilters() {
    state.filteredComics = state.comics.filter(c => {
      const matchFolder = !state.activeFolder || c.folder === state.activeFolder;
      const matchSearch = !state.searchQuery ||
        c.title.toLowerCase().includes(state.searchQuery) ||
        (c.number !== null && String(c.number).includes(state.searchQuery)) ||
        c.filename.toLowerCase().includes(state.searchQuery);
      return matchFolder && matchSearch;
    });
    renderComics();
    updateCount();
  }

  function updateCount() {
    const total = state.filteredComics.length;
    const read = state.filteredComics.filter(c => c.progress).length;
    dom.comicCount.textContent = `${total} fumetti${read > 0 ? ` \u00b7 ${read} letti` : ''}`;
  }

  function renderComics() {
    if (state.filteredComics.length === 0) {
      dom.comicsGrid.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <p>Nessun fumetto trovato</p>
        </div>`;
      return;
    }

    const html = state.filteredComics.map((comic, i) => {
      const progressHtml = comic.progress
        ? `<div class="comic-progress"><div class="comic-progress-fill" style="width: ${Math.round((comic.progress.page / comic.progress.totalPages) * 100)}%"></div></div>`
        : '';

      const numberText = comic.number !== null ? `#${comic.number}` : '';

      return `
        <div class="comic-card" data-id="${comic.id}" style="animation-delay: ${Math.min(i * 30, 600)}ms">
          <div class="comic-cover">
            <div class="cover-placeholder skeleton"><span>${comic.number || '?'}</span></div>
            <img
              data-src="/api/comics/${comic.id}/cover"
              alt="${escapeAttr(comic.title)}"
              class="loading"
              loading="lazy"
            >
            ${progressHtml}
          </div>
          <div class="comic-title">${escapeHtml(comic.title)}</div>
          ${numberText ? `<div class="comic-number">${numberText}</div>` : ''}
        </div>`;
    }).join('');

    dom.comicsGrid.innerHTML = html;
    dom.comicsGrid.scrollTop = 0;

    // Lazy load covers with IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.onload = () => {
            img.classList.remove('loading');
            img.classList.add('loaded');
            const placeholder = img.parentElement.querySelector('.cover-placeholder');
            if (placeholder) placeholder.style.opacity = '0';
          };
          img.onerror = () => {
            img.style.display = 'none';
          };
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    dom.comicsGrid.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));

    // Click handlers
    dom.comicsGrid.querySelectorAll('.comic-card').forEach(card => {
      card.addEventListener('click', () => openComic(card.dataset.id));
    });
  }

  // --- Reader ---

  async function openComic(comicId) {
    const comic = state.comics.find(c => c.id === comicId);
    if (!comic) return;

    state.currentComic = comic;
    showView('reader');

    dom.readerComicTitle.textContent = comic.title;
    dom.readerPageInfo.textContent = 'Caricamento...';

    try {
      const info = await fetchComicInfo(comicId);
      state.totalPages = info.pageCount;
      state.currentPage = comic.progress ? Math.min(comic.progress.page, state.totalPages - 1) : 0;

      dom.pageRange.max = state.totalPages - 1;
      dom.pageRange.value = state.currentPage;

      // Reset UI visibility
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

    // Refresh comics list to update progress indicators
    fetchComics().then(comics => {
      state.comics = comics;
      applyFilters();
    });
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
      pages.push(`
        <div class="swipe-page" data-page="${i}">
          <img data-src="/api/comics/${state.currentComic.id}/pages/${i}" alt="Pagina ${i + 1}">
        </div>`);
    }
    dom.swipeContainer.innerHTML = pages.join('');

    updateSwipePosition(false);
    loadVisiblePages();
    setupSwipeGestures();
  }

  function updateSwipePosition(animate = true) {
    if (!animate) {
      dom.swipeContainer.classList.add('dragging');
    } else {
      dom.swipeContainer.classList.remove('dragging');
    }
    const offset = -state.currentPage * 100;
    dom.swipeContainer.style.transform = `translateX(${offset}%)`;

    if (!animate) {
      requestAnimationFrame(() => {
        dom.swipeContainer.classList.remove('dragging');
      });
    }

    loadVisiblePages();
  }

  function loadVisiblePages() {
    const range = [state.currentPage - 1, state.currentPage, state.currentPage + 1];
    range.forEach(i => {
      if (i < 0 || i >= state.totalPages) return;
      const page = dom.swipeContainer.querySelector(`[data-page="${i}"]`);
      if (!page) return;
      const img = page.querySelector('img');
      if (img && img.dataset.src && !img.src) {
        img.src = img.dataset.src;
      }
    });
  }

  function setupSwipeGestures() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let isHorizontal = null;

    const container = dom.swipeReader;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      isDragging = true;
      isHorizontal = null;
      dom.swipeContainer.classList.add('dragging');
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;

      if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }

      if (!isHorizontal) return;

      const pageWidth = container.offsetWidth;
      const baseOffset = -state.currentPage * pageWidth;
      dom.swipeContainer.style.transform = `translateX(${baseOffset + dx}px)`;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      dom.swipeContainer.classList.remove('dragging');

      const dx = currentX - startX;
      const threshold = container.offsetWidth * 0.15;

      if (isHorizontal && Math.abs(dx) > threshold) {
        if (dx < 0 && state.currentPage < state.totalPages - 1) {
          goToPage(state.currentPage + 1);
        } else if (dx > 0 && state.currentPage > 0) {
          goToPage(state.currentPage - 1);
        } else {
          updateSwipePosition(true);
        }
      } else {
        updateSwipePosition(true);
        // No movement = tap → toggle UI
        if (Math.abs(dx) < 5) {
          toggleUI();
        }
      }

      startX = 0;
      currentX = 0;
    }, { passive: true });
  }

  // --- Scroll Reader ---

  function initScrollReader() {
    dom.scrollReader.classList.remove('hidden');
    dom.swipeReader.classList.add('hidden');

    const pages = [];
    for (let i = 0; i < state.totalPages; i++) {
      pages.push(`
        <div class="scroll-page" data-page="${i}">
          <img data-src="/api/comics/${state.currentComic.id}/pages/${i}" alt="Pagina ${i + 1}" loading="lazy">
        </div>`);
    }
    dom.scrollContainer.innerHTML = pages.join('');

    // Lazy load with IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '400px' });

    dom.scrollContainer.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));

    // Tap to toggle UI in scroll mode
    dom.scrollReader.addEventListener('click', (e) => {
      // Ignore if user tapped a button or interactive element
      if (e.target.closest('button, input, a')) return;
      toggleUI();
    });

    // Track scroll position for progress
    dom.scrollReader.addEventListener('scroll', onScrollReaderScroll, { passive: true });

    // Scroll to last position
    if (state.currentPage > 0) {
      setTimeout(() => {
        const target = dom.scrollContainer.querySelector(`[data-page="${state.currentPage}"]`);
        if (target) target.scrollIntoView({ behavior: 'instant' });
      }, 100);
    }
  }

  function onScrollReaderScroll() {
    const pages = dom.scrollContainer.querySelectorAll('.scroll-page');
    const scrollTop = dom.scrollReader.scrollTop;
    const viewHeight = dom.scrollReader.clientHeight;
    const midPoint = scrollTop + viewHeight / 2;

    let currentPage = 0;
    for (const page of pages) {
      if (page.offsetTop + page.offsetHeight / 2 < midPoint) {
        currentPage = parseInt(page.dataset.page, 10);
      }
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

    if (state.readingMode === 'swipe') {
      updateSwipePosition(true);
    } else {
      const target = dom.scrollContainer.querySelector(`[data-page="${page}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }

    updateReaderUI();
    debouncedSaveProgress();
  }

  function updateReaderUI() {
    dom.readerPageInfo.textContent = `${state.currentPage + 1} / ${state.totalPages}`;
    dom.pageRange.value = state.currentPage;

    const progress = ((state.currentPage + 1) / state.totalPages) * 100;
    dom.progressFill.style.width = `${progress}%`;
  }

  // --- UI Toggle (tap to hide/show) ---

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

    if (state.readingMode === 'swipe') {
      initSwipeReader();
      showModeIndicator('Scorrimento orizzontale');
    } else {
      initScrollReader();
      showModeIndicator('Scorrimento verticale');
    }
  }

  function showModeIndicator(text) {
    let indicator = document.querySelector('.mode-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'mode-indicator';
      document.body.appendChild(indicator);
    }
    indicator.textContent = text;
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 1500);
  }

  // --- Progress ---

  let saveTimeout = null;
  function debouncedSaveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (state.currentComic) {
        saveProgress(state.currentComic.id, state.currentPage, state.totalPages);
      }
    }, 1000);
  }

  // --- Toast ---

  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  // --- View Management ---

  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(name).classList.add('active');

    if (name === 'reader') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  // --- Utilities ---

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- Event Listeners ---

  // Search
  dom.searchToggle.addEventListener('click', () => {
    dom.searchBar.classList.toggle('hidden');
    if (!dom.searchBar.classList.contains('hidden')) {
      dom.searchInput.focus();
    }
  });

  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  // Filter
  dom.filterToggle.addEventListener('click', () => {
    dom.filterBar.classList.toggle('hidden');
  });

  // Reader — Top bar buttons
  dom.backBtn.addEventListener('click', closeReader);
  dom.readingModeBtn.addEventListener('click', toggleReadingMode);

  // Reader — Bottom toolbar buttons
  dom.toolbarBackBtn.addEventListener('click', closeReader);
  dom.toolbarPrevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  dom.toolbarNextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
  dom.toolbarModeBtn.addEventListener('click', toggleReadingMode);

  // Reader — Desktop nav arrows
  dom.prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  dom.nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

  // Page slider
  dom.pageRange.addEventListener('input', (e) => {
    const page = parseInt(e.target.value, 10);
    goToPage(page);
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!dom.reader.classList.contains('active')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPage(state.currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      goToPage(state.currentPage + 1);
    } else if (e.key === 'Escape') {
      closeReader();
    }
  });

  // --- Init ---
  initLibrary();
})();
