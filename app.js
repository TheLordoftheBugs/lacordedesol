/**
 * app.js — Main controller: wires Tuner, Positions, AudioPlayer together
 */

document.addEventListener('DOMContentLoaded', () => {

  // ════════════════════════════════════════════════════
  // MODULE 1 — ACCORDEUR
  // ════════════════════════════════════════════════════

  // Elements
  const noteName       = document.getElementById('note-name');
  const noteFreqEl     = document.getElementById('note-freq');
  const stringLabel    = document.getElementById('string-label');
  const needle         = document.getElementById('needle');
  const centsValueEl   = document.getElementById('cents-value');
  const tuningStatus   = document.getElementById('tuning-status');
  const statusIndicator= document.getElementById('status-indicator');
  const statusText     = document.getElementById('status-text');
  const stabilityFill  = document.getElementById('stability-fill');
  const stabilityAvg   = document.getElementById('stability-avg');
  const micBtn         = document.getElementById('mic-btn');
  const micText        = document.getElementById('mic-text');
  const autoDetectChk  = document.getElementById('auto-detect');

  const STRING_LABELS = {
    E1: 'Corde de Mi (E1)',
    A1: 'Corde de La (A1)',
    D2: 'Corde de Ré (D2)',
    G2: 'Corde de Sol (G2)',
  };

  // ── Hz select ───────────────────────────────────────
  document.getElementById('ref-hz-select').addEventListener('change', e => {
    currentARef = parseInt(e.target.value);
    Tuner.setRefHz(currentARef);
    refreshDetailPanel();
  });

  // ── Mode buttons ─────────────────────────────────────
  let currentMode = 'arco';
  let currentARef = 442;
  let panelState  = { type: 'open', str: 'G' };
  document.querySelectorAll('.btn-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });

  // ── Reset accordeur (Hz + mode → defaults) ───────────
  document.getElementById('reset-tuner-btn').addEventListener('click', () => {
    currentARef = 442;
    document.getElementById('ref-hz-select').value = '442';
    Tuner.setRefHz(442);
    currentMode = 'arco';
    document.querySelectorAll('.btn-mode').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === 'arco');
    });
    targetMidi = null;
    Tuner.setTargetFreq(null);
    refreshDetailPanel();
  });

  // ── String selector ──────────────────────────────────
  let lastPosStr = 'G';

  function syncPosString(str) {
    const letter = str[0]; // "E1"→"E", "G2"→"G", etc.
    if (letter === lastPosStr) return;
    lastPosStr = letter;
    Positions.setString(letter);
    renderOpenString(letter);
  }

  document.querySelectorAll('.string-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Tuner.setTargetString(btn.dataset.string);
      syncPosString(btn.dataset.string);
    });
  });

  // ── Auto-detect toggle ───────────────────────────────
  autoDetectChk.addEventListener('change', () => {
    Tuner.setAutoDetect(autoDetectChk.checked);
    document.querySelectorAll('.string-btn').forEach(b =>
      b.style.opacity = autoDetectChk.checked ? '0.6' : '1'
    );
  });

  // ── Needle physics ───────────────────────────────────
  // Smooth needle via spring interpolation
  let needleAngle = 0;
  let needleTarget = 0;
  let needleRaf = null;

  function animateNeedle() {
    needleAngle += (needleTarget - needleAngle) * 0.18;
    needle.setAttribute('transform', `rotate(${needleAngle}, 150, 145)`);
    needleRaf = requestAnimationFrame(animateNeedle);
  }
  needleRaf = requestAnimationFrame(animateNeedle);

  // cents → angle: -50 cents = -80°, 0 = 0°, +50 cents = +80°
  function centsToAngle(cents) {
    return Math.max(-82, Math.min(82, cents * 1.64));
  }

  // ── Tuner callbacks ──────────────────────────────────
  Tuner.setOnNote(info => {
    const { cents, centsFromTarget, freq, nameWithOctave, string, stability, avgCents } = info;

    // When a note is targeted, use deviation from that note for needle + display
    const activeCents = targetMidi !== null ? Math.round(centsFromTarget) : cents;

    // Note name
    noteName.textContent = nameWithOctave;
    noteFreqEl.textContent = freq.toFixed(1) + ' Hz';

    if (targetMidi !== null) {
      const targeted = detailPanel.querySelector('.note-card.targeted');
      stringLabel.textContent = targeted ? `Cible : ${targeted.dataset.name}` : '';
    } else {
      stringLabel.textContent = string ? STRING_LABELS[string] || string : '';
    }

    // Needle
    needleTarget = centsToAngle(activeCents);

    // Cents display
    centsValueEl.textContent = (activeCents >= 0 ? '+' : '') + activeCents;

    // Status
    const absCents = Math.abs(activeCents);
    let statusClass, statusMsg;
    if (absCents <= 5) {
      statusClass = 'in-tune';
      statusMsg   = '✓ Accordé';
      noteName.className = 'note-name in-tune';
      centsValueEl.style.color = 'var(--green)';
    } else if (absCents <= 15) {
      statusClass = 'close';
      statusMsg   = cents < 0 ? '▲ Monter légèrement' : '▼ Descendre légèrement';
      noteName.className = 'note-name close';
      centsValueEl.style.color = 'var(--orange)';
    } else {
      statusClass = 'off';
      statusMsg   = cents < 0 ? '▲ Trop bas' : '▼ Trop haut';
      noteName.className = 'note-name off';
      centsValueEl.style.color = 'var(--red)';
    }

    tuningStatus.className = 'tuning-status ' + statusClass;
    statusText.textContent = statusMsg;

    // Stability
    const pct = Math.round(stability * 100);
    stabilityFill.style.width = pct + '%';
    stabilityAvg.textContent = `Moy. : ${avgCents >= 0 ? '+' : ''}${avgCents} ¢`;

    // Sync string button highlight + positions module
    if (info.string) {
      document.querySelectorAll('.string-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.string === info.string);
      });
      syncPosString(info.string);
    }
  });

  Tuner.setOnSilence(() => {
    noteName.textContent  = '—';
    noteName.className    = 'note-name';
    noteFreqEl.textContent = '— Hz';
    stringLabel.textContent = 'Jouez une corde';
    needleTarget = 0;
    centsValueEl.textContent = '0';
    centsValueEl.style.color = '';
    tuningStatus.className = 'tuning-status';
    statusText.textContent = 'En attente…';
    stabilityFill.style.width = '0%';
    stabilityAvg.textContent = 'Moy. : — ¢';
  });

  // ── Mic button ───────────────────────────────────────
  micBtn.addEventListener('click', async () => {
    if (Tuner.getIsRunning()) {
      Tuner.stop();
      micBtn.classList.remove('active');
      micText.textContent = 'Activer le micro';
      Tuner.setOnSilence && Tuner.setOnSilence(() => {})();
      // reset display
      noteName.textContent  = '—';
      noteName.className    = 'note-name';
      noteFreqEl.textContent = '— Hz';
      stringLabel.textContent = 'Jouez une corde';
      needleTarget = 0;
      centsValueEl.textContent = '0';
      centsValueEl.style.color = '';
      tuningStatus.className = 'tuning-status';
      statusText.textContent = 'En attente…';
      stabilityFill.style.width = '0%';
      stabilityAvg.textContent = 'Moy. : — ¢';
    } else {
      micText.textContent = 'Connexion…';
      const ok = await Tuner.start();
      if (ok) {
        micBtn.classList.add('active');
        micText.textContent = 'Arrêter le micro';
      } else {
        micText.textContent = 'Accès refusé — réessayer';
        setTimeout(() => { micText.textContent = 'Activer le micro'; }, 2500);
      }
    }
  });

  // ════════════════════════════════════════════════════
  // MODULE 2 — POSITIONS
  // ════════════════════════════════════════════════════

  const neckCanvas   = document.getElementById('neck-canvas');
  const detailPanel  = document.getElementById('position-detail');
  const tooltip   = document.getElementById('neck-tooltip');
  let targetMidi = null;

  // ── Wire note cards → set as tuner target ────────────
  function wireNoteCards(preserveTarget = false) {
    if (!preserveTarget) {
      targetMidi = null;
      Tuner.setTargetFreq(null);
    }
    detailPanel.querySelectorAll('.note-card').forEach(card => {
      const midi = parseInt(card.dataset.midi);
      const freq = parseFloat(card.dataset.freq);
      if (targetMidi !== null && midi === targetMidi) {
        card.classList.add('targeted');
        Tuner.setTargetFreq(freq); // update freq for current aRef
      }
      card.addEventListener('click', () => {
        detailPanel.querySelectorAll('.note-card').forEach(c => c.classList.remove('targeted'));
        if (targetMidi === midi) {
          targetMidi = null;
          Tuner.setTargetFreq(null);
        } else {
          card.classList.add('targeted');
          targetMidi = midi;
          Tuner.setTargetFreq(freq);
        }
      });
    });
  }

  Positions.init(neckCanvas, detailPanel, (posData, str) => {
    panelState = { type: 'position', pos: posData, str };
    renderDetail(posData, Positions.getPositionNotes(posData, str, currentARef)); // wireNoteCards(false) inside
  });
  renderOpenString('G');

  document.getElementById('reset-pos-btn').addEventListener('click', () => {
    Positions.resetSelection();
    renderOpenString(lastPosStr);
  });

  // ── Refresh panel after aRef change ──────────────────
  function refreshDetailPanel() {
    if (panelState.type === 'open') {
      renderOpenString(panelState.str, true);
    } else {
      renderDetail(panelState.pos, Positions.getPositionNotes(panelState.pos, panelState.str, currentARef), true);
    }
  }

  // ── Render open string (default state) ───────────────
  function renderOpenString(str, preserveTarget = false) {
    panelState = { type: 'open', str };
    const note = Positions.getOpenStringNote(str, currentARef);
    detailPanel.innerHTML = `
      <div class="detail-header">
        <div class="detail-pos-name">Aucune position sélectionnée</div>
      </div>
      <div class="detail-card">
        <div class="detail-card-title">Corde à vide</div>
        <div class="notes-grid">
          <div class="note-card" data-freq="${note.freq}" data-midi="${note.midi}" data-name="${note.name}">
            <div class="note-card-name">${note.name}</div>
            <div class="note-card-name-en">${note.nameEN}</div>
            <div class="note-card-freq">${note.freq} Hz</div>
            <div class="note-card-finger">Corde à vide</div>
          </div>
        </div>
        <div style="font-size:.72rem;color:var(--text2);margin-top:8px;">
          Tapez une note pour la cibler à l'accordeur
        </div>
      </div>`;
    wireNoteCards(preserveTarget);
  }

  // ── Render position detail ────────────────────────────
  function renderDetail(pos, notes, preserveTarget = false) {
    const notesHTML = notes.map(n => `
      <div class="note-card" data-freq="${n.freq}" data-midi="${n.midi}" data-name="${n.name}">
        <div class="note-card-left">
          <div class="note-card-name">${n.name}</div>
          <div class="note-card-name-en">${n.nameEN}</div>
        </div>
        <div class="note-card-right">
          <div class="note-card-freq">${n.freq} Hz</div>
          <div class="note-card-finger">Doigt ${n.finger}</div>
        </div>
      </div>`).join('');

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div class="detail-pos-name">${pos.label}</div>
      </div>
      <div class="detail-card">
        <div class="detail-card-title">Notes disponibles</div>
        <div class="notes-grid">${notesHTML}</div>
        <div style="font-size:.72rem;color:var(--text2);margin-top:8px;">
          Tapez une note pour la cibler à l'accordeur
        </div>
      </div>`;

    wireNoteCards(preserveTarget);
  }

});
