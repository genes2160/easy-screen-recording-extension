// ============================
// content.js (single file)
// ============================

(() => {
  if (window.__screenRecorderInjected) return;
  window.__screenRecorderInjected = true;

  // -------------------------
  // Tiny UI: draggable button + panel
  // -------------------------
  const STYLE = `
  #qsr-widget {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 2147483647;
    font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;
  }
  #qsr-toggle {
    width: 42px; height: 42px;
    border: none; border-radius: 999px;
    background:#111; color:#fff; cursor:pointer;
    box-shadow: 0 4px 18px rgba(0,0,0,.3);
    display:flex; align-items:center; justify-content:center;
    font-size: 18px; user-select:none;
  }
  #qsr-toggle.dragging { cursor: move; }
  #qsr-panel {
    position: fixed;
    min-width: 260px;
    padding: 12px;
    background: #111;
    color: #eee;
    border-radius: 10px;
    box-shadow: 0 12px 30px rgba(0,0,0,.35);
    display: none;
  }
  #qsr-panel.open { display:block; }
  #qsr-panel h4 { margin:0 0 8px; font-size: 14px; letter-spacing:.2px; }
  #qsr-panel .row { display:flex; gap:8px; margin:8px 0; align-items:center; }
  #qsr-panel label { font-size: 12px; opacity:.85; }
  #qsr-panel input[type="number"] {
    width: 90px; padding:6px 8px; border-radius:6px; border:1px solid #333; background:#181818; color:#eee;
  }
  #qsr-panel input[type="checkbox"] { transform: translateY(1px); }
  #qsr-panel .btn {
    flex:1;
    padding:8px 10px; border-radius:8px; border:1px solid #444; background:#1f2937; color:#eee; cursor:pointer;
  }
  #qsr-panel .btn.primary { background:#2563eb; border-color:#2563eb; }
  #qsr-panel .btn.danger { background:#b91c1c; border-color:#b91c1c; }
  #qsr-note { font-size:11px; opacity:.7; margin-top:6px; }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  document.documentElement.appendChild(styleEl);

  const wrap = document.createElement("div");
  wrap.id = "qsr-widget";
  wrap.innerHTML = `
    <button id="qsr-toggle" title="Screen Recorder">⏺</button>
    <div id="qsr-panel" role="dialog" aria-label="Screen Recorder">
      <h4>Quick Screen Recorder</h4>

      <div class="row">
        <label for="qsr-secs">Duration (s)</label>
        <input id="qsr-secs" type="number" min="1" step="1" value="10" />
      </div>

      <div class="row">
        <label><input id="qsr-zoom-on" type="checkbox" /> Zoom</label>
        <label>From <input id="qsr-zs" type="number" min="1" step="0.1" value="1" style="width:56px"/></label>
        <label>To <input id="qsr-ze" type="number" min="1" step="0.1" value="1.4" style="width:56px"/></label>
      </div>

      <div class="row">
        <label>FPS <input id="qsr-fps" type="number" min="10" max="60" step="1" value="30" style="width:56px"/></label>
        <label>FocusX <input id="qsr-fx" type="number" min="0" max="1" step="0.01" value="0.5" style="width:60px"/></label>
        <label>FocusY <input id="qsr-fy" type="number" min="0" max="1" step="0.01" value="0.5" style="width:60px"/></label>
      </div>

      <div class="row">
        <button id="qsr-start" class="btn primary">Start</button>
        <button id="qsr-stop" class="btn danger" disabled>Stop</button>
      </div>

      <div id="qsr-note">Tip: You can move the round button. Position persists per site.</div>
    </div>
  `;
  document.body.appendChild(wrap);

  const $ = (sel) => wrap.querySelector(sel);
  const $toggle = $("#qsr-toggle");
  const $panel = $("#qsr-panel");
  const $secs = $("#qsr-secs");
  const $zoomOn = $("#qsr-zoom-on");
  const $zs = $("#qsr-zs");
  const $ze = $("#qsr-ze");
  const $fps = $("#qsr-fps");
  const $fx = $("#qsr-fx");
  const $fy = $("#qsr-fy");
  const $start = $("#qsr-start");
  const $stop = $("#qsr-stop");

  // Position persistence
  const domainKey = `qsr-pos-${location.hostname}`;
  chrome?.storage?.local?.get?.([domainKey], (res) => {
    const p = res?.[domainKey];
    if (p && typeof p.left === "number" && typeof p.top === "number") {
      wrap.style.left = `${p.left}px`;
      wrap.style.top = `${p.top}px`;
    } else {
      wrap.style.left = "20px";
      wrap.style.top = "20px";
    }
  });

  const savePos = () => {
    const rect = wrap.getBoundingClientRect();
    chrome?.storage?.local?.set?.({
      [domainKey]: { left: rect.left, top: rect.top },
    });
  };

  // Drag for the round button
  (() => {
    let down = false,
      sx = 0,
      sy = 0,
      sl = 0,
      st = 0,
      moved = false;

    $toggle.addEventListener("mousedown", (e) => {
      down = true;
      moved = false;
      $toggle.classList.add("dragging");
      const r = wrap.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      sl = r.left;
      st = r.top;

      const mm = (ev) => {
        if (!down) return;
        const dx = ev.clientX - sx,
          dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        let nl = sl + dx,
          nt = st + dy;
        const maxX = window.innerWidth - wrap.offsetWidth;
        const maxY = window.innerHeight - wrap.offsetHeight;
        nl = Math.max(0, Math.min(maxX, nl));
        nt = Math.max(0, Math.min(maxY, nt));
        wrap.style.left = `${nl}px`;
        wrap.style.top = `${nt}px`;
      };
      const mu = () => {
        down = false;
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
        $toggle.classList.remove("dragging");
        if (moved) savePos();
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    });

    $toggle.addEventListener("click", (e) => {
      if (e.detail === 0) return; // keyboard?
      if ($toggle.classList.contains("dragging")) return;
      // If just dragged, ignore click toggling.
      if (document.activeElement === $toggle && moved) return;
      togglePanel();
    });
  })();

  const togglePanel = () => {
    if ($panel.classList.contains("open")) {
      $panel.classList.remove("open");
    } else {
      // place near the button (to the right)
      const br = $toggle.getBoundingClientRect();
      $panel.style.left = `${br.right + 10}px`;
      $panel.style.top = `${br.top}px`;
      $panel.classList.add("open");
    }
  };

  // -------------------------
  // Recorder plumbing
  // -------------------------
  let stopFn = null;

  $start.addEventListener("click", async () => {
    try {
      //apply default seconds if the input is empty or invalid
      if ($secs.value === "" || isNaN($secs.value) || +$secs.value <= 0) {
        $secs.value = 300;
      }
      const secs = Math.max(1, +$secs.value || 10);
      const useZoom = $zoomOn.checked;
      const fps = Math.max(10, Math.min(60, +$fps.value || 30));

      $start.disabled = true;
      $stop.disabled = false;
      $toggle.textContent = "●";

      const zoom = useZoom
        ? {
            start: Math.max(1, +$zs.value || 1),
            end: Math.max(1, +$ze.value || 1.4),
            duration: Math.min(secs * 1000, 60000), // cap zoom anim to 60s
            fps,
            focus: {
              x: Math.max(0, Math.min(1, +$fx.value || 0.5)),
              y: Math.max(0, Math.min(1, +$fy.value || 0.5)),
            },
          }
        : null;

      document.getElementById("qsr-widget").style.display = "none";
      stopFn = await recordScreen(10, secs * 1000, zoom);
      //hide the button till the timeout is over.....
      setTimeout(() => {
        document.getElementById("qsr-widget").style.display = "block";
      }, secs * 1000);
    } catch (err) {
      // console.error(err);
      // alert("Failed to start recording. Check console.");
      console.log("Failed to start recording. Check console.", error);
      document.getElementById("qsr-widget").style.display = "block";
      $start.disabled = false;
      $stop.disabled = true;
      $toggle.textContent = "⏺";
    }
  });

  $stop.addEventListener("click", () => {
    if (stopFn) stopFn();
  });

  // Provide a small hook the recorder can call when it fully stops
  window.__qsr_reset = function () {
    $start.disabled = false;
    $stop.disabled = true;
    $toggle.textContent = "⏺";
  };

  // -------------------------
  // Robust recordScreen impl
  // -------------------------
  async function recordScreen(countdown, durationMs = null, zoom = null) {
    let mediaRecorder;
    let recordedChunks = [];

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    try {
      // 1) Ask the user what to capture
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      //have an overlay countdown on the screen
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "50%";
      overlay.style.left = "50%";
      overlay.style.transform = "translate(-50%, -50%)";
      overlay.style.background = "rgba(0, 0, 0, 0.7)";
      overlay.style.color = "#fff";
      overlay.style.padding = "20px 40px";
      overlay.style.fontSize = "48px";
      overlay.style.borderRadius = "10px";
      overlay.style.zIndex = "2147483647";
      overlay.style.fontFamily = "Arial, sans-serif";
      overlay.textContent = `Starting in ${countdown}s`;
      document.body.appendChild(overlay);
      let overlayCountdown = countdown;
      const overlayInterval = setInterval(() => {
        overlayCountdown -= 1;
        if (overlayCountdown > 0) {
          overlay.textContent = overlayCountdown;
        } else {
          clearInterval(overlayInterval);
          document.body.removeChild(overlay);
        }
      }, 1000);
      await new Promise((res) => setTimeout(res, countdown * 1000));
      if (overlay.parentNode) {
        clearInterval(overlayInterval);
        document.body.removeChild(overlay);
      }
      // If no zoom required, do direct record of the display stream
      if (!zoom) {
        const mime = pickMime();
        const directRecorder = new MediaRecorder(displayStream, {
          mimeType: mime,
        });
        directRecorder.ondataavailable = (e) =>
          e.data.size && recordedChunks.push(e.data);
        directRecorder.onstop = () =>
          finalize(downloadBlob(recordedChunks, "webm"), displayStream);

        // small warm-up to ensure first chunk has frames
        await waitForFirstFrame(displayStream);

        directRecorder.start();
        if (durationMs)
          setTimeout(
            () => directRecorder.state === "recording" && directRecorder.stop(),
            durationMs
          );
        displayStream.getVideoTracks()[0].onended = () =>
          directRecorder.state === "recording" && directRecorder.stop();

        return () => {
          if (directRecorder.state === "recording") directRecorder.stop();
        };
      }

      // 2) Zoom path: draw to canvas (background-safe)
      const settings = displayStream.getVideoTracks()[0].getSettings();
      const vw = settings.width || 1280;
      const vh = settings.height || 720;

      const videoEl = document.createElement("video");
      videoEl.srcObject = displayStream;
      videoEl.muted = true;
      videoEl.playsInline = true;

      await new Promise((resolve) => {
        const done = () => resolve();
        videoEl.addEventListener("loadedmetadata", done, { once: true });
        setTimeout(done, 1000); // safety
      });
      await videoEl.play();
      await new Promise((resolve) => {
        if (!videoEl.paused && videoEl.readyState >= 2) return resolve();
        videoEl.addEventListener("playing", () => resolve(), { once: true });
      });

      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");

      const {
        start = 1,
        end = 1.5,
        duration = 3000,
        fps = 30,
        focus = { x: 0.5, y: 0.5 },
      } = zoom;

      const frameInterval = Math.max(15, Math.floor(1000 / fps));
      const startMs = performance.now();

      const drawOnce = (nowMs) => {
        // fill background to avoid transparent first frames
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, vw, vh);

        const tNorm = clamp((nowMs - startMs) / duration, 0, 1);
        const ease =
          tNorm < 0.5 ? 2 * tNorm * tNorm : -1 + (4 - 2 * tNorm) * tNorm;
        const z = start + (end - start) * ease;

        const sW = videoEl.videoWidth || vw;
        const sH = videoEl.videoHeight || vh;

        const srcW = vw / z;
        const srcH = vh / z;
        const fx = clamp(focus.x, 0, 1) * vw;
        const fy = clamp(focus.y, 0, 1) * vh;
        const srcX = clamp(fx - srcW / 2, 0, vw - srcW);
        const srcY = clamp(fy - srcH / 2, 0, vh - srcH);

        const scaleX = sW / vw;
        const scaleY = sH / vh;

        ctx.drawImage(
          videoEl,
          srcX * scaleX,
          srcY * scaleY,
          srcW * scaleX,
          srcH * scaleY,
          0,
          0,
          vw,
          vh
        );
      };

      // warm-up draw before recording
      drawOnce(performance.now());
      const drawTimer = setInterval(
        () => drawOnce(performance.now()),
        frameInterval
      );

      // capture canvas and add audio
      const canvasStream = canvas.captureStream(fps);
      displayStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

      const mime = pickMime();
      mediaRecorder = new MediaRecorder(canvasStream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) =>
        e.data.size && recordedChunks.push(e.data);
      mediaRecorder.onstop = () => {
        clearInterval(drawTimer);
        const url = downloadBlob(recordedChunks, "webm");
        finalize(url, displayStream, canvasStream);
        if (typeof window.__qsr_reset === "function")
          setTimeout(() => window.__qsr_reset(), 0);
      };

      mediaRecorder.start();
      if (durationMs)
        setTimeout(
          () => mediaRecorder.state === "recording" && mediaRecorder.stop(),
          durationMs
        );
      displayStream.getVideoTracks()[0].onended = () =>
        mediaRecorder.state === "recording" && mediaRecorder.stop();

      return () => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
      };
    } catch (err) {
      console.error("recordScreen error:", err);
      throw err;
    }

    // ---- helpers ----
    function pickMime() {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9"))
        return "video/webm;codecs=vp9";
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8"))
        return "video/webm;codecs=vp8";
      return "video/webm";
    }

    function waitForFirstFrame(stream) {
      return new Promise((resolve) => {
        const track = stream.getVideoTracks()[0];
        if (!track) return resolve();
        // Heuristic: give the track one rAF tick to deliver a frame
        requestAnimationFrame(() => resolve());
      });
    }

    function downloadBlob(chunks, ext = "webm") {
      const blob = new Blob(chunks, { type: `video/${ext}` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eugene-extension-screen-recording-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return url;
    }

    function finalize(objUrl, ...streams) {
      setTimeout(() => URL.revokeObjectURL(objUrl), 0);
      streams.forEach((s) => s?.getTracks?.().forEach((tr) => tr.stop()));
    }
  }
})();
