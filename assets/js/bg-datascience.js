/* Site-wide ambient background. A single fixed full-viewport canvas
   (z-index -1, pointer-events: none) shared across the whole scroll and
   every page. Two selectable render modes, chosen via data-bg-mode on
   <body> ("datasheet" = default, "galaxy" = alternate) — both share the
   exact same lifecycle (resize, tab-hidden pause, prefers-reduced-motion
   freeze-to-static-frame, theme re-tint via --accent/--accent-2/
   --grid-line, an FPS safety net, scroll/cursor parallax, and a per-
   section "muted" opacity hook) and reinterpret the same four layers:

     1. grid       — faint graph-paper texture, viewport-locked (no parallax)
     2. blobs      — datasheet: soft accent "aurora" blobs
                     galaxy:    nebula clouds (accent -> accent-2 blend)
     3. scatter    — datasheet: sparse drifting node-network (2D cousin of
                                 hero3d.js's WebGL node sphere)
                     galaxy:    star field + fading constellations
     4. curve      — datasheet: live synthetic "training-loss" curve
                     galaxy:    occasional shooting-star streak (kept the
                                 curve out of galaxy mode — a horizontal
                                 loss line reads as an odd literal object
                                 floating in a starfield; a streak reads as
                                 "space" immediately and still ties to the
                                 same low-opacity, momentary-event language)
     grain — a two-tile crossfading noise texture on top of everything,
             static under reduced motion.

   All layers are scaled by the live --signal-intensity value that
   github.js sets on <html> from real GitHub activity recency (also read
   directly here via the "gh:signal" event for per-frame use without a
   style read every frame).

   Throttled to ~24fps; after ~2s it measures actual frame rate and, if
   meaningfully under 24fps, permanently drops the O(n^2) connecting-line
   pass and halves the blob count — a one-time downgrade, not a flapping
   toggle. Injects its own <canvas> — just include this script once per
   page, no markup needed beyond the optional data-bg-mode/data-bg-mood
   attributes described above. */
(function () {
  "use strict";

  function init() {
    var canvas = document.createElement("canvas");
    canvas.className = "bg-ds-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext("2d");

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pointerFine = window.matchMedia("(pointer: fine)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function mode() { return document.body.getAttribute("data-bg-mode") === "galaxy" ? "galaxy" : "datasheet"; }
    function isDarkTheme() {
      var explicit = document.documentElement.getAttribute("data-theme");
      if (explicit) return explicit === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    var colors = { accent: "#d97706", accent2: "#92400e", grid: "rgba(0,0,0,0.06)" };
    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      colors.accent = cs.getPropertyValue("--accent").trim() || colors.accent;
      colors.accent2 = cs.getPropertyValue("--accent-2").trim() || colors.accent2;
      colors.grid = cs.getPropertyValue("--grid-line").trim() || colors.grid;
    }
    readColors();
    document.addEventListener("themechange", function () {
      readColors();
      if (reduceMotion) drawFrame();
    });

    /* live "signal" value from real GitHub activity recency (github.js) */
    var signal = 0.5;
    window.addEventListener("gh:signal", function (e) {
      signal = e.detail && typeof e.detail.value === "number" ? e.detail.value : 0.5;
    });

    /* switch render mode live if data-bg-mode ever changes at runtime */
    if ("MutationObserver" in window) {
      new MutationObserver(function () { buildBlobs(); buildScatter(); drawFrame(); })
        .observe(document.body, { attributes: true, attributeFilter: ["data-bg-mode"] });
    }

    /* ---- performance state --------------------------------------------- */
    var lowPerf = false;
    var perfChecked = false;
    var frameCount = 0;
    var perfStart = null;

    /* ---- scroll + cursor parallax (blobs/scatter only; grid/grain don't
       move, per spec) ------------------------------------------------- */
    var scrollY = window.scrollY || 0;
    window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });
    var mouseNX = 0, mouseNY = 0; /* -0.5..0.5 */
    if (pointerFine && !reduceMotion) {
      window.addEventListener("mousemove", function (e) {
        mouseNX = e.clientX / window.innerWidth - 0.5;
        mouseNY = e.clientY / window.innerHeight - 0.5;
      });
    }

    /* ---- per-section "muted" opacity hook: <section data-bg-mood="muted">
       fades the whole background's intensity down while it's in view --- */
    var moodMultiplier = 1, moodTarget = 1;
    if ("IntersectionObserver" in window) {
      var moodIo = new IntersectionObserver(function (entries) {
        var anyMuted = entries.some(function (en) { return en.isIntersecting; }) ||
          Array.prototype.some.call(document.querySelectorAll('[data-bg-mood="muted"]'), function (el) {
            var r = el.getBoundingClientRect();
            return r.top < window.innerHeight * 0.7 && r.bottom > window.innerHeight * 0.3;
          });
        moodTarget = anyMuted ? 0.4 : 1;
      }, { threshold: 0.3 });
      document.querySelectorAll('[data-bg-mood="muted"]').forEach(function (el) { moodIo.observe(el); });
    }

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSeries();
      buildScatter();
      buildBlobs();
      drawFrame();
    }

    /* ================= LAYER 2: blobs (aurora / nebula) ================= */
    var blobs = [];
    function buildBlobs() {
      var w = window.innerWidth, h = window.innerHeight;
      var count = lowPerf ? 2 : (window.innerWidth < 700 ? 2 : 3);
      blobs = [];
      for (var i = 0; i < count; i++) {
        blobs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.min(w, h) * (0.28 + Math.random() * 0.16),
          vx: (Math.random() - 0.5) * 0.06,
          vy: (Math.random() - 0.5) * 0.06,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    function updateBlobs() {
      var w = window.innerWidth, h = window.innerHeight;
      blobs.forEach(function (b) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.x = w + b.r; else if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r; else if (b.y > h + b.r) b.y = -b.r;
      });
    }
    function drawBlobs(t, parX, parY) {
      var galaxy = mode() === "galaxy";
      blobs.forEach(function (b, i) {
        var pulse = 0.75 + 0.25 * Math.sin(t * 0.0004 + b.phase) * (0.5 + signal * 0.5);
        var bx = b.x + parX * (0.4 + i * 0.15);
        var by = b.y + parY * (0.4 + i * 0.15) + scrollY * 0.2;
        var grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        /* dialed back further for the monochrome-primary restyle — type and
           whitespace carry the visual weight now, so this sits further
           back in contrast than before (was 0.10/0.06 galaxy, 0.07 datasheet) */
        if (galaxy) {
          grad.addColorStop(0, hexToRgba(colors.accent, 0.06 * pulse * moodMultiplier));
          grad.addColorStop(0.55, hexToRgba(colors.accent2, 0.035 * pulse * moodMultiplier));
          grad.addColorStop(1, hexToRgba(colors.accent2, 0));
        } else {
          grad.addColorStop(0, hexToRgba(colors.accent, 0.04 * pulse * moodMultiplier));
          grad.addColorStop(1, hexToRgba(colors.accent, 0));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2);
      });
    }
    function hexToRgba(hex, alpha) {
      hex = hex.trim();
      if (hex.charAt(0) !== "#") return hex; /* already rgb()/rgba() from a CSS var edge case */
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }

    /* ============ LAYER 3: scatter network / star field ================ */
    var scatter = [];
    var SCATTER_CONNECT_DIST = 130;
    function buildScatter() {
      var galaxy = mode() === "galaxy";
      var base = window.innerWidth < 700 ? 15 : 36;
      var count = lowPerf ? Math.round(base * 0.6) : base;
      var w = window.innerWidth, h = window.innerHeight;
      scatter = [];
      for (var i = 0; i < count; i++) {
        scatter.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: galaxy ? 0 : (Math.random() - 0.5) * 0.12,
          vy: galaxy ? 0.015 + Math.random() * 0.02 : (Math.random() - 0.5) * 0.12,
          size: galaxy ? (Math.random() < 0.15 ? 2.2 : 1) : 1.4,
          twinkle: Math.random() * Math.PI * 2
        });
      }
    }
    function updateScatter() {
      var w = window.innerWidth, h = window.innerHeight;
      scatter.forEach(function (n) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
      });
    }
    function drawScatter(t) {
      /* scroll parallax only — cursor parallax is blobs-only, per spec */
      var galaxy = mode() === "galaxy";
      var offX = 0, offY = scrollY * 0.15;

      if (!lowPerf) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1;
        for (var a = 0; a < scatter.length; a++) {
          for (var b = a + 1; b < scatter.length; b++) {
            var dx = scatter[a].x - scatter[b].x, dy = scatter[a].y - scatter[b].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < SCATTER_CONNECT_DIST) {
              var base = galaxy ? 0.035 : 0.022;
              ctx.globalAlpha = base * (1 - dist / SCATTER_CONNECT_DIST) * moodMultiplier;
              ctx.beginPath();
              ctx.moveTo(scatter[a].x + offX, scatter[a].y + offY);
              ctx.lineTo(scatter[b].x + offX, scatter[b].y + offY);
              ctx.stroke();
            }
          }
        }
      }

      /* in dark theme, real white "stars" read correctly on the near-black
         galaxy backdrop; in light theme there's no dark backdrop (see
         drawFrame's isDarkTheme() check above), so white dots would nearly
         vanish — fall back to the accent color there, same as datasheet
         mode, to stay visible without needing a dark tint to work */
      ctx.fillStyle = galaxy && isDarkTheme() ? "#ffffff" : colors.accent;
      scatter.forEach(function (n, i) {
        var twinkle = galaxy ? 0.5 + 0.5 * Math.sin(t * 0.002 + n.twinkle) : 1;
        ctx.globalAlpha = (galaxy ? 0.28 : 0.032) * twinkle * (0.6 + signal * 0.4) * moodMultiplier;
        ctx.beginPath();
        ctx.arc(n.x + offX, n.y + offY, n.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    /* ============ LAYER 4a: synthetic training-loss curve (datasheet) === */
    var series = [];
    var POINT_COUNT = 140;
    var step = 0;
    function lossAt(x) {
      var base = 0.92 * Math.exp(-x / 55) + 0.06;
      var noise = (Math.sin(x * 0.37) * 0.5 + Math.sin(x * 1.13) * 0.5) * 0.05 * Math.exp(-x / 140);
      var jitter = (pseudoRandom(x) - 0.5) * 0.035;
      return Math.max(0.02, base + noise + jitter);
    }
    function pseudoRandom(seed) {
      var s = Math.sin(seed * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    }
    function buildSeries() {
      series = [];
      for (var i = 0; i < POINT_COUNT; i++) series.push(lossAt(i + step));
    }
    function drawLossCurve(w, h) {
      var bandTop = h * 0.58, bandH = h * 0.34;
      ctx.beginPath();
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.055 * moodMultiplier;
      ctx.lineWidth = 1.75;
      series.forEach(function (v, i) {
        var x = (i / (POINT_COUNT - 1)) * w;
        var y = bandTop + v * bandH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* ============ LAYER 4b: shooting star (galaxy) ====================== */
    var shootingStar = null;
    var nextShootAt = 0;
    function maybeSpawnShootingStar(t) {
      if (shootingStar || t < nextShootAt) return;
      var w = window.innerWidth, h = window.innerHeight;
      shootingStar = {
        x: Math.random() * w * 0.6,
        y: Math.random() * h * 0.4,
        vx: 5 + Math.random() * 3,
        vy: 2 + Math.random() * 1.5,
        life: 0,
        maxLife: 40
      };
    }
    function drawShootingStar() {
      if (!shootingStar) return;
      shootingStar.x += shootingStar.vx;
      shootingStar.y += shootingStar.vy;
      shootingStar.life++;
      var fade = 1 - shootingStar.life / shootingStar.maxLife;
      ctx.strokeStyle = isDarkTheme() ? "#ffffff" : colors.accent;
      ctx.globalAlpha = Math.max(0, (isDarkTheme() ? 0.5 : 0.3) * fade * moodMultiplier);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(shootingStar.x, shootingStar.y);
      ctx.lineTo(shootingStar.x - shootingStar.vx * 6, shootingStar.y - shootingStar.vy * 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (shootingStar.life >= shootingStar.maxLife) {
        shootingStar = null;
        nextShootAt = performance.now() + 4000 + Math.random() * 6000;
      }
    }

    /* ================= LAYER 5: grain (crossfading noise tiles) ========= */
    var grainTiles = [], grainPatterns = [];
    var grainMix = 0; /* 0..1 crossfade position */
    var grainDirection = 1;
    var lastGrainSwitch = 0;
    var GRAIN_TILE_SIZE = 64;
    function buildGrainTiles() {
      grainTiles = [makeGrainTile(), makeGrainTile()];
      grainPatterns = grainTiles.map(function (t) { return ctx.createPattern(t, "repeat"); });
    }
    function makeGrainTile() {
      var t = document.createElement("canvas");
      t.width = t.height = GRAIN_TILE_SIZE;
      var tctx = t.getContext("2d");
      var img = tctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 255;
      }
      tctx.putImageData(img, 0, 0);
      return t;
    }
    function drawGrain(w, h, ts) {
      if (!grainPatterns.length) return;
      if (!reduceMotion && ts - lastGrainSwitch > (4000 + Math.random() * 2000)) {
        lastGrainSwitch = ts;
        grainDirection *= -1;
      }
      if (!reduceMotion) {
        grainMix += grainDirection * 0.004;
        grainMix = Math.max(0, Math.min(1, grainMix));
      }
      ctx.globalAlpha = 0.025 * (1 - grainMix) * moodMultiplier;
      ctx.fillStyle = grainPatterns[0];
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.025 * grainMix * moodMultiplier;
      ctx.fillStyle = grainPatterns[1];
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    /* ================= composite ========================================= */
    function drawFrame(ts) {
      ts = ts || performance.now();
      var w = window.innerWidth, h = window.innerHeight;
      var galaxy = mode() === "galaxy";
      ctx.clearRect(0, 0, w, h);

      /* the "space" backdrop tint only makes contrast sense in dark theme —
         in light theme a translucent black layer would darken --bg toward
         the dark --text color and shrink contrast, so it's kept minimal
         there (checked against a WCAG AA re-run, see commit notes) */
      if (galaxy) {
        var dark = isDarkTheme();
        ctx.fillStyle = "#05050a";
        ctx.globalAlpha = (dark ? 0.35 : 0.05) * moodMultiplier;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      /* layer 1: grid — viewport-locked, no parallax, per spec */
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      var gridSize = 48;
      ctx.beginPath();
      for (var gx = 0; gx < w; gx += gridSize) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
      for (var gy = 0; gy < h; gy += gridSize) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
      ctx.stroke();

      var parX = pointerFine ? mouseNX * 18 : 0;
      var parY = pointerFine ? mouseNY * 18 : 0;

      drawBlobs(ts, parX, parY);
      drawScatter(ts);

      if (galaxy) {
        maybeSpawnShootingStar(ts);
        drawShootingStar();
      } else {
        drawLossCurve(w, h);
      }

      drawGrain(w, h, ts);
    }

    window.addEventListener("resize", resize);
    buildGrainTiles();
    resize();

    if (reduceMotion) return; /* single static frame, no rAF loop */

    var lastFrame = 0;
    var FRAME_INTERVAL = 1000 / 24; /* ~24fps cap */
    var running = !document.hidden;
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
    });

    function loop(ts) {
      requestAnimationFrame(loop);
      if (!running) return;
      if (ts - lastFrame < FRAME_INTERVAL) return;

      /* one-time FPS safety net: after ~2s, downgrade permanently if slow */
      if (!perfChecked) {
        if (perfStart === null) perfStart = ts;
        frameCount++;
        if (ts - perfStart > 2000) {
          var fps = frameCount / ((ts - perfStart) / 1000);
          perfChecked = true;
          if (fps < 24) {
            lowPerf = true;
            buildBlobs();
            buildScatter();
          }
        }
      }

      lastFrame = ts;
      step += 1;
      series.push(lossAt(POINT_COUNT + step));
      series.shift();
      updateBlobs();
      updateScatter();
      moodMultiplier += (moodTarget - moodMultiplier) * 0.06;
      drawFrame(ts);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
