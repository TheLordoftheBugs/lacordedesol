/**
 * app.js — Main controller: wires Tuner, Positions, AudioPlayer together
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Tab navigation ──────────────────────────────────
  const tabs     = document.querySelectorAll('.nav-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

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
    Tuner.setRefHz(parseInt(e.target.value));
  });

  // ── Mode buttons ─────────────────────────────────────
  let currentMode = 'pizzicato';
  document.querySelectorAll('.btn-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });

  // ── String selector ──────────────────────────────────
  document.querySelectorAll('.string-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.string-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Tuner.setTargetString(btn.dataset.string);
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
    const { cents, freq, nameWithOctave, string, stability, avgCents } = info;

    // Note name
    noteName.textContent = nameWithOctave;
    noteFreqEl.textContent = freq.toFixed(1) + ' Hz';
    stringLabel.textContent = string ? STRING_LABELS[string] || string : '';

    // Needle
    needleTarget = centsToAngle(cents);

    // Cents display
    centsValueEl.textContent = (cents >= 0 ? '+' : '') + cents;

    // Status
    const absCents = Math.abs(cents);
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

    // Sync string button highlight
    if (info.string) {
      document.querySelectorAll('.string-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.string === info.string);
      });
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
  const tooltip      = document.getElementById('neck-tooltip');
  const visualToggle = document.getElementById('visual-markers-toggle');
  let playingCard    = null;

  Positions.init(neckCanvas, detailPanel, (posData, notes) => {
    renderDetail(posData, notes);
  });

  // String selector for positions
  document.querySelectorAll('.pos-string-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-string-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Positions.setString(btn.dataset.str);
      // Clear detail
      detailPanel.innerHTML = `
        <div class="detail-placeholder">
          <div class="detail-icon">👆</div>
          <p>Tapez sur une position<br/>pour voir les détails</p>
        </div>`;
    });
  });

  // Visual markers toggle
  visualToggle.addEventListener('change', () => {
    Positions.setVisualMarkers(visualToggle.checked);
  });

  // ── Render position detail ────────────────────────────
  function renderDetail(pos, notes) {
    // Build fingering HTML
    const fingerHTML = pos.fingering.map((f, i) => `
      <div class="finger-chip">
        <span class="finger-num">${f.finger}</span>
        <span class="finger-note">${notes[i] ? notes[i].name : ''}</span>
      </div>`).join('');

    // Build notes grid HTML
    const notesHTML = notes.map(n => `
      <div class="note-card" data-freq="${n.freq}" data-name="${n.name}">
        <div class="note-card-name">${n.name}</div>
        <div class="note-card-name-en">${n.nameEN}</div>
        <div class="note-card-freq">${n.freq} Hz</div>
        <div class="note-card-finger">Doigt ${n.finger}</div>
      </div>`).join('');

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div class="detail-pos-name">${pos.label}</div>
        <div class="detail-pos-sub">${pos.description}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-title">Notes disponibles</div>
        <div class="notes-grid">${notesHTML}</div>
        <div style="font-size:.72rem;color:var(--text2);margin-top:8px;">
          Tapez une note pour écouter la référence
        </div>
      </div>

    `;

    // Note card click → play audio
    detailPanel.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => {
        if (playingCard) playingCard.classList.remove('playing');
        AudioPlayer.stop();
        if (playingCard === card) {
          playingCard = null;
          return;
        }
        card.classList.add('playing');
        playingCard = card;
        const freq = parseFloat(card.dataset.freq);
        AudioPlayer.playFreq(freq, 3, currentMode);
        setTimeout(() => {
          card.classList.remove('playing');
          if (playingCard === card) playingCard = null;
        }, 3100);
      });
    });
  }

});
