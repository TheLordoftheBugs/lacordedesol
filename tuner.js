/**
 * tuner.js — Real-time pitch detection via Web Audio API
 * Uses autocorrelation (YIN-lite) for robust fundamental frequency detection
 */

const Tuner = (() => {

  // ── Bass string reference frequencies (A = 440 Hz) ──
  const STRING_REFS_440 = {
    E1: 41.204,
    A1: 55.000,
    D2: 73.416,
    G2: 98.000,
  };

  // Chromatic note names (French)
  const NOTE_NAMES_FR = ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
  const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  let audioCtx   = null;
  let analyser   = null;
  let sourceNode = null;
  let stream     = null;
  let rafId      = null;
  let isRunning  = false;

  // Config
  let refHz       = 442;
  let targetString = 'G2'; // default
  let autoDetect  = true;
  let targetFreqOverride = null;

  // Rolling average for stability (3 s window at ~30 fps → ~90 samples)
  const HISTORY_SIZE = 90;
  let centsHistory = [];

  // Callbacks
  let onNote     = null; // (noteInfo) => void
  let onSilence  = null; // () => void

  // ── Frequency → note info ──────────────────────────────
  function freqToNoteInfo(freq, aRef) {
    if (freq <= 0) return null;
    // MIDI note number relative to A4=aRef
    const midiFloat = 12 * Math.log2(freq / aRef) + 69;
    const midi      = Math.round(midiFloat);
    const cents     = Math.round((midiFloat - midi) * 100);
    const octave    = Math.floor(midi / 12) - 1;
    const noteIdx   = ((midi % 12) + 12) % 12;
    return {
      freq,
      midi,
      cents,
      octave,
      noteFr: NOTE_NAMES_FR[noteIdx],
      noteEn: NOTE_NAMES_EN[noteIdx],
      nameWithOctave: NOTE_NAMES_FR[noteIdx] + octave,
    };
  }

  // ── Auto-detect closest string ─────────────────────────
  function detectString(freq) {
    let best = null, minDist = Infinity;
    const refs = getStringRefs();
    for (const [key, ref] of Object.entries(refs)) {
      // Check within ±2 semitones of the open string (to catch harmonics / first positions)
      const ratio = freq / ref;
      // Accept note if it could belong to range [open - 100¢, open + 700¢]
      const cents = 1200 * Math.log2(ratio);
      if (cents >= -150 && cents <= 800) {
        const dist = Math.abs(cents - 0); // prefer near open
        if (dist < minDist) { minDist = dist; best = key; }
      }
    }
    return best;
  }

  function getStringRefs() {
    const factor = refHz / 440;
    const refs = {};
    for (const [k, v] of Object.entries(STRING_REFS_440)) {
      refs[k] = v * factor;
    }
    return refs;
  }

  // ── YIN autocorrelation pitch detection ───────────────
  function detectPitch(buffer, sampleRate) {
    const SIZE  = buffer.length;
    const HALF  = Math.floor(SIZE / 2);
    // Minimum / maximum period for bass (30 Hz – 200 Hz)
    const minPeriod = Math.floor(sampleRate / 200);
    const maxPeriod = Math.floor(sampleRate / 28);

    // Step 1: difference function
    const d = new Float32Array(HALF);
    for (let tau = 1; tau < HALF; tau++) {
      let sum = 0;
      for (let i = 0; i < HALF; i++) {
        const diff = buffer[i] - buffer[i + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }

    // Step 2: cumulative mean normalised difference
    const cmnd = new Float32Array(HALF);
    cmnd[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < HALF; tau++) {
      runningSum += d[tau];
      cmnd[tau] = runningSum === 0 ? 0 : d[tau] * tau / runningSum;
    }

    // Step 3: absolute threshold
    const THRESHOLD = 0.12;
    let tau = -1;
    for (let t = Math.max(2, minPeriod); t < Math.min(HALF - 1, maxPeriod); t++) {
      if (cmnd[t] < THRESHOLD) {
        // find local minimum
        while (t + 1 < HALF && cmnd[t + 1] < cmnd[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau === -1) return -1;

    // Step 4: parabolic interpolation for sub-sample precision
    if (tau > 0 && tau < HALF - 1) {
      const s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1];
      tau += (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / tau;
  }

  // ── RMS energy ────────────────────────────────────────
  function rms(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
  }

  // ── Main analysis loop ────────────────────────────────
  function analyse() {
    if (!isRunning) return;

    const bufferSize = analyser.fftSize;
    const buffer = new Float32Array(bufferSize);
    analyser.getFloatTimeDomainData(buffer);

    const energy = rms(buffer);

    if (energy < 0.005) {
      // silence
      centsHistory = [];
      onSilence && onSilence();
    } else {
      const freq = detectPitch(buffer, audioCtx.sampleRate);
      if (freq > 0) {
        const info = freqToNoteInfo(freq, refHz);
        if (info) {
          // Detect string
          if (autoDetect) {
            const str = detectString(freq);
            if (str) info.string = str;
          } else {
            info.string = targetString;
          }

          // Target cents: compare to target note (or open string if no override)
          const refs = getStringRefs();
          const refStr = info.string || targetString;
          const refFreq = targetFreqOverride !== null
            ? targetFreqOverride
            : (refs[refStr] || refs.G2);
          const centsFromTarget = 1200 * Math.log2(freq / refFreq);

          // Normalise to nearest semitone of the target note
          // (so we show accuracy relative to the exact target pitch)
          const targetNoteInfo = freqToNoteInfo(refFreq, refHz);
          const exactCents = info.cents; // cents deviation from nearest chromatic note

          info.centsFromTarget = centsFromTarget;

          // Rolling history for stability
          centsHistory.push(exactCents);
          if (centsHistory.length > HISTORY_SIZE) centsHistory.shift();

          // Average over window
          const avg = centsHistory.reduce((a, b) => a + b, 0) / centsHistory.length;
          const variance = centsHistory.reduce((s, c) => s + (c - avg) ** 2, 0) / centsHistory.length;
          const stability = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 20));

          info.avgCents   = Math.round(avg);
          info.stability  = stability;

          onNote && onNote(info);
        }
      }
    }

    rafId = requestAnimationFrame(analyse);
  }

  // ── Public API ────────────────────────────────────────
  async function start() {
    if (isRunning) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl:  false,
        }
      });

      audioCtx  = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 4096; // good resolution for bass
      analyser.smoothingTimeConstant = 0.1;

      sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      isRunning = true;
      centsHistory = [];
      rafId = requestAnimationFrame(analyse);
      return true;
    } catch (err) {
      console.error('Tuner start error:', err);
      return false;
    }
  }

  function stop() {
    isRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (analyser)   { analyser.disconnect();   analyser   = null; }
    if (stream)     { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioCtx)   { audioCtx.close();        audioCtx   = null; }
    centsHistory = [];
  }

  function setRefHz(hz)        { refHz = hz; }
  function setTargetString(s)  { targetString = s; }
  function setAutoDetect(v)    { autoDetect = v; }
  function setOnNote(fn)       { onNote = fn; }
  function setOnSilence(fn)    { onSilence = fn; }
  function getIsRunning()      { return isRunning; }
  function setTargetFreq(f)    { targetFreqOverride = f; centsHistory = []; }

  return { start, stop, setRefHz, setTargetString, setAutoDetect, setTargetFreq, setOnNote, setOnSilence, getIsRunning, freqToNoteInfo };
})();
