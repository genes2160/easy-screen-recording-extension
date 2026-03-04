// ============================
// content.js (single file)
// ============================
// =============================
// Site blocking system
// =============================

const BLOCK_KEY = "qsr-blocked-sites";
const host = location.origin;

async function getBlockedSites() {

  try {
    if (!chrome?.runtime?.id) return [];
    if (!chrome?.storage?.local) return [];

    const res = await chrome.storage.local.get([BLOCK_KEY]);

    return res?.[BLOCK_KEY] || [];

  } catch (err) {

    console.warn("Extension context invalidated:", err);
    return [];

  }

}

async function saveBlockedSites(list) {
  return new Promise((resolve) => {
    chrome?.storage?.local?.set?.({ [BLOCK_KEY]: list }, resolve);
  });
}

function showToast(message) {

  let toast = document.getElementById("qsr-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "qsr-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toast.__hideTimer);

  toast.__hideTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


(async() => {
  const blocked = await getBlockedSites();
  // Prevent widget loading if site blocked
  if (blocked.includes(host)) {
    console.log("🚫 Screen recorder disabled on this site:", host);
    showToast(`🚫 Screen recorder disabled on this site ${host}`);
    return;
  }
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
  #qsr-panel .row { display:flex; gap:8px; margin:8px 0; align-items:center; flex-wrap: wrap; }
  #qsr-panel label { font-size: 12px; opacity:.85; display:flex; align-items:center; gap:6px; }
  #qsr-panel input[type="number"], #qsr-panel select {
    padding:6px 8px; border-radius:6px; border:1px solid #333; background:#181818; color:#eee;
  }
  #qsr-panel input[type="number"] { width: 82px; }
  #qsr-panel .btn {
    flex:1;
    padding:8px 10px; border-radius:8px; border:1px solid #444; background:#1f2937; color:#eee; cursor:pointer;
  }
  #qsr-panel .btn.primary { background:#2563eb; border-color:#2563eb; }
  #qsr-panel .btn.danger { background:#b91c1c; border-color:#b91c1c; }
  #qsr-note { font-size:11px; opacity:.7; margin-top:6px; }
  #qsr-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #111;
    color: #fff;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    box-shadow: 0 8px 22px rgba(0,0,0,.35);
    opacity: 0;
    transform: translateY(10px);
    transition: all .25s ease;
    z-index: 2147483647;
    pointer-events: none;
  }

  #qsr-toast.show {
    opacity: 1;
    transform: translateY(0);
  }
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
        <label>FPS <input id="qsr-fps" type="number" min="10" max="60" step="1" value="30" style="width:60px"/></label>
      </div>

      <div class="row">
        <label><input id="qsr-zoom-on" type="checkbox" /> Zoom</label>
        <label>From <input id="qsr-zs" type="number" min="1" step="0.1" value="1" style="width:56px"/></label>
        <label>To <input id="qsr-ze" type="number" min="1" step="0.1" value="1.4" style="width:56px"/></label>
        <label>FocusX <input id="qsr-fx" type="number" min="0" max="1" step="0.01" value="0.5" style="width:60px"/></label>
        <label>FocusY <input id="qsr-fy" type="number" min="0" max="1" step="0.01" value="0.5" style="width:60px"/></label>
      </div>

      <!-- NEW: Audio source & processing controls -->
      <div class="row">
        <label>Audio
          <select id="qsr-audio-src">
            <option value="system">System only</option>
            <option value="mic">Mic only</option>
            <option value="both" selected>Both</option>
          </select>
        </label>
        <label>Sys Gain <input id="qsr-sgain" type="number" step="0.1" min="0" value="3.0"/></label>
        <label>Mic Gain <input id="qsr-mgain" type="number" step="0.1" min="0" value="1.0"/></label>
      </div>

      <div class="row">
        <label><input id="qsr-comp" type="checkbox" checked /> Compressor</label>
        <label>Thresh <input id="qsr-comp-th" type="number" step="1" min="-60" max="0" value="-15"/></label>
        <label>Ratio <input id="qsr-comp-ra" type="number" step="1" min="1" max="20" value="10"/></label>
        <label>Knee <input id="qsr-comp-kn" type="number" step="1" min="0" max="40" value="25"/></label>
      </div>
      <div class="row">
        <label><input id="qsr-dedupe" type="checkbox" checked/> Skip mic if already in system</label>
      </div>
      <div class="row">
        <label><input id="qsr-mute-all" type="checkbox"/> Mute</label>
      </div>
      <!-- /NEW -->
      <div class="row">
        <label title="Shows your webcam inside the final recorded video">
          <input id="qsr-cam-overlay" type="checkbox"/> Overlay camera
        </label>

        <label title="Floating preview window. May appear in recording if you share entire screen">
          <input id="qsr-cam-pip" type="checkbox"/> PiP preview
        </label>

        <label title="Size of the round overlay camera in the final video">
          Size <input id="qsr-cam-size" type="number" value="220" min="80" max="600" style="width:70px"/>
        </label>
      </div>
      <div class="row" id="qsr-cam-select-row" style="display:none">
        <label title="Choose which camera will be used when recording starts">
          Camera:
          <select id="qsr-cam-device"></select>
        </label>
      </div>
      <!-- /NEW -->

      <div class="row">
        <button id="qsr-start" class="btn primary">Start</button>
        <button id="qsr-stop" style="cursor:not-allowed" class="btn danger" disabled>Stop</button>
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
  const $muteAll = $("#qsr-mute-all");
  const $camSize = $("#qsr-cam-size");
  const $camOverlay = $("#qsr-cam-overlay");
  const $camPip = $("#qsr-cam-pip");
  const $camDeviceRow = $("#qsr-cam-select-row");
  const $camDevice = $("#qsr-cam-device");
  // NEW: audio controls
  const $audioSrc = $("#qsr-audio-src");
  const $sGain = $("#qsr-sgain");
  const $mGain = $("#qsr-mgain");
  const $comp = $("#qsr-comp");
  const $compTh = $("#qsr-comp-th");
  const $compRa = $("#qsr-comp-ra");
  const $compKn = $("#qsr-comp-kn");
  const $dedupe = $("#qsr-dedupe");

  // Position persistence
  const domainKey = `qsr-pos-${location.origin}`;
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
    $camOverlay.addEventListener("change", async () => {
      if ($camPip.checked || $camOverlay.checked) {
        $camDeviceRow.style.display = "flex";
        await loadCameraList();
      } else {
        $camDeviceRow.style.display = "none";
      }
    });
    $camPip.addEventListener("change", async () => {
      if ($camPip.checked || $camOverlay.checked) {
        $camDeviceRow.style.display = "flex";
        await loadCameraList();
      } else {
        $camDeviceRow.style.display = "none";
      }
    });
    $toggle.addEventListener("click", (e) => {
      if (e.detail === 0) return; // keyboard?
      if ($toggle.classList.contains("dragging")) return;
      // If just dragged, ignore click toggling.
      if (document.activeElement === $toggle && moved) return;
      togglePanel();
    });
  })();
  async function loadCameraList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === "videoinput");

      $camDevice.innerHTML = "";

      cams.forEach((cam, i) => {
        const opt = document.createElement("option");
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${i + 1}`;
        $camDevice.appendChild(opt);
      });

      if (cams.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = "No camera found";
        $camDevice.appendChild(opt);
      }

    } catch (e) {
      console.warn("Could not enumerate cameras", e);
    }
  }

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
      stopFn = await recordScreen(3, secs * 1000, zoom, fps); // shorter countdown
      setTimeout(() => {
        document.getElementById("qsr-widget").style.display = "block";
      }, secs * 1000);
    } catch (error) {
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
  async function createCompositedStream(screenStream, fps, enablePip = false, deviceId = null, enableOverlay = null) {
    const video = document.createElement("video");
    video.srcObject = screenStream;
    video.playsInline = true;
    await video.play();
    let camStream = null;
    if (deviceId) {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      });
    } else {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    const camVideo = document.createElement("video");
    camVideo.srcObject = camStream;
    camVideo.playsInline = true;
    await camVideo.play();
    // ===== Picture in Picture live camera =====
    // ===== Optional PiP preview =====
    let pipActive = false;

    if (enablePip && document.pictureInPictureEnabled) {
      try {
        camVideo.muted = true;
        await camVideo.requestPictureInPicture();
        pipActive = true;
      } catch (e) {
        console.log("PiP rejected by browser:", e);
      }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const track = screenStream.getVideoTracks()[0];
    const settings = track.getSettings();
    canvas.width = settings.width || 1920;
    canvas.height = settings.height || 1080;


    let running = true;

    function draw() {
      if (!running) return;

      const camSize = +$camSize.value || 220;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const padding = 20;
      const x = canvas.width - camSize - padding;
      const y = canvas.height - camSize - padding;

      if (enableOverlay) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + camSize / 2, y + camSize / 2, camSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(camVideo, x, y, camSize, camSize);
        ctx.restore();
      }

      requestAnimationFrame(draw);
    }


    draw();

    const composed = canvas.captureStream(fps);


    function stopAll() {
      running = false;
      camStream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      camVideo.srcObject = null;

      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => { });
      }
    }

    return {
      stream: new MediaStream([composed.getVideoTracks()[0]]),
      stop: stopAll
    };
  }
  const session = {
    displayStream: null,
    micStream: null,
    cameraStop: null,
    audioCtx: null,
    finalStream: null
  };
  // -------------------------
  // Robust recordScreen impl (with full audio capture + NEW audio UI)
  // -------------------------
  async function recordScreen(countdown, durationMs = null, zoom = null, fps = 30) {
    let mediaRecorder;
    let recordedChunks = [];
    let cameraCleanup = null;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    // NEW: read audio options
    const audioMode = $audioSrc.value;           // "system" | "mic" | "both"
    const sysGainVal = Math.max(0, +$sGain.value || 1.0);
    const micGainVal = Math.max(0, +$mGain.value || 1.0);
    const useComp = $comp.checked;
    const compTh = +$compTh.value || -15;
    const compRa = +$compRa.value || 10;
    const compKn = +$compKn.value || 25;
    const dedupeMic = $dedupe.checked;
    const selectedCameraId = $camDevice.value || null;
    try {
      // 1️⃣ Ask the user what to capture (with system/tab audio based on mode)
      const wantSystem = (!$camPip.checked && !$camOverlay.checked) && (audioMode === "system" || audioMode === "both");
      let displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          displaySurface: "browser",
          surfaceSwitching: "include",
          selfBrowserSurface: "include",
        },
        audio: wantSystem ? { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } : false,
      });
      const rawDisplayStream = displayStream;
      const enableOverlay = $camOverlay.checked;
      const enablePip = $camPip.checked;
      session.displayStream = displayStream;

      if (enableOverlay || enablePip) {
        console.log("📷 Camera overlay enabled");

        const originalAudioTracks = displayStream.getAudioTracks();
        const composed = await createCompositedStream(displayStream, fps, enablePip, selectedCameraId, enableOverlay);

        displayStream = new MediaStream([
          ...composed.stream.getVideoTracks(),
          ...originalAudioTracks
        ]);

        // cameraCleanup = composed.stop;
        session.cameraStop = composed.stop;
      }

      // 2️⃣ Capture mic separately (only if needed)
      const wantMic = audioMode === "mic" || audioMode === "both";
      let micStream = null;
      if (wantMic) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        });
      }
      session.micStream = micStream;

      // 3️⃣ Detect duplicate mic in system audio
      const systemTracks = rawDisplayStream.getAudioTracks();
      const systemTrack = systemTracks.length > 0 ? systemTracks[0] : null;

      let micInSystem = false;
      if (wantMic && systemTrack && micStream) {
        const micTrack = micStream.getAudioTracks()[0];
        try {
          const sys = systemTrack.getSettings?.() || {};
          const mic = micTrack?.getSettings?.() || {};
          if (sys.deviceId && mic.deviceId && sys.deviceId === mic.deviceId) micInSystem = true;
          console.log("🎧 System audio settings:", sys);
        } catch { }
      }
      if (micInSystem && dedupeMic && audioMode === "both") {
        console.log("⚠️ Mic appears inside system audio — skipping extra mic due to dedupe setting.");
      }

      // 4️⃣ Mix with AudioContext
      session.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioCtx = session.audioCtx;
      const destination = audioCtx.createMediaStreamDestination();

      let anyAudio = false;

      // Build optional compressor
      const makeCompressor = () => {
        const c = audioCtx.createDynamicsCompressor();
        c.threshold.value = compTh;
        c.knee.value = compKn;
        c.ratio.value = compRa;
        c.attack.value = 0.003;
        c.release.value = 0.25;
        return c;
      };

      // System chain
      if (wantSystem && systemTrack) {
        const sysSource = audioCtx.createMediaStreamSource(rawDisplayStream);
        const sysGain = audioCtx.createGain();
        sysGain.gain.value = sysGainVal; // NEW: UI gain

        if (useComp) {
          const comp = makeCompressor();
          sysSource.connect(sysGain).connect(comp).connect(destination);
        } else {
          sysSource.connect(sysGain).connect(destination);
        }
        anyAudio = true;
      } else if (wantSystem && !systemTrack) {
        console.warn("🔇 System audio not available from getDisplayMedia.");
      }

      // Mic chain
      if (wantMic && micStream && !(micInSystem && dedupeMic && audioMode === "both")) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGain = audioCtx.createGain();
        micGain.gain.value = micGainVal; // NEW: UI gain

        if (useComp) {
          const comp = makeCompressor();
          micSource.connect(micGain).connect(comp).connect(destination);
        } else {
          micSource.connect(micGain).connect(destination);
        }
        anyAudio = true;
      }

      // 5️⃣ Combine video + mixed audio
      const finalTracks = [...displayStream.getVideoTracks()];

      const muteAll = $muteAll.checked;

      if (!muteAll && anyAudio) {
        finalTracks.push(...destination.stream.getAudioTracks());
      } else {
        console.log("🔇 Recording muted — no audio track added");
      }
      const finalStream = new MediaStream(finalTracks);
      session.finalStream = finalStream;

      console.log("🎬 Final mixed stream tracks:");
      finalStream.getAudioTracks().forEach((t) =>
        console.log("Audio track:", t.label, t.getSettings?.())
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
        const url = downloadBlob(recordedChunks, "webm");
        finalize(url);
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

    function waitForFirstFrame() {
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

    function finalize(objUrl) {

      setTimeout(() => URL.revokeObjectURL(objUrl), 0);

      try { session.finalStream?.getTracks().forEach(t => t.stop()); } catch { }
      try { session.displayStream?.getTracks().forEach(t => t.stop()); } catch { }
      try { session.micStream?.getTracks().forEach(t => t.stop()); } catch { }
      try { session.cameraStop?.(); } catch { }
      try { session.audioCtx?.close(); } catch { }

      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => { });
      }

      if (typeof window.__qsr_reset === "function")
        setTimeout(() => window.__qsr_reset(), 0);
    }

  }
})();

// =============================
// Keyboard shortcuts
// =============================

document.addEventListener("keydown", async (e) => {

  if (!e.shiftKey) return;

  const key = e.key.toLowerCase();

  const blocked = await getBlockedSites();

  // CTRL+SHIFT+B → block current site
  if (key === "b") {

    if (!blocked.includes(host)) {
      blocked.push(host);
      await saveBlockedSites(blocked);
      showToast(`🚫 Recorder disabled on:\n${host}\n\nReload page.`);
      setTimeout(() => location.reload(), 800);
    } else {
      showToast("Site already blocked.");
    }

  }

  // CTRL+SHIFT+R → restore site
  if (key === "r") {

    const newList = blocked.filter(s => s !== host);
    await saveBlockedSites(newList);

    showToast(`✅ Recorder restored on:\n${host}\n\nReload page.`);
  }

  // CTRL+SHIFT+L → show blocked sites list
  if (key === "l") {

    showBlockedSitesModal(blocked);

  }

});

function showBlockedSitesModal(list) {

  const modal = document.createElement("div");

  modal.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.6);
    z-index:2147483647;
    display:flex;
    align-items:center;
    justify-content:center;
    font-family:sans-serif;
  `;

  const box = document.createElement("div");

  box.style.cssText = `
    background:#111;
    color:#fff;
    padding:20px;
    border-radius:10px;
    width:320px;
    max-height:400px;
    overflow:auto;
  `;

  box.innerHTML = `
    <h3 style="margin-top:0">Blocked Sites</h3>
    <div id="qsr-blocked-list"></div>
    <button id="qsr-close-modal" style="
      margin-top:12px;
      padding:6px 10px;
      background:#2563eb;
      border:none;
      color:white;
      border-radius:6px;
      cursor:pointer;
    ">Close</button>
  `;

  modal.appendChild(box);
  document.body.appendChild(modal);

  const listBox = box.querySelector("#qsr-blocked-list");

  if (list.length === 0) {
    listBox.innerHTML = "<i>No blocked sites</i>";
  } else {
    list.forEach(site => {

      const row = document.createElement("div");

      row.style.cssText = `
        display:flex;
        justify-content:space-between;
        padding:6px 0;
        border-bottom:1px solid #333;
      `;

      row.innerHTML = `
        <span>${site}</span>
        <button data-site="${site}" style="
          background:#b91c1c;
          border:none;
          color:#fff;
          padding:4px 8px;
          border-radius:5px;
          cursor:pointer;
        ">Remove</button>
      `;

      listBox.appendChild(row);
    });
  }

  box.querySelectorAll("button[data-site]").forEach(btn => {

    btn.onclick = async () => {

      const site = btn.dataset.site;

      const blocked = await getBlockedSites();

      const updated = blocked.filter(s => s !== site);

      await saveBlockedSites(updated);

      btn.parentElement.remove();
    };

  });

  box.querySelector("#qsr-close-modal").onclick = () => modal.remove();

}
chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "QSR_TOAST") {
    showToast(msg.message);
  }
  return;
});