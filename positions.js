/**
 * positions.js — Interactive double bass neck map
 * Draws all positions on a canvas and handles tap interaction
 */

const Positions = (() => {

  // ── Note frequency helpers ───────────────────────────
  const NOTE_FR = ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
  const NOTE_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function midiToFreq(midi, aRef = 440) {
    return aRef * Math.pow(2, (midi - 69) / 12);
  }
  function midiToName(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return NOTE_FR[((midi % 12) + 12) % 12] + oct;
  }
  function midiToNameEN(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return NOTE_EN[((midi % 12) + 12) % 12] + oct;
  }

  // ── String open MIDI numbers ─────────────────────────
  const OPEN_MIDI = { E: 28, A: 33, D: 38, G: 43 }; // E1,A1,D2,G2

  // ── Position data ────────────────────────────────────
  // Each position: id, label, semitones from open string (1st finger placement)
  // Naming convention X.Y : X = main position group, Y = first note index
  const POSITION_DATA = [
    {
      id: 'p1_1',
      label: '1.1',
      sublabel: '1.1',
      color: '#8e44ad',
      firstFingerSemitone: 1,
      description: '1er doigt sur le 1er demi-ton.',
      fingering: [
        { finger: 1, semitone: 1 },
        { finger: 2, semitone: 2 },
        { finger: 4, semitone: 3 },
      ],
      distanceInfo: '~2–3 cm depuis le sillet',
    },
    {
      id: 'p1_2',
      label: '1.2',
      sublabel: '1.2',
      color: '#2980b9',
      firstFingerSemitone: 2,
      description: '1er doigt sur le 2e demi-ton.',
      fingering: [
        { finger: 1, semitone: 2 },
        { finger: 2, semitone: 3 },
        { finger: 4, semitone: 4 },
      ],
      distanceInfo: '~4–5 cm du sillet',
    },
    {
      id: 'p2_3',
      label: '2.3',
      sublabel: '2.3',
      color: '#16a085',
      firstFingerSemitone: 3,
      description: '1er doigt sur le 3e demi-ton.',
      fingering: [
        { finger: 1, semitone: 3 },
        { finger: 2, semitone: 4 },
        { finger: 4, semitone: 5 },
      ],
      distanceInfo: '~6–7 cm du sillet',
    },
    {
      id: 'p2_4',
      label: '2.4',
      sublabel: '2.4',
      color: '#27ae60',
      firstFingerSemitone: 4,
      description: '1er doigt sur le 4e demi-ton.',
      fingering: [
        { finger: 1, semitone: 4 },
        { finger: 2, semitone: 5 },
        { finger: 4, semitone: 6 },
      ],
      distanceInfo: '~8–9 cm du sillet',
    },
    {
      id: 'p3_5',
      label: '3.5',
      sublabel: '3.5',
      color: '#f39c12',
      firstFingerSemitone: 5,
      description: '1er doigt sur le 5e demi-ton.',
      fingering: [
        { finger: 1, semitone: 5 },
        { finger: 2, semitone: 6 },
        { finger: 4, semitone: 7 },
      ],
      distanceInfo: '~10–11 cm du sillet',
    },
    {
      id: 'p4_6',
      label: '4.6',
      sublabel: '4.6',
      color: '#e67e22',
      firstFingerSemitone: 6,
      description: '1er doigt sur le 6e demi-ton.',
      fingering: [
        { finger: 1, semitone: 6 },
        { finger: 2, semitone: 7 },
        { finger: 4, semitone: 8 },
      ],
      distanceInfo: '~12–13 cm du sillet',
    },
    {
      id: 'p4_7',
      label: '4.7',
      sublabel: '4.7',
      color: '#e74c3c',
      firstFingerSemitone: 7,
      description: '1er doigt sur le 7e demi-ton.',
      fingering: [
        { finger: 1, semitone: 7 },
        { finger: 2, semitone: 8 },
        { finger: 4, semitone: 9 },
      ],
      distanceInfo: '~14–15 cm du sillet',
    },
    {
      id: 'p5_8',
      label: '5.8',
      sublabel: '5.8',
      color: '#7f8c8d',
      firstFingerSemitone: 9,
      description: '1er doigt sur le 9e demi-ton.',
      fingering: [
        { finger: 1, semitone: 9 },
        { finger: 2, semitone: 10 },
        { finger: 3, semitone: 11 },
      ],
      distanceInfo: '~22–24 cm du sillet',
    },
    {
      id: 'p5_9',
      label: '5.9',
      sublabel: '5.9',
      color: '#5d6d7e',
      firstFingerSemitone: 10,
      description: '1er doigt sur le 10e demi-ton.',
      fingering: [
        { finger: 1, semitone: 10 },
        { finger: 2, semitone: 11 },
        { finger: 3, semitone: 12 },
      ],
      distanceInfo: '~25–27 cm du sillet',
    },
    {
      id: 'p6_10',
      label: '6.10',
      sublabel: '6.10',
      color: '#424949',
      firstFingerSemitone: 11,
      description: '1er doigt sur le 11e demi-ton.',
      fingering: [
        { finger: 1, semitone: 11 },
        { finger: 2, semitone: 12 },
        { finger: 3, semitone: 13 },
      ],
      distanceInfo: '~28–31 cm du sillet',
    },
  ];

  // ── Canvas layout constants ───────────────────────────
  const NECK_WIDTH  = 220;
  const POS_HEIGHT  = 72;   // px per position block
  const POS_TOTAL   = POSITION_DATA.length * POS_HEIGHT; // 576px
  const NUT_HEIGHT  = 24;   // space for nut at top
  const NECK_TOTAL  = NUT_HEIGHT + POS_TOTAL + 20;

  // ── State ─────────────────────────────────────────────
  let canvas      = null;
  let ctx2d       = null;
  let currentStr  = 'G';
  let selectedPos = null;
  let visualMode  = false;
  let onSelect    = null; // callback(posData, notesArray)

  // ── Draw ──────────────────────────────────────────────
  function draw() {
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);

    // Background
    ctx2d.fillStyle = '#12122a';
    ctx2d.fillRect(0, 0, W, H);

    // Neck silhouette
    const neckL = 30, neckR = W - 10;
    const neckW  = neckR - neckL;

    // Neck wood gradient
    const grad = ctx2d.createLinearGradient(neckL, 0, neckR, 0);
    grad.addColorStop(0,   '#2c1810');
    grad.addColorStop(0.3, '#3d2415');
    grad.addColorStop(0.7, '#3d2415');
    grad.addColorStop(1,   '#2c1810');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(neckL, NUT_HEIGHT, neckW, H - NUT_HEIGHT - 10);

    // Nut
    ctx2d.fillStyle = '#d4c5a9';
    ctx2d.fillRect(neckL - 2, NUT_HEIGHT - 6, neckW + 4, 8);
    ctx2d.fillStyle = '#9090b0';
    ctx2d.font = 'bold 9px sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.fillText('SILLET', W / 2, NUT_HEIGHT - 8);

    // String line
    const strX = neckL + neckW * 0.55;
    ctx2d.strokeStyle = 'rgba(200,185,140,0.6)';
    ctx2d.lineWidth = 2.5;
    ctx2d.beginPath();
    ctx2d.moveTo(strX, NUT_HEIGHT);
    ctx2d.lineTo(strX, H - 10);
    ctx2d.stroke();

    // Draw position blocks
    POSITION_DATA.forEach((pos, i) => {
      const y = NUT_HEIGHT + i * POS_HEIGHT;
      const isSelected = selectedPos && selectedPos.id === pos.id;

      // Block fill
      ctx2d.fillStyle = isSelected
        ? hexToRgba(pos.color, 0.55)
        : hexToRgba(pos.color, 0.22);
      ctx2d.fillRect(neckL, y, neckW, POS_HEIGHT - 2);

      // Left border accent
      ctx2d.fillStyle = pos.color;
      ctx2d.fillRect(neckL, y, 3, POS_HEIGHT - 2);

      // Fret line at top of position
      ctx2d.strokeStyle = hexToRgba(pos.color, 0.7);
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(neckL, y);
      ctx2d.lineTo(neckR, y);
      ctx2d.stroke();

      // Position label
      ctx2d.fillStyle = isSelected ? '#ffffff' : hexToRgba(pos.color, 0.9);
      ctx2d.font = `bold ${isSelected ? 11 : 10}px sans-serif`;
      ctx2d.textAlign = 'left';
      ctx2d.fillText(pos.sublabel, neckL + 6, y + 18);

      // Notes for this position on current string
      const notes = getPositionNotes(pos, currentStr);
      ctx2d.fillStyle = 'rgba(220,220,240,0.7)';
      ctx2d.font = '8px sans-serif';
      ctx2d.fillText(notes.map(n => n.name).join(' '), neckL + 6, y + 30);
      ctx2d.fillStyle = 'rgba(210,190,110,0.7)';
      ctx2d.font = '7px sans-serif';
      ctx2d.fillText(notes.map(n => n.nameEN).join(' '), neckL + 6, y + 41);

      // Finger dots (visual markers mode or selected)
      if (visualMode || isSelected) {
        pos.fingering.forEach((f, fi) => {
          const dotY = y + 50 + fi * 8;
          if (dotY > y + POS_HEIGHT - 4) return;
          ctx2d.beginPath();
          ctx2d.arc(strX, dotY, 4, 0, Math.PI * 2);
          ctx2d.fillStyle = fingerColor(f.finger);
          ctx2d.fill();
          ctx2d.fillStyle = '#fff';
          ctx2d.font = 'bold 6px sans-serif';
          ctx2d.textAlign = 'center';
          ctx2d.fillText(f.finger, strX, dotY + 2);
          ctx2d.textAlign = 'left';
        });
      }
    });

    // Open string label
    ctx2d.fillStyle = '#d4c5a9';
    ctx2d.font = 'bold 11px sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(currentStr, strX, NUT_HEIGHT - 9);

    // Tolerance zone indicator (visual markers)
    if (visualMode && selectedPos) {
      // Highlight tolerance zone in green tint
      const si  = POSITION_DATA.findIndex(p => p.id === selectedPos.id);
      const y   = NUT_HEIGHT + si * POS_HEIGHT;
      ctx2d.strokeStyle = 'rgba(39,174,96,0.6)';
      ctx2d.lineWidth   = 2;
      ctx2d.setLineDash([4, 3]);
      ctx2d.strokeRect(neckL + 4, y + 4, neckW - 8, POS_HEIGHT - 8);
      ctx2d.setLineDash([]);
    }
  }

  // ── Note calculation ──────────────────────────────────
  function getPositionNotes(pos, str, aRef = 440) {
    const openMidi = OPEN_MIDI[str];
    return pos.fingering.map(f => {
      const midi = openMidi + f.semitone;
      return {
        finger: f.finger,
        semitone: f.semitone,
        midi,
        name: midiToName(midi),
        nameEN: midiToNameEN(midi),
        freq: Math.round(midiToFreq(midi, aRef) * 10) / 10,
      };
    });
  }

  // ── Hit test ──────────────────────────────────────────
  function hitTest(y) {
    const relY = y - NUT_HEIGHT;
    if (relY < 0) return null;
    const idx = Math.floor(relY / POS_HEIGHT);
    if (idx < 0 || idx >= POSITION_DATA.length) return null;
    return POSITION_DATA[idx];
  }

  // ── Helpers ───────────────────────────────────────────
  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function fingerColor(f) {
    return ['#7c6af7','#2980b9','#27ae60','#e74c3c'][f - 1] || '#aaa';
  }

  // ── Init ──────────────────────────────────────────────
  function init(canvasEl, detailEl, onSelectCb) {
    canvas = canvasEl;
    canvas.width  = NECK_WIDTH;
    canvas.height = NECK_TOTAL;
    canvas.style.width  = NECK_WIDTH + 'px';
    canvas.style.height = NECK_TOTAL + 'px';
    ctx2d = canvas.getContext('2d');
    onSelect = onSelectCb;

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const y    = e.clientY - rect.top;
      const pos  = hitTest(y);
      if (!pos) return;
      selectedPos = pos;
      draw();
      onSelect && onSelect(pos, currentStr);
    });

    // Touch support
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const y    = touch.clientY - rect.top;
      const pos  = hitTest(y);
      if (!pos) return;
      selectedPos = pos;
      draw();
      onSelect && onSelect(pos, currentStr);
    }, { passive: false });

    draw();
  }

  function setString(str) {
    currentStr  = str;
    selectedPos = null;
    draw();
  }

  function setVisualMarkers(on) {
    visualMode = on;
    draw();
  }

  function getPositionDataById(id) {
    return POSITION_DATA.find(p => p.id === id) || null;
  }

  function getOpenStringNote(str, aRef = 440) {
    const midi = OPEN_MIDI[str];
    return {
      midi,
      name:   midiToName(midi),
      nameEN: midiToNameEN(midi),
      freq:   Math.round(midiToFreq(midi, aRef) * 10) / 10,
    };
  }

  function resetSelection() {
    selectedPos = null;
    draw();
  }

  return { init, setString, setVisualMarkers, getPositionNotes, getPositionDataById, getOpenStringNote, resetSelection, POSITION_DATA };
})();
