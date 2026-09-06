/* Floating cutout hero photo: a BOUNDED 3D tilt (not a full 360° spin) so
   the flat photo cutout never turns edge-on or reveals it has no "back."
   Two sine waves (different frequencies) drive an organic idle oscillation
   on Y and X, cursor-driven tilt adds on top, and the combined result is
   clamped to the same angle caps either way. Gentle vertical bob unchanged.
   The orbiting ring(s) behind the photo are flat abstract shapes with no
   "front" — those may keep spinning a full 360° via their own CSS. Freezes
   on a single near-zero-tilt frame under prefers-reduced-motion. Uses GSAP
   if present; falls back to a CSS animation otherwise. */
(function () {
  "use strict";

  /* bounded tilt caps — tune these two if it still looks off live */
  var MAX_Y = 15; /* deg, left/right turn cap */
  var MAX_X = 8;  /* deg, nod/tilt cap — tighter, vertical breaks the illusion faster */

  var IDLE_Y_HZ = 0.15; /* cycles/sec */
  var IDLE_X_HZ = 0.07;

  function clamp(v, max) {
    return Math.max(-max, Math.min(max, v));
  }

  function init() {
    var wrap = document.querySelector("[data-cutout-photo]");
    var stage = document.querySelector("[data-cutout-stage]");
    var shadow = document.querySelector("[data-cutout-shadow]");
    var glow = document.querySelector(".cutout-glow");
    if (!wrap || !stage) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var isTouch = window.matchMedia("(hover: none)").matches;

    if (reduceMotion) {
      /* single flattering near-zero-tilt frame, not mid-oscillation */
      wrap.style.transform = "rotateY(-6deg) rotateX(2deg)";
      return;
    }

    var tiltX = 0, tiltY = 0; /* cursor-driven offset, added to idle */
    var idleY = 0, idleX = 0;

    if (typeof gsap !== "undefined") {
      gsap.to(stage, {
        y: -10,
        duration: 3.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      if (shadow) {
        gsap.to(shadow, {
          scaleX: 0.85,
          opacity: 0.6,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }

      gsap.ticker.add(render);
    } else {
      /* CSS fallback: bounded back-and-forth keyframes, no cursor driver */
      wrap.style.animation = "cutout-tilt 7s ease-in-out infinite";
      if (stage) stage.style.animation = "cutout-bob 3.2s ease-in-out infinite";
    }

    function render(time) {
      /* gsap.ticker passes elapsed seconds as the first arg */
      var t = typeof time === "number" ? time : performance.now() / 1000;
      idleY = Math.sin(t * Math.PI * 2 * IDLE_Y_HZ) * MAX_Y;
      idleX = Math.sin(t * Math.PI * 2 * IDLE_X_HZ) * MAX_X;

      var finalY = clamp(idleY + tiltY, MAX_Y);
      var finalX = clamp(idleX + tiltX, MAX_X);

      wrap.style.transform = "rotateY(" + finalY + "deg) rotateX(" + finalX + "deg)";

      /* depth cues: shadow shifts opposite the tilt and softens slightly
         at the extremes; glow parallaxes a few px with the tilt, so the
         layers read as moving together in 3D rather than a flat wobble */
      var magnitude = (Math.abs(finalY) / MAX_Y + Math.abs(finalX) / MAX_X) / 2;
      if (shadow) {
        shadow.style.transform =
          "translateX(calc(-50% - " + (finalY * -0.6) + "px)) translateY(" + (finalX * 0.4) + "px)";
        shadow.style.filter = "blur(" + (4 + magnitude * 3) + "px)";
      }
      if (glow) {
        glow.style.transform = "translate(" + (finalY * -0.5) + "px, " + (finalX * 0.8) + "px)";
      }
    }

    if (!isTouch) {
      stage.addEventListener("mousemove", function (e) {
        var rect = stage.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        /* cursor nudges within the same caps, summed with idle and
           clamped in render() — it doesn't stack on top unbounded */
        tiltY = px * MAX_Y;
        tiltX = -py * MAX_X;
      });
      stage.addEventListener("mouseleave", function () {
        tiltX = 0;
        tiltY = 0;
      });
    }

    /* pause the (cheap, transform-only) render loop off-screen too */
    if ("IntersectionObserver" in window && typeof gsap !== "undefined") {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) gsap.ticker.add(render);
          else gsap.ticker.remove(render);
        });
      });
      io.observe(stage);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
