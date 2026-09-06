/* Shared behavior: theme toggle, nav, signal line, reveal animations,
   count-up stats, magnetic buttons. Loaded on every page. GSAP is loaded
   via CDN before this file where a page uses hero entrance animation. */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var THEME_KEY = "faizan-theme";

  function applyTheme(theme) {
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function currentTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return null; // follow system
  }

  applyTheme(currentTheme());

  function initThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    function isDark() {
      var explicit = root.getAttribute("data-theme");
      if (explicit) return explicit === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function reflect() {
      btn.setAttribute("aria-pressed", String(isDark()));
      btn.setAttribute(
        "aria-label",
        isDark() ? "Switch to light theme" : "Switch to dark theme"
      );
    }
    reflect();
    btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
      reflect();
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    });
  }

  /* ---------- accent palette switcher (independent of light/dark) ------
     Reuses the same "themechange" event the theme toggle already fires —
     hero3d.js, bg-datascience.js and stats3d.js all listen for it and
     re-read --accent via getComputedStyle, so they re-tint on a palette
     change with no code changes of their own. */
  var PALETTE_KEY = "faizan-palette";
  var PALETTE_NAMES = { amber: "amber", cyan: "cyan", violet: "violet", sage: "sage" };

  function applyPalette(name) {
    if (PALETTE_NAMES[name] && name !== "amber") {
      root.setAttribute("data-palette", name);
    } else {
      root.removeAttribute("data-palette"); // amber is the unscoped default
    }
  }

  (function initPaletteEarly() {
    var stored = localStorage.getItem(PALETTE_KEY);
    if (stored) applyPalette(stored);
  })();

  function initPaletteSwitcher() {
    var group = document.querySelector("[data-palette-switcher]");
    if (!group) return;
    var swatches = group.querySelectorAll(".palette-swatch");

    function current() {
      return localStorage.getItem(PALETTE_KEY) || "amber";
    }
    function reflect() {
      var active = current();
      swatches.forEach(function (s) {
        s.setAttribute("aria-pressed", String(s.getAttribute("data-palette-value") === active));
      });
    }
    reflect();

    swatches.forEach(function (s) {
      s.addEventListener("click", function () {
        var name = s.getAttribute("data-palette-value");
        applyPalette(name);
        localStorage.setItem(PALETTE_KEY, name);
        reflect();
        document.dispatchEvent(new CustomEvent("themechange", { detail: { palette: name } }));
      });
    });
  }

  /* ---------- photo tint toggle: opt-in accent-tinted duotone on the hero
     cutout, tied to whichever palette is active (see --duotone-hue in
     styles.css). True color stays the default. ---------------------- */
  var PHOTO_TINT_KEY = "faizan-photo-tint";
  function initPhotoStyleToggle() {
    var btn = document.querySelector("[data-photo-style-toggle]");
    var wrap = document.querySelector("[data-cutout-photo]");
    if (!btn || !wrap) return;

    function reflect(on) {
      wrap.classList.toggle("is-tinted", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "true color photo" : "tint photo to palette";
    }
    reflect(localStorage.getItem(PHOTO_TINT_KEY) === "on");

    btn.addEventListener("click", function () {
      var next = !wrap.classList.contains("is-tinted");
      reflect(next);
      localStorage.setItem(PHOTO_TINT_KEY, next ? "on" : "off");
    });
  }

  /* ---------- mobile nav ---------- */
  function initNav() {
    var burger = document.querySelector("[data-nav-burger]");
    var links = document.querySelector("[data-nav-links]");
    if (!burger || !links) return;
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- signal line (scroll progress + section markers) ---------- */
  function initSignalLine() {
    var line = document.querySelector("[data-signal-line]");
    if (!line) return;
    var fill = line.querySelector(".signal-line__fill");
    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-signal-marker]"));
    var markers = sections.map(function (sec, i) {
      var m = document.createElement("div");
      m.className = "signal-line__marker";
      line.appendChild(m);
      return { el: sec, marker: m };
    });

    function layoutMarkers() {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      markers.forEach(function (item) {
        var rect = item.el.getBoundingClientRect();
        var top = rect.top + window.scrollY;
        var pct = docH > 0 ? (top / docH) * 100 : 0;
        item.marker.style.top = pct + "%";
      });
    }

    function update() {
      var scrollTop = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? (scrollTop / docH) * 100 : 0;
      fill.style.height = Math.min(100, Math.max(0, pct)) + "%";
      markers.forEach(function (item) {
        var rect = item.el.getBoundingClientRect();
        item.marker.classList.toggle("is-active", rect.top < window.innerHeight * 0.6);
      });
    }

    layoutMarkers();
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () {
      layoutMarkers();
      update();
    });
  }

  /* ---------- reveal-on-scroll (radar chart, bars, sig icons, cards) ---------- */
  function initReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- count-up stats ---------- */
  function initCountUp() {
    var els = document.querySelectorAll("[data-countup]");
    if (!els.length) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var RING_CIRC = 81.68; /* 2*pi*13, matches .stat__ring-fill's r=13 in CSS */

    function run(el) {
      var target = parseFloat(el.getAttribute("data-countup"));
      var decimals = (el.getAttribute("data-countup").split(".")[1] || "").length;
      var suffix = el.getAttribute("data-suffix") || "";
      var statEl = el.closest(".stat");
      var ring = statEl ? statEl.querySelector("[data-ring]") : null;

      if (reduce) {
        el.textContent = target.toFixed(decimals) + suffix;
        if (ring) ring.style.strokeDashoffset = "0";
        return;
      }
      var start = 0;
      var duration = 1400;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min(1, (ts - startTime) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        var val = start + (target - start) * eased;
        el.textContent = val.toFixed(decimals) + suffix;
        if (ring) ring.style.strokeDashoffset = String(RING_CIRC * (1 - eased));
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      els.forEach(run);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            run(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- magnetic buttons ---------- */
  function initMagnetic() {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var els = document.querySelectorAll("[data-magnetic]");
    els.forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = "translate(" + x * 0.25 + "px," + y * 0.35 + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------- photo card tilt ---------- */
  function initTilt() {
    var stage = document.querySelector("[data-tilt-stage]");
    if (!stage) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var wrap = stage.closest(".photo-card");
    wrap.addEventListener("mousemove", function (e) {
      var rect = wrap.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      stage.style.transform =
        "rotateY(" + x * 16 + "deg) rotateX(" + -y * 16 + "deg)";
    });
    wrap.addEventListener("mouseleave", function () {
      stage.style.transform = "rotateY(0) rotateX(0)";
    });
  }

  /* ---------- project card hover tilt: subtle depth, cursor-driven ----- */
  function initCardTilt() {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cards = document.querySelectorAll(".card");
    cards.forEach(function (card) {
      card.style.transformStyle = "preserve-3d";
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          "translateY(-4px) rotateY(" + x * 5 + "deg) rotateX(" + -y * 5 + "deg)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* ---------- hero-scoped cursor trail: small fading dots, evoking
     "data points being sampled" rather than a generic glitter trail ----- */
  function initCursorTrail() {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var hero = document.querySelector(".hero");
    if (!hero) return;
    var lastSpawn = 0;
    hero.addEventListener("mousemove", function (e) {
      var now = performance.now();
      if (now - lastSpawn < 45) return; /* throttle spawn rate */
      lastSpawn = now;
      var rect = hero.getBoundingClientRect();
      var dot = document.createElement("span");
      dot.className = "cursor-trail-dot";
      dot.style.left = (e.clientX - rect.left) + "px";
      dot.style.top = (e.clientY - rect.top) + "px";
      hero.appendChild(dot);
      requestAnimationFrame(function () {
        dot.style.opacity = "0";
        dot.style.transform = "translate(-50%, -50%) scale(0.4)";
      });
      setTimeout(function () { dot.remove(); }, 420);
    });
  }

  /* ---------- terminal/activity-log loading indicator: a pulsing dot
     while the real GitHub fetch is in flight, a static checkmark once it
     resolves (live or fallback) — ties the decoration to real state ---- */
  function initGhLoadingIndicator() {
    var titleEl = document.querySelector(".activity-log__body");
    if (!titleEl) return;
    var bar = titleEl.previousElementSibling; /* .terminal__bar */
    var titleSpan = bar && bar.querySelector(".terminal__title");
    if (!titleSpan) return;
    var pulse = document.createElement("span");
    pulse.className = "gh-load-pulse";
    pulse.setAttribute("aria-hidden", "true");
    titleSpan.parentNode.insertBefore(pulse, titleSpan);
    window.addEventListener("gh:events", function () {
      pulse.className = "gh-load-pulse is-done";
      pulse.textContent = "";
    }, { once: true });
  }

  /* ---------- radar chart hover: highlight the hovered axis label ------ */
  function initRadarHover() {
    document.querySelectorAll(".radar-label").forEach(function (label) {
      label.style.cursor = "default";
      label.style.transition = "fill 0.2s ease, font-weight 0.2s ease";
      label.addEventListener("mouseenter", function () { label.classList.add("is-hovered"); });
      label.addEventListener("mouseleave", function () { label.classList.remove("is-hovered"); });
    });
  }

  /* ---------- terminal typing effect ---------- */
  function initTerminal() {
    var el = document.querySelector("[data-terminal-type]");
    if (!el) return;
    var lines = JSON.parse(el.getAttribute("data-terminal-type"));
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var out = document.createElement("span");
    out.className = "terminal__prompt";
    el.appendChild(out);
    var cursor = document.createElement("span");
    cursor.className = "terminal__cursor";
    cursor.setAttribute("aria-hidden", "true");
    el.appendChild(cursor);

    if (reduce) {
      out.textContent = lines[lines.length - 1];
      return;
    }

    var li = 0, ci = 0;
    function type() {
      if (li >= lines.length) { li = 0; setTimeout(erase, 1400); return; }
      var line = lines[li];
      if (ci <= line.length) {
        out.textContent = line.slice(0, ci);
        ci++;
        setTimeout(type, 38);
      } else {
        setTimeout(erase, 1300);
      }
    }
    function erase() {
      var line = lines[li];
      if (ci > 0) {
        out.textContent = line.slice(0, ci);
        ci--;
        setTimeout(erase, 18);
      } else {
        li++;
        setTimeout(type, 250);
      }
    }
    type();
  }

  /* ---------- filter buttons: fade+shrink out, grid reflows, live count,
     shareable via ?tag= query param ------------------------------------ */
  function initFilters() {
    var bar = document.querySelector("[data-filters]");
    if (!bar) return;
    var buttons = bar.querySelectorAll(".filter-btn");
    var cards = document.querySelectorAll("[data-tech]");
    var countEl = document.querySelector("[data-filter-count]");
    var hasGsap = typeof gsap !== "undefined";
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function updateCount(shown) {
      if (!countEl) return;
      countEl.textContent = "Showing " + shown + " of " + cards.length + " projects";
    }

    function apply(tech, pushUrl) {
      var shown = 0;
      cards.forEach(function (card) {
        var list = card.getAttribute("data-tech").split(",");
        var match = tech === "all" || list.indexOf(tech) !== -1;
        if (match) shown++;

        if (reduce || !hasGsap) {
          card.hidden = !match;
          return;
        }

        if (match) {
          card.hidden = false;
          gsap.fromTo(
            card,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }
          );
        } else if (!card.hidden) {
          gsap.to(card, {
            opacity: 0,
            scale: 0.9,
            duration: 0.25,
            ease: "power2.in",
            onComplete: function () { card.hidden = true; }
          });
        }
      });
      updateCount(shown);

      if (pushUrl) {
        var url = new URL(window.location.href);
        if (tech === "all") url.searchParams.delete("tag");
        else url.searchParams.set("tag", tech);
        history.replaceState(null, "", url.pathname + url.search);
      }
    }

    function activateButton(tech) {
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === tech));
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tech = btn.getAttribute("data-filter");
        activateButton(tech);
        apply(tech, true);
      });
    });

    /* clicking an individual tech tag on a card also filters, matching
       the requested "click a tag to highlight/dim" interaction */
    document.querySelectorAll(".tag[data-filter-tag]").forEach(function (tagEl) {
      tagEl.style.cursor = "pointer";
      tagEl.addEventListener("click", function (e) {
        e.preventDefault();
        var tech = tagEl.getAttribute("data-filter-tag");
        var btn = bar.querySelector('.filter-btn[data-filter="' + tech + '"]');
        if (btn) btn.click();
      });
    });

    /* restore a filtered view from ?tag= on load, so it's linkable/shareable */
    var initialTag = new URL(window.location.href).searchParams.get("tag");
    if (initialTag && bar.querySelector('.filter-btn[data-filter="' + initialTag + '"]')) {
      activateButton(initialTag);
      apply(initialTag, false);
    } else {
      updateCount(cards.length);
    }
  }

  /* ---------- live GitHub stat chip (hero) ------------------------------ */
  function initGhChip() {
    var chip = document.querySelector("[data-gh-chip]");
    if (!chip) return;
    window.addEventListener("gh:user", function (e) {
      var d = e.detail;
      chip.innerHTML =
        '<span class="gh-chip__dot" aria-hidden="true"></span>' +
        "<span><strong>" + d.followers + "</strong> followers</span>" +
        '<span class="gh-chip__sep">·</span>' +
        "<span><strong>" + d.public_repos + "</strong> public repos</span>";
      chip.classList.toggle("is-live", !!d.live);
      chip.setAttribute("title", d.live ? "Live from GitHub" : "Cached — GitHub API unavailable");
    });
  }

  /* ---------- live GitHub activity log (below/next to terminal) -------- */
  function initActivityLog() {
    var body = document.querySelector("[data-activity-log]");
    if (!body) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.addEventListener("gh:events", function (e) {
      var items = e.detail.items;
      body.innerHTML = "";
      if (!items || !items.length) {
        var fallback = document.createElement("div");
        fallback.className = "activity-log__line is-in";
        fallback.textContent = "$ no recent public activity to display";
        body.appendChild(fallback);
        return;
      }
      items.forEach(function (item, i) {
        var line = document.createElement("div");
        line.className = "activity-log__line";
        line.innerHTML =
          '<span class="gh-type">' + window.FaizanGH.typeLabel(item.type) + "</span> → " +
          '<span class="gh-repo">' + item.repo + "</span>" +
          '<span class="gh-time">' + window.FaizanGH.relativeTime(item.created_at) + "</span>";
        body.appendChild(line);
        if (reduce) {
          line.classList.add("is-in");
        } else {
          setTimeout(function () { line.classList.add("is-in"); }, i * 260);
        }
      });
    });
  }

  /* ---------- live repo stat badges (project cards) --------------------- */
  function initRepoBadges() {
    var badges = document.querySelectorAll("[data-repo]");
    if (!badges.length || !window.FaizanGH) return;
    badges.forEach(function (badge) {
      var repo = badge.getAttribute("data-repo");
      window.addEventListener("gh:repo:" + repo, function (e) {
        var d = e.detail;
        var updated = d.updated ? window.FaizanGH.relativeTime(d.updated) : "—";
        badge.innerHTML =
          '<span class="repo-badge__dot" aria-hidden="true"></span>' +
          "★ " + (d.stars != null ? d.stars : "—") + " · updated " + updated;
        badge.classList.toggle("is-live", !!d.live);
      }, { once: true });
      window.FaizanGH.fetchRepo(repo);
    });
  }

  /* ---------- horizontal credentials timeline draw-in -------------------- */
  function initHTimeline() {
    var el = document.querySelector("[data-htimeline]");
    if (!el) return;
    var targets = el.querySelectorAll(".htimeline-line__fill, .htimeline-dot");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          targets.forEach(function (t, i) {
            setTimeout(function () { t.classList.add("is-visible"); }, i * 120);
          });
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
  }

  /* ---------- footer ambient particle canvas (2D, cursor parallax) ------ */
  function initFooterParticles() {
    var canvas = document.querySelector("[data-footer-canvas]");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function accent() {
      return getComputedStyle(document.documentElement).getPropertyValue("--border-strong").trim() || "#888";
    }

    var dots = [];
    var COLS = 14, ROWS = 5;
    function layout() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.height = h * Math.min(window.devicePixelRatio || 1, 1.5);
      ctx.setTransform(Math.min(window.devicePixelRatio || 1, 1.5), 0, 0, Math.min(window.devicePixelRatio || 1, 1.5), 0, 0);
      dots = [];
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          dots.push({
            baseX: (x + 0.5) * (w / COLS),
            baseY: (y + 0.5) * (h / ROWS)
          });
        }
      }
    }
    layout();
    window.addEventListener("resize", layout);

    var mx = -9999, my = -9999;
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    });
    canvas.addEventListener("mouseleave", function () { mx = -9999; my = -9999; });

    var running = true;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { running = entry.isIntersecting; });
      });
      io.observe(canvas);
    }

    var t = 0;
    function draw() {
      requestAnimationFrame(draw);
      if (!running) return;
      t += reduce ? 0 : 0.006;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent();
      dots.forEach(function (d, i) {
        var drift = reduce ? 0 : Math.sin(t + i) * 3;
        var dx = d.baseX - mx, dy = d.baseY - my;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var push = dist < 90 ? (90 - dist) / 90 * 6 : 0;
        var px = d.baseX + drift + (dist ? (dx / dist) * push : 0);
        var py = d.baseY + drift * 0.6 + (dist ? (dy / dist) * push : 0);
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    draw();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initPaletteSwitcher();
    initPhotoStyleToggle();
    initNav();
    initSignalLine();
    initReveal();
    initCountUp();
    initMagnetic();
    initTilt();
    initCardTilt();
    initCursorTrail();
    initGhLoadingIndicator();
    initRadarHover();
    initTerminal();
    initFilters();
    initGhChip();
    initActivityLog();
    initRepoBadges();
    initHTimeline();
    initFooterParticles();
  });
})();
