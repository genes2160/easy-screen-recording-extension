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
    // Robust recordScreen impl (with full audio capture)
    // -------------------------
    async function recordScreen(countdown, durationMs = null, zoom = null) {
      let mediaRecorder;
      let recordedChunks = [];

      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

      try {
        // 1️⃣ Ask the user what to capture (with system/tab audio)
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 30,
            displaySurface: "browser",
            surfaceSwitching: "include",
            selfBrowserSurface: "include",
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 44100,
          },
        });

        // 2️⃣ Capture mic separately
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });

        // 3️⃣ Detect duplicate mic in system audio
        const micTrack = micStream.getAudioTracks()[0];
        const systemTracks = displayStream.getAudioTracks();
        const systemTrack = systemTracks.length > 0 ? systemTracks[0] : null;

        let micInSystem = false;
        if (systemTrack) {
          const sys = systemTrack.getSettings();
          const mic = micTrack.getSettings();
          if (sys.deviceId && mic.deviceId && sys.deviceId === mic.deviceId)
            micInSystem = true;
          console.log("🎧 System audio settings:", sys);
        }
        console.log(micInSystem ? "⚠️ Mic already in system audio" : "✅ Mic separate");

        // 4️⃣ Mix with AudioContext
        const audioCtx = new AudioContext();
        const destination = audioCtx.createMediaStreamDestination();

        const sysSource =
          systemTrack && systemTracks.length > 0
            ? audioCtx.createMediaStreamSource(displayStream)
            : null;
        const micSource = audioCtx.createMediaStreamSource(micStream);

        const sysGain = audioCtx.createGain();
        const micGain = audioCtx.createGain();
        sysGain.gain.value = 1.0;
        micGain.gain.value = 1.0;

        if (sysSource) sysSource.connect(sysGain).connect(destination);
        if (!micInSystem) micSource.connect(micGain).connect(destination);

        // 5️⃣ Combine video + mixed audio
        const finalStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);

        console.log("🎬 Final mixed stream tracks:");
        finalStream.getAudioTracks().forEach((t) =>
          console.log("Audio track:", t.label, t.getSettings())
        );

        // ===== Countdown overlay =====
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position:fixed;top:50%;left:50%;
          transform:translate(-50%,-50%);
          background:rgba(0,0,0,0.7);color:#fff;
          padding:20px 40px;font-size:48px;border-radius:10px;
          z-index:2147483647;font-family:Arial,sans-serif;`;
        overlay.textContent = `Starting in ${countdown}s`;
        document.body.appendChild(overlay);

        let overlayCountdown = countdown;
        const overlayInterval = setInterval(() => {
          overlayCountdown -= 1;
          if (overlayCountdown > 0) {
            overlay.textContent = overlayCountdown;
          } else {
            clearInterval(overlayInterval);
            overlay.remove();
          }
        }, 1000);
        await new Promise((r) => setTimeout(r, countdown * 1000));
        if (overlay.parentNode) {
          clearInterval(overlayInterval);
          overlay.remove();
        }

        // ============ Recording logic ============
        const mime = pickMime();
        mediaRecorder = new MediaRecorder(finalStream, {
          mimeType: mime,
          audioBitsPerSecond: 128000,
        });

        mediaRecorder.ondataavailable = (e) =>
          e.data.size && recordedChunks.push(e.data);
        mediaRecorder.onstop = () => {
          finalize(downloadBlob(recordedChunks, "webm"), finalStream);
          $start.disabled = false;
          $stop.disabled = true;
          $toggle.textContent = "⏺";
          console.log("✅ Recording stopped, UI reset.");
          if (typeof window.__qsr_reset === "function")
            setTimeout(() => window.__qsr_reset(), 0);
        }

        // optional warm-up
        await waitForFirstFrame(finalStream);

        mediaRecorder.start();
        if (durationMs) {
            setTimeout(() => {
              if (mediaRecorder.state === "recording") {
                console.log("⏹️ Duration reached — stopping recording");
                mediaRecorder.stop();
              }
            }, durationMs);
        }

        // 🟥 Handle manual user stop (video track end)
        finalStream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state === "recording") {
            console.log("🎞️ Video stream ended — stopping recording");
            mediaRecorder.stop();
          }
        };
        return () => {
            if (mediaRecorder.state === "recording") {
              console.log("🛑 Manual stop triggered");
              mediaRecorder.stop();
            }
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
        return new Promise((resolve) => requestAnimationFrame(resolve));
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
        if (typeof window.__qsr_reset === "function")
          setTimeout(() => window.__qsr_reset(), 0);
      }
    }

})();
