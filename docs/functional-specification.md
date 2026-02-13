## Floatable Recorder — Functional Specification

### 1. Introduction

Floatable Recorder is a browser extension that enables users to record screen activity along with optional microphone, system audio, and webcam video using a floating in-page control panel.

The extension prioritizes minimal workflow interruption and provides professional-style recording behaviors such as camera overlay and cursor-focused zoom.

---

### 2. Goals

The system shall allow users to:

1. Record browser content without leaving the current page
2. Optionally include microphone and/or system audio
3. Include webcam video either as overlay or preview
4. Select camera devices before recording begins
5. Control recording from a floating draggable interface
6. Produce clean downloadable video files locally
7. Automatically focus the recording around cursor movement

---

### 3. User Interface

#### 3.1 Floating Button

* Appears on all supported pages
* Draggable
* Position saved per domain
* Toggles recorder panel

#### 3.2 Control Panel

The panel shall include:

| Section          | Controls                 |
| ---------------- | ------------------------ |
| Recording        | duration, fps            |
| Zoom             | enable/disable, behavior |
| Audio            | system, mic, both, mute  |
| Audio Processing | gain, compressor         |
| Camera           | overlay, PiP preview     |
| Camera Device    | dropdown selector        |
| Actions          | start, stop              |

---

### 4. Recording Behavior

#### 4.1 Starting Recording

1. User presses Start
2. Browser screen picker appears
3. Countdown shown
4. Recording begins

#### 4.2 During Recording

The system shall:

* Capture selected display
* Capture audio according to settings
* Activate webcam only after recording begins
* Apply cursor-follow zoom
* Optionally show PiP preview
* Optionally embed webcam overlay

#### 4.3 Ending Recording

Recording stops when:

* User presses Stop
* Timer expires
* Shared screen ends

The system shall:

* Download video automatically
* Stop all capture streams
* Close PiP window
* Turn off camera LED

---

### 5. Camera Modes

| Mode    | Behavior                 |
| ------- | ------------------------ |
| Overlay | Webcam embedded in video |
| PiP     | Floating preview only    |
| Both    | Preview + overlay        |
| None    | Screen only              |

---

### 6. Audio Modes

| Mode   | Behavior                |
| ------ | ----------------------- |
| System | Record tab/system audio |
| Mic    | Record microphone       |
| Both   | Mix audio               |
| Mute   | No audio recorded       |

---

### 7. Zoom Behavior

The system implements a virtual camera:

1. Cursor position tracked
2. Motion smoothed
3. Camera follows cursor
4. Zoom increases when idle
5. Zoom decreases during fast motion
6. Output frame crops and scales accordingly

---

### 8. Privacy Requirements

* Recording only starts after explicit user action
* No background recording
* All files saved locally
* Camera activates only during recording

---

### 9. Compatibility

* Chromium-based browsers
* Requires screen capture permission
* Requires microphone permission (if enabled)

---