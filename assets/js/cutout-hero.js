/* Floating rotating cutout hero photo: continuous slow Y-axis rotation +
   gentle vertical bob, with a cursor-driven tilt layered on top (desktop
   only). Freezes on a single flattering frame under prefers-reduced-motion.
   Uses GSAP if present; falls back to a CSS animation otherwise. */
(function () {
  "use strict";

  function init() {
    var wrap = document.querySelector("[data-cutout-photo]");
    var stage = document.querySelector("[data-cutout-stage]");
    var shadow = document.querySelector("[data-cutout-shadow]");
    if (!wrap || !stage) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var isTouch = window.matchMedia("(hover: none)").matches;

    if (reduceMotion) {
      wrap.style.transform = "rotateY(-18deg) rotateX(4deg)";
      return;
    }

    var tiltX = 0, tiltY = 0; /* cursor-driven offset */
    var idleRotation = 0;

    if (typeof gsap !== "undefined") {
      var tl = gsap.timeline({ repeat: -1, defaults: { ease: "sine.inOut" } });
      var driver = { r: 0 };
      tl.to(driver, {
        r: 360,
        duration: 16,
        ease: "none",
        onUpdate: function () { idleRotation = driver.r; }
      });

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
      /* CSS fallback: pure keyframe rotation + bob, no cursor tilt driver */
      wrap.style.animation = "cutout-spin 16s linear infinite";
      if (stage) stage.style.animation = "cutout-bob 3.2s ease-in-out infinite";
    }

    function render() {
      wrap.style.transform =
        "rotateY(" + (idleRotation + tiltY) + "deg) rotateX(" + tiltX + "deg)";
    }

    if (!isTouch) {
      stage.addEventListener("mousemove", function (e) {
        var rect = stage.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        tiltY = px * 22;
        tiltX = -py * 14;
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
