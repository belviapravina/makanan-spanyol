/* script.js
   Cara pakai:
   1) Simpan file ini sebagai "script.js"
   2) Tambahkan di paling bawah sebelum </body>:
      <script src="script.js"></script>

   Fitur:
   - Modal lebih “hidup”: buka/tutup tanpa loncat hash, ESC untuk tutup, lock scroll
   - Smooth open/close animation (pakai class)
   - Click di luar modal untuk tutup
   - Scroll-reveal untuk 3 kartu utama
   - Tilt 3D halus saat hover kartu
   - Parallax orbs mengikuti mouse (background lebih dinamis)
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Helpers ----------
  const lockScroll = (lock) => {
    if (lock) {
      document.documentElement.classList.add("no-scroll");
      document.body.classList.add("no-scroll");
    } else {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    }
  };

  const ensureEnhancerStyles = () => {
    // Tambahkan CSS kecil via JS (tanpa perlu edit style.css)
    if ($("#js-enhancer-styles")) return;
    const style = document.createElement("style");
    style.id = "js-enhancer-styles";
    style.textContent = `
      html.no-scroll, body.no-scroll { overflow: hidden !important; }

      /* Override modal :target supaya bisa pakai class is-open */
      .modal { display: none; }
      .modal.is-open { display: block; }

      /* Animasi open/close */
      .modal__box {
        transform: translateY(10px) scale(.985);
        opacity: 0;
        transition: transform .22s ease, opacity .22s ease;
        will-change: transform, opacity;
      }
      .modal.is-open .modal__box {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .modal__overlay {
        opacity: 0;
        transition: opacity .22s ease;
      }
      .modal.is-open .modal__overlay {
        opacity: 1;
      }

      /* Scroll reveal */
      .card.reveal-init { opacity: 0; transform: translateY(14px); }
      .card.reveal-in { opacity: 1; transform: translateY(0); transition: transform .55s ease, opacity .55s ease; }

      /* Tilt smoothing */
      .card { transform-style: preserve-3d; will-change: transform; }
      .card.tilt-active { transition: transform .08s linear; }

      /* Fokus ring halus */
      .btn:focus-visible, .modal__close:focus-visible {
        outline: 2px solid rgba(251,191,36,.65);
        outline-offset: 3px;
      }

      /* Hide header when modal is open */
      .header-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  };

  // ---------- Modal System (enhance :target) ----------
  const modals = $$(".modal");
  const openBtns = $$(".btn[href^='#modal-']");
  let activeModal = null;
  let lastFocus = null;

  const openModal = (modal) => {
    if (!modal) return;
    // close existing
    if (activeModal && activeModal !== modal) closeModal(activeModal);

    activeModal = modal;
    lastFocus = document.activeElement;

    // Open
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockScroll(true);

    // Hide header when modal is open
    const header = $(".header");
    if (header) header.classList.add("header-hidden");

    // Focus close button for accessibility
    const closeBtn = $(".modal__close", modal);
    if (closeBtn) closeBtn.focus({ preventScroll: true });

    // Optional: prevent background click through
    modal.addEventListener("wheel", stopIfInsideScrollable, { passive: false });
  };

  const closeModal = (modal) => {
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    // Unlock scroll after animation
    window.setTimeout(() => {
      if (activeModal === modal) activeModal = null;
      lockScroll(false);
      // Show header when modal is closed
      const header = $(".header");
      if (header) header.classList.remove("header-hidden");
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus({ preventScroll: true });
      }
    }, 220);

    modal.removeEventListener("wheel", stopIfInsideScrollable);
  };

  const stopIfInsideScrollable = (e) => {
    // Simple guard: keep wheel inside modal body (biar background nggak geser)
    if (!activeModal) return;
    const body = $(".modal__body", activeModal);
    if (!body) return;

    const atTop = body.scrollTop <= 0;
    const atBottom = Math.ceil(body.scrollTop + body.clientHeight) >= body.scrollHeight;

    // If user scrolls beyond bounds, prevent page scroll
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  };

  const getModalFromHref = (href) => {
    if (!href || !href.startsWith("#")) return null;
    return $(href);
  };

  const closeActiveModal = () => {
    if (activeModal) closeModal(activeModal);
  };

  // Intercept button clicks (no hash jump)
  const bindModalTriggers = () => {
    openBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modal = getModalFromHref(btn.getAttribute("href"));
        if (!modal) return;
        e.preventDefault();
        openModal(modal);
      });
    });

    // Overlay click & close button click
    modals.forEach((m) => {
      const overlay = $(".modal__overlay", m);
      const closeBtn = $(".modal__close", m);

      if (overlay) {
        overlay.addEventListener("click", (e) => {
          e.preventDefault();
          closeModal(m);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          closeModal(m);
        });
      }

      // Click outside modal__box (safety)
      m.addEventListener("click", (e) => {
        const box = $(".modal__box", m);
        if (!box) return;
        if (!box.contains(e.target)) closeModal(m);
      });
    });

    // ESC close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeActiveModal();
    });
  };

  // ---------- Scroll Reveal ----------
  const initReveal = () => {
    const cards = $$(".card");
    cards.forEach((c) => c.classList.add("reveal-init"));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("reveal-in");
            en.target.classList.remove("reveal-init");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    cards.forEach((c) => io.observe(c));
  };

  // ---------- 3D Tilt on Cards ----------
  const initTilt = () => {
    const cards = $$(".card");

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    cards.forEach((card) => {
      let raf = null;

      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width; // 0..1
        const py = (e.clientY - rect.top) / rect.height; // 0..1

        const tiltX = clamp((0.5 - py) * 10, -8, 8); // rotateX
        const tiltY = clamp((px - 0.5) * 12, -10, 10); // rotateY

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.classList.add("tilt-active");
          card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
        });
      };

      const onLeave = () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = "";
        card.classList.remove("tilt-active");
      };

      // Desktop only (avoid weird on touch)
      const isFinePointer = window.matchMedia("(pointer: fine)").matches;
      if (!isFinePointer) return;

      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
    });
  };

  // ---------- Parallax Orbs ----------
  const initOrbsParallax = () => {
    const orbs = $$(".bg-orb");
    if (!orbs.length) return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    let raf = null;
    window.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth) - 0.5; // -0.5..0.5
      const y = (e.clientY / window.innerHeight) - 0.5;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        orbs.forEach((orb, i) => {
          const strength = (i + 1) * 14;
          orb.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
        });
      });
    });
  };

  // ---------- Prevent opening by hash if user reload with #modal-... ----------
  const handleInitialHash = () => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#modal-")) return;

    const modal = $(hash);
    if (!modal) return;

    // remove hash without scrolling
    history.replaceState(null, "", window.location.pathname + window.location.search);
    openModal(modal);
  };

  // ---------- Init ----------
  ensureEnhancerStyles();
  bindModalTriggers();
  initReveal();
  initTilt();
  initOrbsParallax();
  handleInitialHash();

  // ---------- Comment System ----------
  const commentForm = document.querySelector('.comment-form');
  const commentList = document.querySelector('.comment-list');
  const STORAGE_KEY = 'spanish-food-comments';

  // Load comments from localStorage
  function loadComments() {
    let comments = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (comments.length === 0) {
      // Add sample comments if none exist
      comments = [
        { name: 'User', message: 'Makasih ya ka, aku jadi tahu makanan Spanyol', replies: [] },
        { name: 'Pengunjung', message: 'bintang 5', replies: [] },
        { name: 'User', message: 'wah bermanfaat banget kak', replies: [] },
        { name: 'User', message: 'websitenya bagus banget kak', replies: [] }
      ];
      saveComments(comments);
    }
    renderComments(comments);
  }

  // Save comments to localStorage
  function saveComments(comments) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
  }

  // Render comments and replies
  function renderComments(comments) {
    commentList.innerHTML = '';
    comments.forEach((comment, index) => {
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment-item';
      commentDiv.innerHTML = `
        <p class="comment-user">${comment.name}</p>
        <p class="comment-message">${comment.message}</p>
        <button class="reply-btn" data-index="${index}">Balas</button>
        <form class="reply-form" style="display: none;">
          <input type="text" placeholder="Nama Anda" required>
          <textarea placeholder="Tulis balasan..." required></textarea>
          <button type="submit">Kirim Balasan</button>
        </form>
      `;
      commentList.appendChild(commentDiv);

      // Render replies
      if (comment.replies) {
        comment.replies.forEach(reply => {
          const replyDiv = document.createElement('div');
          replyDiv.className = 'reply-item';
          replyDiv.innerHTML = `
            <p class="comment-user">${reply.name}</p>
            <p class="comment-message">${reply.message}</p>
          `;
          commentDiv.appendChild(replyDiv);
        });
      }
    });
  }

  // Handle main comment form submission
  commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = commentForm.querySelector('.comment-name').value.trim();
    const message = commentForm.querySelector('.comment-text').value.trim();
    if (!name || !message) return;

    const comments = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    comments.push({ name, message, replies: [] });
    saveComments(comments);
    renderComments(comments);
    commentForm.reset();
  });

  // Handle reply button clicks
  commentList.addEventListener('click', (e) => {
    if (e.target.classList.contains('reply-btn')) {
      const replyForm = e.target.nextElementSibling;
      replyForm.classList.toggle('show');
    }
  });

  // Handle reply form submissions
  commentList.addEventListener('submit', (e) => {
    if (e.target.classList.contains('reply-form')) {
      e.preventDefault();
      const index = e.target.previousElementSibling.dataset.index;
      const name = e.target.querySelector('input').value.trim();
      const message = e.target.querySelector('textarea').value.trim();
      if (!name || !message) return;

      const comments = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      if (!comments[index].replies) comments[index].replies = [];
      comments[index].replies.push({ name, message });
      saveComments(comments);
      renderComments(comments);
    }
  });

  // Load comments on page load
  loadComments();
})();


