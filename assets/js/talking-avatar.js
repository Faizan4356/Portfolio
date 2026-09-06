/* Audio-reactive "talking" effect for the hero cutout — amplitude-reactive,
   NOT true lip-sync (no model, no third-party API, fully client-side).

   FEATURE-DETECTED: if assets/audio/intro.mp3 doesn't exist, this silently
   does nothing — no button is rendered, no broken control. To activate:
     1. Add a short (5-10s) voice clip at assets/audio/intro.mp3.
     2. Edit CAPTION_TEXT below to match what's actually said.
     3. Open the site, open devtools, and tune --mouth-left/--mouth-top on
        .cutout-mouth (in styles.css) against your actual cutout photo —
        those are a placeholder guess, not measured from the real image.

   Mechanism: Web Audio AnalyserNode reads real-time amplitude from the
   <audio> element as it plays; that amplitude drives (a) a CSS-masked
   ellipse "mouth" overlay's scale/opacity, and (b) a small extra head-tilt
   offset fed into cutout-hero.js via the "avatar:amplitude" CustomEvent
   (cutout-hero.js adds it to its own clamped rotation, so caps are never
   exceeded). Captions reveal word-by-word on a simple time-based split. */
(function () {
  "use strict";

  var AUDIO_SRC = "assets/audio/intro.mp3";
  var CAPTION_TEXT = "Hi, I'm Faizan — I build ML systems that ship.";

  function checkAssetExists(url, cb) {
    fetch(url, { method: "HEAD" })
      .then(function (r) { cb(r.ok); })
      .catch(function () { cb(false); });
  }

  function init() {
    var stage = document.querySelector("[data-cutout-stage]");
    if (!stage) return;

    checkAssetExists(AUDIO_SRC, function (exists) {
      if (!exists) return; /* no asset yet — render nothing, per spec */
      build(stage);
    });
  }

  function build(stage) {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var audio = new Audio(AUDIO_SRC);
    audio.preload = "none";

    var mouth = document.createElement("div");
    mouth.className = "cutout-mouth";
    mouth.setAttribute("aria-hidden", "true");
    stage.appendChild(mouth);

    var btn = document.createElement("button");
    btn.className = "btn btn--ghost avatar-play-btn mono";
    btn.type = "button";
    btn.setAttribute("aria-label", "Play voice introduction");
    btn.innerHTML = '<span class="avatar-play-icon" aria-hidden="true">&#9654;</span> Play intro';
    stage.parentNode.insertBefore(btn, stage.nextSibling);

    var captions = document.createElement("p");
    captions.className = "avatar-captions mono center";
    captions.hidden = true;
    stage.parentNode.insertBefore(captions, btn.nextSibling);
    var words = CAPTION_TEXT.split(" ");

    var audioCtx, analyser, source, dataArray;
    function setupAnalyser() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    }

    var playing = false;
    var rafId = null;

    function tick() {
      if (!playing) return;
      rafId = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(dataArray);
      var sum = 0;
      for (var i = 0; i < dataArray.length; i++) sum += dataArray[i];
      var amplitude = sum / dataArray.length / 255; /* 0..1 */

      mouth.style.opacity = String(0.25 + amplitude * 0.6);
      mouth.style.transform = "translate(-50%, -50%) scaleY(" + (1 + amplitude * 2.6) + ")";

      if (!reduceMotion) {
        window.dispatchEvent(new CustomEvent("avatar:amplitude", { detail: { value: amplitude } }));
      }

      if (!captions.hidden && audio.duration) {
        var wordIndex = Math.min(words.length, Math.ceil((audio.currentTime / audio.duration) * words.length));
        captions.textContent = words.slice(0, wordIndex).join(" ");
      }
    }

    function stopVisuals() {
      playing = false;
      if (rafId) cancelAnimationFrame(rafId);
      mouth.style.opacity = "0";
      mouth.style.transform = "translate(-50%, -50%) scaleY(1)";
      window.dispatchEvent(new CustomEvent("avatar:amplitude", { detail: { value: 0 } }));
    }

    btn.addEventListener("click", function () {
      if (playing) {
        audio.pause();
        return;
      }
      setupAnalyser();
      if (audioCtx.state === "suspended") audioCtx.resume();
      captions.hidden = false;
      captions.textContent = "";
      audio.currentTime = 0;
      audio.play();
    });

    var icon = btn.querySelector(".avatar-play-icon");
    var label = btn.childNodes[btn.childNodes.length - 1];

    audio.addEventListener("play", function () {
      playing = true;
      btn.classList.add("is-playing");
      btn.setAttribute("aria-label", "Pause voice introduction");
      icon.innerHTML = "&#10074;&#10074;";
      if (label) label.textContent = " Pause intro";
      tick();
    });
    audio.addEventListener("pause", function () {
      btn.classList.remove("is-playing");
      btn.setAttribute("aria-label", "Play voice introduction");
      icon.innerHTML = "&#9654;";
      if (label) label.textContent = " Play intro";
      stopVisuals();
    });
    audio.addEventListener("ended", function () {
      btn.classList.remove("is-playing");
      btn.setAttribute("aria-label", "Play voice introduction");
      icon.innerHTML = "&#9654;";
      if (label) label.textContent = " Play intro";
      stopVisuals();
      captions.hidden = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
