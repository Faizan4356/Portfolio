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

    function run(el) {
      var target = parseFloat(el.getAttribute("data-countup"));
      var decimals = (el.getAttribute("data-countup").split(".")[1] || "").length;
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduce) {
        el.textContent = target.toFixed(decimals) + suffix;
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

  /* ---------- filter buttons (projects index) ---------- */
  function initFilters() {
    var bar = document.querySelector("[data-filters]");
    if (!bar) return;
    var buttons = bar.querySelectorAll(".filter-btn");
    var cards = document.querySelectorAll("[data-tech]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        var tech = btn.getAttribute("data-filter");
        cards.forEach(function (card) {
          var list = card.getAttribute("data-tech").split(",");
          var show = tech === "all" || list.indexOf(tech) !== -1;
          card.hidden = !show;
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initNav();
    initSignalLine();
    initReveal();
    initCountUp();
    initMagnetic();
    initTilt();
    initTerminal();
    initFilters();
  });
})();
