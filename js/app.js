/**
 * 기본사회와 지방정부 인터랙티브 위키트리 애플리케이션 (app.js)
 * 
 * - 트리 계층 렌더링 및 아코디언 토글
 * - 해시(#) 라우팅 기반 위키 본문 동적 렌더링
 * - 우측 온페이지 목차(TOC) 자동 생성 및 스크롤 감지
 * - 실시간 통합 키워드 검색 및 하이라이트
 * - 이미지 라이트박스(모달) 팝업
 * - 다크/라이트 테마 전환 및 글자 크기 조절
 */

document.addEventListener("DOMContentLoaded", () => {
  // 현재 애플리케이션 상태
  const state = {
    currentDocId: null,
    theme: localStorage.getItem("wiki_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    fontSizeLevel: 0, // -1: 작게, 0: 기본, 1: 크게, 2: 아주 크게
    fontSizes: ["0.9rem", "1rem", "1.1rem", "1.2rem"]
  };

  // DOM 요소 캐싱
  const elements = {
    treeContainer: document.getElementById("treeContainer"),
    mainContent: document.getElementById("mainContent"),
    tocList: document.getElementById("tocList"),
    searchInput: document.getElementById("searchInput"),
    searchClearBtn: document.getElementById("searchClearBtn"),
    searchResultsOverlay: document.getElementById("searchResultsOverlay"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    sidebar: document.getElementById("sidebar"),
    sidebarToggleBtn: document.getElementById("sidebarToggleBtn"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
    expandAllBtn: document.getElementById("expandAllBtn"),
    collapseAllBtn: document.getElementById("collapseAllBtn"),
    lightboxModal: document.getElementById("lightboxModal"),
    lightboxImg: document.getElementById("lightboxImg"),
    lightboxCaption: document.getElementById("lightboxCaption"),
    lightboxCloseBtn: document.getElementById("lightboxCloseBtn")
  };

  // 1. 테마 초기화
  function initTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeButton();
  }

  function updateThemeButton() {
    if (!elements.themeToggleBtn) return;
    const isDark = state.theme === "dark";
    elements.themeToggleBtn.innerHTML = isDark ? "☀️ <span>라이트모드</span>" : "🌙 <span>다크모드</span>";
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("wiki_theme", state.theme);
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeButton();
  }

  // 2. 좌측 트리 네비게이션 렌더링
  function renderTree() {
    if (!elements.treeContainer) return;
    elements.treeContainer.innerHTML = "";

    WIKI_CATEGORIES.forEach((cat) => {
      // 해당 카테고리에 속한 문서 목록
      const catDocs = WIKI_DOCUMENTS.filter((doc) => doc.categoryId === cat.id);

      const categoryEl = document.createElement("div");
      categoryEl.className = "tree-category open";
      categoryEl.dataset.catId = cat.id;

      // 카테고리 헤더
      const headerEl = document.createElement("div");
      headerEl.className = "category-header";
      headerEl.innerHTML = `
        <div class="category-title-wrap">
          <span class="category-icon">${cat.icon}</span>
          <span class="category-title">${cat.title}</span>
        </div>
        <span class="category-arrow">▶</span>
      `;

      // 헤더 클릭 시 아코디언 토글
      headerEl.addEventListener("click", () => {
        categoryEl.classList.toggle("open");
      });

      // 문서 목록 컨테이너
      const childrenEl = document.createElement("div");
      childrenEl.className = "category-children";

      catDocs.forEach((doc) => {
        const nodeEl = document.createElement("div");
        nodeEl.className = `tree-node ${doc.id === state.currentDocId ? "active" : ""}`;
        nodeEl.dataset.docId = doc.id;
        nodeEl.innerHTML = `
          <span class="node-icon">📄</span>
          <span class="node-title">${doc.title}</span>
        `;

        nodeEl.addEventListener("click", () => {
          navigateToDoc(doc.id);
          // 모바일일 경우 사이드바 닫기
          closeMobileSidebar();
        });

        childrenEl.appendChild(nodeEl);
      });

      categoryEl.appendChild(headerEl);
      categoryEl.appendChild(childrenEl);
      elements.treeContainer.appendChild(categoryEl);
    });
  }

  // 3. 문서 이동 및 라우팅
  function navigateToDoc(docId) {
    if (!docId) return;
    window.location.hash = docId;
  }

  function handleRoute() {
    const hash = window.location.hash.replace("#", "");
    const targetDoc = WIKI_DOCUMENTS.find((d) => d.id === hash) || WIKI_DOCUMENTS[0];
    
    if (targetDoc) {
      state.currentDocId = targetDoc.id;
      renderDocument(targetDoc);
      updateTreeActiveState();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function updateTreeActiveState() {
    // 트리 노드 활성화 클래스 갱신
    document.querySelectorAll(".tree-node").forEach((node) => {
      if (node.dataset.docId === state.currentDocId) {
        node.classList.add("active");
        // 해당 카테고리가 닫혀있으면 열기
        const parentCat = node.closest(".tree-category");
        if (parentCat && !parentCat.classList.contains("open")) {
          parentCat.classList.add("open");
        }
      } else {
        node.classList.remove("active");
      }
    });
  }

  // 4. 위키 본문 렌더링
  function renderDocument(doc) {
    if (!elements.mainContent) return;

    // 카테고리 정보 조회
    const category = WIKI_CATEGORIES.find((c) => c.id === doc.categoryId);

    // 이전/다음 문서 탐색
    const currentIndex = WIKI_DOCUMENTS.findIndex((d) => d.id === doc.id);
    const prevDoc = currentIndex > 0 ? WIKI_DOCUMENTS[currentIndex - 1] : null;
    const nextDoc = currentIndex < WIKI_DOCUMENTS.length - 1 ? WIKI_DOCUMENTS[currentIndex + 1] : null;

    // 연관 문서 객체 목록 조회
    const relatedDocs = (doc.relatedIds || [])
      .map((relId) => WIKI_DOCUMENTS.find((d) => d.id === relId))
      .filter(Boolean);

    // HTML 조립
    let html = `
      <!-- 브레드크럼 -->
      <nav class="breadcrumb-nav">
        <span>홈</span>
        <span class="sep">/</span>
        <span>${category ? category.title : ""}</span>
        <span class="sep">/</span>
        <span class="current">${doc.title}</span>
      </nav>

      <!-- 문서 헤더 -->
      <header class="doc-header-card ${doc.heroImage ? "has-hero-image" : ""}">
        <div class="doc-header-grid">
          <div class="doc-header-text-pane">
            <div class="doc-tag-list">
              ${(doc.tags || []).map((t) => `<span class="tag-badge">#${t}</span>`).join("")}
            </div>
            <h2 class="doc-main-title">${doc.title}</h2>
            <div class="doc-subtitle">${doc.subtitle || ""}</div>
            
            <div class="doc-meta-bar">
              <div class="doc-meta-left">
                <span>📚 분류: <strong>${category ? category.title : ""}</strong></span>
                <span>⏱️ 읽는 시간: 약 3분</span>
              </div>
              <div class="doc-meta-right">
                <button class="action-icon-btn" id="fontDecreaseBtn" title="글자 작게">A-</button>
                <button class="action-icon-btn" id="fontIncreaseBtn" title="글자 크게">A+</button>
                <button class="action-icon-btn" id="copyLinkBtn" title="문서 링크 복사">🔗 링크 복사</button>
                <button class="action-icon-btn" id="printDocBtn" title="인쇄">🖨️ 인쇄</button>
              </div>
            </div>
          </div>

          ${
            doc.heroImage
              ? `
          <div class="doc-header-hero-pane">
            <div class="header-hero-card" data-img-src="${doc.heroImage.src}" data-img-caption="${doc.heroImage.caption}">
              <img src="${doc.heroImage.src}" alt="${doc.heroImage.caption}" class="header-hero-img">
              <div class="hero-badge-overlay">
                <span class="hero-badge-dot"></span>
                <span>기본사회 비전 2030</span>
              </div>
              <div class="hero-zoom-overlay">
                <span>🔍 클릭하여 고화질 확대</span>
              </div>
            </div>
          </div>
          `
              : ""
          }
        </div>
      </header>

      <!-- 10초 핵심 요약 배너 -->
      <div class="summary-banner-card">
        <div class="summary-text">${doc.summary}</div>
      </div>

      <!-- 핵심 포인트 카드 -->
      <div class="keypoints-box">
        <div class="keypoints-title">💡 핵심 포인트 요약</div>
        <ul class="keypoints-list">
          ${(doc.keyPoints || []).map((pt) => `<li>${pt}</li>`).join("")}
        </ul>
      </div>

      <!-- 본문 위키 콘텐츠 -->
      <article class="wiki-body-content" id="wikiBodyContent">
        ${doc.contentHtml}
      </article>
    `;

    // 이미지 갤러리 섹션 (추출된 슬라이드 이미지가 있는 경우)
    if (doc.images && doc.images.length > 0) {
      html += `
        <section class="doc-image-gallery">
          <h3>📊 정책 교육 슬라이드 원문 시각자료</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
            ※ 이미지를 클릭하시면 선명한 고해상도 원본 크기로 확대해 보실 수 있습니다.
          </p>
          ${doc.images
            .map(
              (img, idx) => `
            <div class="image-card">
              <div class="image-preview-wrap" data-img-src="${img.src}" data-img-caption="${img.caption}">
                <img src="${img.src}" alt="${img.caption}" loading="lazy">
                <div class="image-zoom-overlay">
                  <span>🔍 클릭하여 고화질 확대 보기</span>
                </div>
              </div>
              <div class="image-caption">
                <span><strong>${img.caption}</strong></span>
                <span style="font-size: 0.75rem; color: var(--primary);">확대보기 ↗</span>
              </div>
            </div>
          `
            )
            .join("")}
        </section>
      `;
    }

    // 연관 문서 링크 섹션
    if (relatedDocs.length > 0) {
      html += `
        <section class="related-docs-card">
          <div class="related-title">🔗 함께 읽어보면 좋은 연관 주제</div>
          <div class="related-grid">
            ${relatedDocs
              .map(
                (rel) => `
              <div class="related-item" data-rel-id="${rel.id}">
                <div class="related-item-title">${rel.title}</div>
                <div class="related-item-desc">${rel.summary}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </section>
      `;
    }

    // 이전/다음 네비게이션 푸터
    html += `
      <footer class="doc-navigation-footer">
        ${
          prevDoc
            ? `
          <div class="nav-btn prev" data-nav-id="${prevDoc.id}">
            <span class="nav-label">← 이전 주제</span>
            <span class="nav-title">${prevDoc.title}</span>
          </div>
        `
            : "<div></div>"
        }
        ${
          nextDoc
            ? `
          <div class="nav-btn next" data-nav-id="${nextDoc.id}">
            <span class="nav-label">다음 주제 →</span>
            <span class="nav-title">${nextDoc.title}</span>
          </div>
        `
            : "<div></div>"
        }
      </footer>
    `;

    elements.mainContent.innerHTML = html;

    // 본문 이벤트 바인딩
    bindDocumentEvents();

    // 우측 온페이지 목차(TOC) 갱신
    buildTableOfContents();
  }

  // 5. 본문 내 이벤트 바인딩
  function bindDocumentEvents() {
    // 히어로 이미지 클릭 시 라이트박스 팝업
    document.querySelectorAll(".header-hero-card").forEach((card) => {
      card.addEventListener("click", () => {
        const src = card.dataset.imgSrc;
        const caption = card.dataset.imgCaption;
        openLightbox(src, caption);
      });
    });

    // 슬라이드 갤러리 이미지 클릭 시 라이트박스 팝업
    document.querySelectorAll(".image-preview-wrap").forEach((wrap) => {
      wrap.addEventListener("click", () => {
        const src = wrap.dataset.imgSrc;
        const caption = wrap.dataset.imgCaption;
        openLightbox(src, caption);
      });
    });

    // 연관 문서 클릭
    document.querySelectorAll(".related-item").forEach((item) => {
      item.addEventListener("click", () => {
        const relId = item.dataset.relId;
        navigateToDoc(relId);
      });
    });

    // 이전/다음 버튼 클릭
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const navId = btn.dataset.navId;
        if (navId) navigateToDoc(navId);
      });
    });

    // 폰트 크기 조절
    const fontIncBtn = document.getElementById("fontIncreaseBtn");
    const fontDecBtn = document.getElementById("fontDecreaseBtn");
    const wikiBody = document.getElementById("wikiBodyContent");

    if (fontIncBtn && wikiBody) {
      fontIncBtn.addEventListener("click", () => {
        if (state.fontSizeLevel < state.fontSizes.length - 1) {
          state.fontSizeLevel++;
          wikiBody.style.fontSize = state.fontSizes[state.fontSizeLevel];
        }
      });
    }

    if (fontDecBtn && wikiBody) {
      fontDecBtn.addEventListener("click", () => {
        if (state.fontSizeLevel > 0) {
          state.fontSizeLevel--;
          wikiBody.style.fontSize = state.fontSizes[state.fontSizeLevel];
        }
      });
    }

    // 링크 복사
    const copyBtn = document.getElementById("copyLinkBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = "✅ 복사 완료!";
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        });
      });
    }

    // 인쇄
    const printBtn = document.getElementById("printDocBtn");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }
  }

  // 6. 우측 온페이지 목차(TOC) 생성 및 스크롤 추적
  function buildTableOfContents() {
    if (!elements.tocList) return;
    elements.tocList.innerHTML = "";

    const headings = elements.mainContent.querySelectorAll(".wiki-body-content h3, .wiki-body-content h4");
    if (headings.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.style.color = "var(--text-muted)";
      emptyLi.textContent = "목차 없음";
      elements.tocList.appendChild(emptyLi);
      return;
    }

    headings.forEach((h, idx) => {
      const headingId = `heading-${idx}`;
      h.id = headingId;

      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "toc-link";
      a.href = `#${headingId}`;
      a.textContent = h.textContent.replace(/^[0-9.]+\s*/, "").trim();
      if (h.tagName === "H4") {
        a.style.paddingLeft = "1rem";
        a.style.fontSize = "0.75rem";
      }

      a.addEventListener("click", (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      li.appendChild(a);
      elements.tocList.appendChild(li);
    });

    // 스크롤 시 현재 보고 있는 소제목 하이라이트
    setupScrollSpy(headings);
  }

  function setupScrollSpy(headings) {
    const tocLinks = document.querySelectorAll(".toc-link");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach((link) => {
              if (link.getAttribute("href") === `#${id}`) {
                link.classList.add("active");
              } else {
                link.classList.remove("active");
              }
            });
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0.1 }
    );

    headings.forEach((h) => observer.observe(h));
  }

  // 7. 실시간 통합 키워드 검색
  function setupSearch() {
    if (!elements.searchInput) return;

    elements.searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        hideSearchResults();
        if (elements.searchClearBtn) elements.searchClearBtn.style.display = "none";
        return;
      }

      if (elements.searchClearBtn) elements.searchClearBtn.style.display = "block";
      performSearch(query);
    });

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener("click", () => {
        elements.searchInput.value = "";
        elements.searchClearBtn.style.display = "none";
        hideSearchResults();
      });
    }

    // 외부 클릭 시 검색창 닫기
    document.addEventListener("click", (e) => {
      if (!elements.searchInput.contains(e.target) && !elements.searchResultsOverlay.contains(e.target)) {
        hideSearchResults();
      }
    });

    // ESC 키 입력 시 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideSearchResults();
        closeLightbox();
      }
    });
  }

  function performSearch(query) {
    const results = [];

    WIKI_DOCUMENTS.forEach((doc) => {
      let score = 0;
      let matchedIn = "";

      // 제목 매칭 (가중치 높음)
      if (doc.title.toLowerCase().includes(query)) {
        score += 10;
        matchedIn = "제목";
      }

      // 태그 매칭
      if (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(query))) {
        score += 8;
        matchedIn = matchedIn ? `${matchedIn}, 태그` : "태그";
      }

      // 요약 매칭
      if (doc.summary.toLowerCase().includes(query)) {
        score += 5;
        matchedIn = matchedIn ? `${matchedIn}, 핵심요약` : "핵심요약";
      }

      // 본문 텍스트 매칭
      const plainContent = doc.contentHtml.replace(/<[^>]*>/g, "").toLowerCase();
      if (plainContent.includes(query)) {
        score += 2;
        matchedIn = matchedIn ? `${matchedIn}, 본문` : "본문";
      }

      if (score > 0) {
        results.push({ doc, score, matchedIn });
      }
    });

    // 검색 결과 정렬 (가중치 높은 순)
    results.sort((a, b) => b.score - a.score);
    renderSearchResults(results, query);
  }

  function renderSearchResults(results, query) {
    if (!elements.searchResultsOverlay) return;

    if (results.length === 0) {
      elements.searchResultsOverlay.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">
          검색어 "<strong>${query}</strong>"에 대한 결과가 없습니다.
        </div>
      `;
      elements.searchResultsOverlay.classList.add("show");
      return;
    }

    let html = `
      <div style="padding: 0.25rem 0.5rem 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
        검색 결과: <strong>${results.length}</strong>건
      </div>
    `;

    results.forEach(({ doc, matchedIn }) => {
      // 키워드 하이라이트
      const highlightedTitle = highlightKeyword(doc.title, query);
      const highlightedSummary = highlightKeyword(doc.summary, query);

      html += `
        <div class="search-result-item" data-search-doc-id="${doc.id}">
          <div class="search-res-title">${highlightedTitle}</div>
          <div class="search-res-snippet">${highlightedSummary}</div>
          <div style="margin-top: 0.25rem; font-size: 0.7rem; color: var(--primary);">매칭 위치: ${matchedIn}</div>
        </div>
      `;
    });

    elements.searchResultsOverlay.innerHTML = html;
    elements.searchResultsOverlay.classList.add("show");

    // 결과 항목 클릭 이벤트
    elements.searchResultsOverlay.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        const docId = item.dataset.searchDocId;
        navigateToDoc(docId);
        hideSearchResults();
        closeMobileSidebar();
      });
    });
  }

  function highlightKeyword(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, "gi");
    return text.replace(regex, '<span class="highlight-mark">$1</span>');
  }

  function hideSearchResults() {
    if (elements.searchResultsOverlay) {
      elements.searchResultsOverlay.classList.remove("show");
    }
  }

  // 8. 이미지 라이트박스 모달
  function openLightbox(src, caption) {
    if (!elements.lightboxModal || !elements.lightboxImg) return;
    elements.lightboxImg.src = src;
    elements.lightboxCaption.textContent = caption || "";
    elements.lightboxModal.classList.add("show");
  }

  function closeLightbox() {
    if (!elements.lightboxModal) return;
    elements.lightboxModal.classList.remove("show");
  }

  if (elements.lightboxCloseBtn) {
    elements.lightboxCloseBtn.addEventListener("click", closeLightbox);
  }

  if (elements.lightboxModal) {
    elements.lightboxModal.addEventListener("click", (e) => {
      if (e.target === elements.lightboxModal) {
        closeLightbox();
      }
    });
  }

  // 9. 모바일 사이드바 토글
  function toggleMobileSidebar() {
    if (!elements.sidebar) return;
    elements.sidebar.classList.toggle("mobile-open");
  }

  function closeMobileSidebar() {
    if (elements.sidebar && elements.sidebar.classList.contains("mobile-open")) {
      elements.sidebar.classList.remove("mobile-open");
    }
  }

  if (elements.sidebarToggleBtn) {
    elements.sidebarToggleBtn.addEventListener("click", toggleMobileSidebar);
  }

  if (elements.sidebarBackdrop) {
    elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  }

  // 10. 사이드바 전체 펼치기 / 접기
  if (elements.expandAllBtn) {
    elements.expandAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".tree-category").forEach((cat) => cat.classList.add("open"));
    });
  }

  if (elements.collapseAllBtn) {
    elements.collapseAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".tree-category").forEach((cat) => cat.classList.remove("open"));
    });
  }

  // 11. 테마 토글 버튼 이벤트
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // 12. 브라우저 라우트 이벤트 리스너 등록
  window.addEventListener("hashchange", handleRoute);

  // 초기화 실행
  initTheme();
  renderTree();
  setupSearch();
  handleRoute();
});
