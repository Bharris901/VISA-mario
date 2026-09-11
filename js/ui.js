// ---------------------------------------------------------------------------
// DOM-facing HUD + message overlay helpers.
// ---------------------------------------------------------------------------

const UI = {
  scoreEl: null, coinEl: null, timeEl: null, livesEl: null, worldEl: null,
  messageOverlay: null, messageText: null, messageBtn: null, messageIcon: null,
  coinIconEl: null,
  lunchNoteOverlay: null, lunchNoteText: null, lunchNoteBtn: null,

  init() {
    this.scoreEl = document.getElementById('hud-score');
    this.coinEl = document.getElementById('hud-coin-count');
    this.timeEl = document.getElementById('hud-time-num');
    this.livesEl = document.getElementById('hud-lives');
    this.worldEl = document.getElementById('hud-world');
    this.messageOverlay = document.getElementById('message-overlay');
    this.messageText = document.getElementById('message-text');
    this.messageBtn = document.getElementById('message-btn');
    this.messageIcon = document.getElementById('message-icon');
    this.coinIconEl = document.getElementById('hud-coin-icon');
    this.lunchNoteOverlay = document.getElementById('lunch-note-overlay');
    this.lunchNoteText = document.getElementById('lunch-note-text');
    this.lunchNoteBtn = document.getElementById('lunch-note-btn');

    // Draw the real coin sprite into the HUD icon once (rather than an
    // emoji, which rendered as a dull silver glyph on iOS instead of gold).
    // Note: SPRITES is declared with `const` in sprites.js, so unlike `var`
    // it is NOT a property of `window` even though every script here shares
    // one global scope - reference it directly, not via `window.SPRITES`.
    if (this.coinIconEl) {
      const ictx = this.coinIconEl.getContext('2d');
      ictx.imageSmoothingEnabled = false;
      ictx.drawImage(SPRITES.coin, 0, 0, this.coinIconEl.width, this.coinIconEl.height);
    }
  },

  updateHud(state) {
    this.scoreEl.textContent = String(state.score).padStart(6, '0');
    this.coinEl.textContent = String(state.coins).padStart(2, '0');
    this.timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    this.livesEl.textContent = String(state.livesDisplay);
  },

  // `icon`, if given, is a baked sprite canvas (e.g. SPRITES.grimaceFace)
  // shown above the message text. `text` is rendered as HTML (not plain
  // text) so a message can bold a phrase or mark part of itself as a
  // smaller secondary hint (see the `.clue-hint` rule in style.css) -
  // every other message in the game is a plain string with no
  // HTML-significant characters, so this is a safe superset of the old
  // textContent behavior for them.
  showMessage(text, onContinue, buttonLabel = 'CONTINUE', icon = null) {
    this.messageText.innerHTML = text;
    this.messageBtn.textContent = buttonLabel;
    if (icon) {
      const ictx = this.messageIcon.getContext('2d');
      ictx.imageSmoothingEnabled = false;
      ictx.clearRect(0, 0, this.messageIcon.width, this.messageIcon.height);
      ictx.drawImage(icon, 0, 0, this.messageIcon.width, this.messageIcon.height);
      this.messageIcon.classList.remove('hidden');
    } else {
      this.messageIcon.classList.add('hidden');
    }
    this.messageOverlay.classList.remove('hidden');
    const handler = () => {
      this.messageOverlay.classList.add('hidden');
      this.messageBtn.removeEventListener('click', handler);
      if (onContinue) onContinue();
    };
    this.messageBtn.addEventListener('click', handler);
  },

  // A single-purpose, one-off screen (the "sit down for lunch" aside right
  // after the clue message) - a wide character-plus-speech-bubble layout
  // rather than the standard centered message card, so it gets its own
  // dedicated overlay/markup instead of a variant of showMessage() above.
  // Same button-handler pattern as showMessage() otherwise: `text` is HTML
  // for the same reason (a future edit might want to bold a word), and the
  // listener is added/removed per call rather than left permanently bound.
  showLunchNote(text, onContinue) {
    this.lunchNoteText.innerHTML = text;
    this.lunchNoteOverlay.classList.remove('hidden');
    const handler = () => {
      this.lunchNoteOverlay.classList.add('hidden');
      this.lunchNoteBtn.removeEventListener('click', handler);
      if (onContinue) onContinue();
    };
    this.lunchNoteBtn.addEventListener('click', handler);
  },
};
