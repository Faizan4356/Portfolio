/* Site-wide ambient background: OPTION B, a live "training-loss curve".
   A single fixed full-viewport canvas (z-index -1, pointer-events: none)
   shared across the whole scroll. Draws a continuously-scrolling loss
   curve — exponential decay + realistic noise — styled as quiet lab-
   notebook texture at very low opacity, never a focal point.

   Throttled to ~24fps, paused when the tab is hidden, and frozen to a
   single static frame under prefers-reduced-motion. Colors are re-read
   from --accent/--border/--grid-line on init and on themechange, so it
   re-tints with the toggle. Injects its own <canvas> — just include this
   script once per page, no markup needed.

   TO SWAP TO A DIFFERENT OPTION LATER: replace the body of `draw()` below
   (and the `pushPoint()` data generator) with a different renderer — the
   canvas lifecycle (resize, visibility pause, reduced-motion freeze,
   theme re-tint) stays the same regardless of what's drawn inside it.
*/
(function () {
  "use strict";

  function init() {
    var canvas = document.createElement("canvas");
    canvas.className = "bg-ds-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext("2d");

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    var colors = { accent: "#d97706", grid: "rgba(0,0,0,0.06)" };
    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      colors.accent = cs.getPropertyValue("--accent").trim() || colors.accent;
      colors.grid = cs.getPropertyValue("--grid-line").trim() || colors.grid;
    }
    readColors();
    document.addEventListener("themechange", function () {
      readColors();
      if (reduceMotion) drawFrame();
    });

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildSeries();
      drawFrame();
    }

    /* ---- synthetic training-loss series: exponential decay + noise, a
       rolling window that scrolls left as new points are appended ------ */
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
    function advance() {
      step += 1;
      series.push(lossAt(POINT_COUNT + step));
      series.shift();
    }
    buildSeries();

    function drawFrame() {
      var w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      /* faint graph-paper grid, matching the site's existing texture */
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      var gridSize = 48;
      ctx.beginPath();
      for (var gx = 0; gx < w; gx += gridSize) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
      for (var gy = 0; gy < h; gy += gridSize) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
      ctx.stroke();

      /* the loss curve itself: bottom-anchored, low band of the viewport,
         low opacity so text always stays at full contrast on top */
      var bandTop = h * 0.58;
      var bandH = h * 0.34;
      ctx.beginPath();
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.09;
      ctx.lineWidth = 1.75;
      series.forEach(function (v, i) {
        var x = (i / (POINT_COUNT - 1)) * w;
        var y = bandTop + v * bandH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    window.addEventListener("resize", resize);
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
      lastFrame = ts;
      advance();
      drawFrame();
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
