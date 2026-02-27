/**
 * audio.js — Reference note playback using Web Audio API synthesis
 * Generates a realistic bowed-string timbre via additive synthesis + envelope
 */

const AudioPlayer = (() => {
  let ctx = null;
  let currentSource = null;
  let currentGain   = null;

  function getCtx() {
    if (!ctx || ctx.state === 'closed') {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /**
   * Play a frequency for `duration` seconds.
   * Uses additive synthesis: fundamental + harmonics to mimic a bowed bass string.
   */
  function playFreq(freq, duration = 2.5, mode = 'arco') {
    stop();
    const ac = getCtx();
    const masterGain = ac.createGain();
    masterGain.gain.setValueAtTime(0, ac.currentTime);

    // Harmonics profile for arco (bowed) bass string
    const harmonics = mode === 'pizzicato'
      ? [1, 0.55, 0.35, 0.18, 0.08, 0.04]  // pizz: richer attack, faster decay shape
      : [1, 0.60, 0.40, 0.22, 0.12, 0.06, 0.03]; // arco: full sustain

    const oscs = harmonics.map((amp, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.type      = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq * (i + 1);
      // Slight detuning on upper harmonics for warmth
      if (i > 1) osc.detune.value = (Math.random() - 0.5) * 4;
      gain.gain.value = amp * 0.18;
      osc.connect(gain);
      gain.connect(masterGain);
      return osc;
    });

    // Envelope
    const t = ac.currentTime;
    if (mode === 'pizzicato') {
      masterGain.gain.linearRampToValueAtTime(0.8, t + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.3, t + 0.3);
      masterGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    } else {
      // arco: slow bow attack
      masterGain.gain.linearRampToValueAtTime(0.9, t + 0.25);
      masterGain.gain.setValueAtTime(0.9, t + duration - 0.3);
      masterGain.gain.linearRampToValueAtTime(0.001, t + duration);
    }

    // Subtle vibrato (arco only)
    if (mode === 'arco') {
      const vib = ac.createOscillator();
      const vibGain = ac.createGain();
      vib.frequency.value = 5.5;
      vibGain.gain.setValueAtTime(0, t + 0.4);
      vibGain.gain.linearRampToValueAtTime(3, t + 0.8); // 3 cents vibrato depth
      vib.connect(vibGain);
      oscs.forEach(o => vibGain.connect(o.frequency));
      vib.start(t);
      vib.stop(t + duration);
    }

    // Connect master to output
    masterGain.connect(ac.destination);

    oscs.forEach(o => { o.start(t); o.stop(t + duration); });

    currentSource = oscs[0];
    currentGain   = masterGain;
  }

  function stop() {
    if (currentGain) {
      try {
        const ac = getCtx();
        currentGain.gain.setValueAtTime(0, ac.currentTime);
      } catch (e) { /* ignore */ }
      currentGain = null;
    }
  }

  function playNote(noteData, mode = 'arco') {
    playFreq(noteData.freq, 3, mode);
  }

  return { playFreq, playNote, stop };
})();
