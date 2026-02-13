# 🧠 Technical Specification (Markdown)

`/docs/technical-specification.md`

---

## Floatable Recorder — Technical Specification

### 1. Architecture Overview

The extension operates entirely in a content script and uses browser media APIs.

```
UI → capture config → getDisplayMedia
                   → getUserMedia (optional)
                   → compositing canvas
                   → MediaRecorder
                   → file download
```

---

### 2. Core Components

| Component       | Responsibility             |
| --------------- | -------------------------- |
| UI Widget       | floating control panel     |
| Recorder Engine | manage streams             |
| Compositor      | merge screen + camera      |
| Audio Mixer     | combine mic + system       |
| Zoom Engine     | dynamic cropping           |
| Exporter        | generate downloadable file |

---

### 3. Media Pipeline

#### 3.1 Video

```
getDisplayMedia()
   ↓
<video> element
   ↓
Canvas draw loop
   ↓
canvas.captureStream()
   ↓
MediaRecorder
```

#### 3.2 Camera Overlay

```
getUserMedia(video)
   ↓
secondary video element
   ↓
drawn onto canvas (circle clip)
```

#### 3.3 Audio Mixing

Uses Web Audio API:

```
system stream → gain → compressor → destination
mic stream → gain → compressor → destination
destination → MediaRecorder
```

---

### 4. Mouse Follow Zoom Algorithm

Each frame:

1. Capture raw mouse position
2. Apply smoothing (LERP)
3. Calculate velocity
4. Adjust zoom level
5. Lead camera toward movement direction
6. Clamp crop bounds
7. Draw cropped frame to canvas

Output resolution remains constant while source crop moves.

---

### 5. Resource Lifecycle

#### Start

* Request display stream
* Optionally request mic
* Optionally request camera
* Build audio graph
* Begin recording

#### Stop

* Stop MediaRecorder
* Stop all tracks
* Close AudioContext
* Exit PiP

---

### 6. Camera Handling

Camera stream is created only after screen capture begins to prevent premature activation.

Device selection uses:

```
navigator.mediaDevices.enumerateDevices()
```

---

### 7. File Generation

```
MediaRecorder → webm chunks → Blob → objectURL → download
```

---

### 8. State Management

Session object tracks resources:

```
session = {
 displayStream
 micStream
 finalStream
 audioCtx
 cameraStop
}
```

Ensures all resources cleaned on stop.

---

### 9. Performance Considerations

* Canvas rendering synchronized via requestAnimationFrame
* Zoom implemented via cropping, not scaling DOM
* Audio processed via single AudioContext
* Streams stopped immediately after recording

---

### 10. Error Handling

Handles:

* Permission denial
* Stream ending
* Device unavailable
* Recording interruption

---
