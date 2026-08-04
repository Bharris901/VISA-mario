// ---------------------------------------------------------------------------
// DOM-facing HUD + message overlay helpers.
// ---------------------------------------------------------------------------

const UI = {
  scoreEl: null, coinEl: null, timeEl: null, livesEl: null, worldEl: null,
  messageOverlay: null, messageText: null, messageBtn: null,

  init() {
    this.scoreEl = document.getElementById('hud-score');
    this.coinEl = document.getElementById('hud-coin-count');
    this.timeEl = document.getElementById('hud-time-num');
    this.livesEl = document.getElementById('hud-lives');
    this.worldEl = document.getElementById('hud-world');
    this.messageOverlay = document.getElementById('message-overlay');
    this.messageText = document.getElementById('message-text');
    this.messageBtn = document.getElementById('message-btn');
  },

  updateHud(state) {
    this.scoreEl.textContent = String(state.score).padStart(6, '0');
    this.coinEl.textContent = String(state.coins).padStart(2, '0');
    this.timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    this.livesEl.textContent = String(state.livesDisplay);
  },

  showMessage(text, onContinue, buttonLabel = 'CONTINUE') {
    this.messageText.textContent = text;
    this.messageBtn.textContent = buttonLabel;
    this.messageOverlay.classList.remove('hidden');
    const handler = () => {
      this.messageOverlay.classList.add('hidden');
      this.messageBtn.removeEventListener('click', handler);
      if (onContinue) onContinue();
    };
    this.messageBtn.addEventListener('click', handler);
  },
};
