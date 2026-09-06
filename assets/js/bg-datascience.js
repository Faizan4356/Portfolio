/* Site-wide ambient background: OPTION B, a live "training-loss curve",
   layered with a sparse drifting node-network (a 2D-canvas, far-back-
   pushed cousin of the hero's WebGL node sphere in hero3d.js — same
   connect-nearby-points idea, reimplemented here in plain Canvas 2D since
   this must run cheaply on every page, not just the hero).
   A single fixed full-viewport canvas (z-index -1, pointer-events: none)
   shared across the whole scroll. Draws a continuously-scrolling loss
   curve — exponential decay + realistic noise — styled as quiet lab-
   notebook texture at very low opacity, never a focal point. The node
   layer sits at an even lower opacity than the loss curve, so it reads as
   secondary texture, not a second focal element.

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
      buildNodes();
      drawFrame();
    }

    /* ---- sparse drifting node-network: a second, sparser motif layered
       on top of the loss curve so the background reads as a fuller "lab
       notebook" rather than a single line. Points drift slowly and wrap
       at the viewport edges; nearby points get a faint connecting line,
       same idea as hero3d.js's connection-distance logic, kept lightweight
       and 2D since it runs on every page. ------------------------------ */
    var nodes = [];
    var NODE_CONNECT_DIST = 130;
    function buildNodes() {
      var count = window.innerWidth < 700 ? 15 : 36;
      var w = window.innerWidth, h = window.innerHeight;
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12
        });
      }
    }
    function updateNodes() {
      var w = window.innerWidth, h = window.innerHeight;
      nodes.forEach(function (n) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
      });
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
      updateNodes();
    }
    buildSeries();
    buildNodes();

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

      /* sparse node-network layer, deliberately fainter than the loss
         curve above (0.05/0.035 vs the curve's 0.09) so it stays texture */
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < NODE_CONNECT_DIST) {
            ctx.globalAlpha = 0.035 * (1 - dist / NODE_CONNECT_DIST);
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = colors.accent;
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
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
