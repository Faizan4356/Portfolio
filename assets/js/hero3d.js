/* Three.js hero background: a rotating node-network sphere.
   Loaded only on pages with a [data-hero-canvas] element. Reuses the live
   --accent CSS variable, caps devicePixelRatio, pauses off-screen, and
   degrades gracefully if WebGL/Three fails to init or reduced-motion is set. */
(function () {
  "use strict";

  function readAccent() {
    var val = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return val || "#d97706";
  }

  function hexToThreeColor(hex) {
    return new THREE.Color(hex);
  }

  function init() {
    var canvas = document.querySelector("[data-hero-canvas]");
    if (!canvas) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof THREE === "undefined") {
      document.documentElement.classList.add("no-webgl");
      return;
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      document.documentElement.classList.add("no-webgl");
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.z = 6.5;

    var group = new THREE.Group();
    scene.add(group);

    var NODE_COUNT = 90;
    var radius = 3.1;
    var points = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      var phi = Math.acos(-1 + (2 * i) / NODE_COUNT);
      var theta = Math.sqrt(NODE_COUNT * Math.PI) * phi;
      var x = radius * Math.cos(theta) * Math.sin(phi);
      var y = radius * Math.sin(theta) * Math.sin(phi);
      var z = radius * Math.cos(phi);
      points.push(new THREE.Vector3(x, y, z));
    }

    var accentColor = hexToThreeColor(readAccent());

    var nodeGeo = new THREE.BufferGeometry().setFromPoints(points);
    var nodeMat = new THREE.PointsMaterial({ color: accentColor, size: 0.06, transparent: true, opacity: 0.85 });
    var nodes = new THREE.Points(nodeGeo, nodeMat);
    group.add(nodes);

    /* "signal" node layer: a subset of points that fade in/out based on
       live GitHub activity recency (see assets/js/github.js gh:signal
       event), so node density visually pulses with something real rather
       than being purely decorative. */
    var signalIdx = [];
    for (var s = 0; s < points.length; s += 4) signalIdx.push(s);
    var signalPositions = [];
    signalIdx.forEach(function (idx) {
      signalPositions.push(points[idx].x, points[idx].y, points[idx].z);
    });
    var signalGeo = new THREE.BufferGeometry();
    signalGeo.setAttribute("position", new THREE.Float32BufferAttribute(signalPositions, 3));
    var signalMat = new THREE.PointsMaterial({ color: accentColor, size: 0.12, transparent: true, opacity: 0 });
    var signalNodes = new THREE.Points(signalGeo, signalMat);
    group.add(signalNodes);

    var signalValue = 0.5;
    window.addEventListener("gh:signal", function (e) {
      signalValue = e.detail && typeof e.detail.value === "number" ? e.detail.value : 0.5;
    });

    var linePositions = [];
    var LINK_DIST = 1.5;
    for (var a = 0; a < points.length; a++) {
      for (var b = a + 1; b < points.length; b++) {
        if (points[a].distanceTo(points[b]) < LINK_DIST) {
          linePositions.push(points[a].x, points[a].y, points[a].z);
          linePositions.push(points[b].x, points[b].y, points[b].z);
        }
      }
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    var lineMat = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.18 });
    var lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

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
      var c = hexToThreeColor(readAccent());
      nodeMat.color = c;
      lineMat.color = c;
      signalMat.color = c;
    });

    var running = true;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { running = entry.isIntersecting; });
      });
      io.observe(canvas);
    }

    var mouseX = 0, mouseY = 0;
    window.addEventListener("mousemove", function (e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    var clock = new THREE.Clock();
    var elapsed = 0;
    function animate() {
      requestAnimationFrame(animate);
      if (!running) return;
      var delta = reduceMotion ? 0.15 : clock.getDelta();
      elapsed += delta;
      group.rotation.y += delta * (reduceMotion ? 0.02 : 0.08);
      group.rotation.x += delta * 0.015;
      group.rotation.y += (mouseX * 0.15 - group.rotation.y) * 0.002;

      /* pulse the signal-node layer opacity + base node size in time with
         the live activity signal, so the sphere reads as alive */
      var pulse = 0.5 + 0.5 * Math.sin(elapsed * (0.6 + signalValue * 0.9));
      signalMat.opacity = reduceMotion ? signalValue * 0.5 : signalValue * 0.7 * pulse;
      nodeMat.size = 0.06 + signalValue * 0.02 * pulse;

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
