/* Second 3D moment: a small Three.js 3D bar chart of key project metrics
   (AUC 0.839, RMSE improvement, shipped projects, job simulations).
   Paused off-screen, capped DPR, reuses --accent, no-op if Three fails. */
(function () {
  "use strict";

  function readAccent() {
    var val = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return val || "#d97706";
  }
  function readMuted() {
    var val = getComputedStyle(document.documentElement).getPropertyValue("--border-strong").trim();
    return val || "#888888";
  }

  function init() {
    var canvas = document.querySelector("[data-stats3d-canvas]");
    if (!canvas) return;
    if (typeof THREE === "undefined") {
      canvas.closest(".stats3d-canvas") && canvas.closest(".stats3d-canvas").remove();
      return;
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      canvas.remove();
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(4.2, 3.2, 5.2);
    camera.lookAt(0, 0.6, 0);

    var accent = new THREE.Color(readAccent());
    var light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(3, 5, 4);
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

    var metrics = [
      { label: "AUC", value: 0.839, max: 1 },
      { label: "SmokeGuard mAP", value: 0.91, max: 1 },
      { label: "Projects", value: 8, max: 10 },
      { label: "Simulations", value: 4, max: 10 },
      { label: "RMSE win %", value: 0.22, max: 1 }
    ];

    var group = new THREE.Group();
    var bars = [];
    var spacing = 1.1;
    metrics.forEach(function (m, i) {
      var h = Math.max(0.15, (m.value / m.max) * 3);
      var geo = new THREE.BoxGeometry(0.6, 1, 0.6);
      var mat = new THREE.MeshStandardMaterial({ color: accent, transparent: true, opacity: 0.88 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = (i - (metrics.length - 1) / 2) * spacing;
      mesh.scale.y = 0.001;
      mesh.userData.targetH = h;
      group.add(mesh);
      bars.push(mesh);
    });
    scene.add(group);

    var gridHelper = new THREE.GridHelper(6, 12, new THREE.Color(readMuted()), new THREE.Color(readMuted()));
    scene.add(gridHelper);

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("themechange", function () {
      var c = new THREE.Color(readAccent());
      bars.forEach(function (b) { b.material.color = c; });
    });

    var running = true;
    var grown = false;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          running = entry.isIntersecting;
          if (entry.isIntersecting) grown = true;
        });
      }, { threshold: 0.3 });
      io.observe(canvas);
    } else {
      grown = true;
    }

    var clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (!running) return;
      var delta = clock.getDelta();
      bars.forEach(function (b) {
        var target = grown ? b.userData.targetH : 0.001;
        b.scale.y += (target - b.scale.y) * (reduceMotion ? 1 : delta * 4);
        b.position.y = b.scale.y / 2;
      });
      if (!reduceMotion) group.rotation.y += delta * 0.12;
      renderer.render(scene, camera);
    }
    animate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
