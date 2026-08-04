// ---------------------------------------------------------------------------
// The Beale Street "picture roulette" bonus game - a 3-reel matching game
// modeled on the reference screenshot. Cards are placeholders for now;
// swap CARD_DEFS below with real image paths whenever they're ready (see
// README.md "Swapping in the real mini-game images").
// ---------------------------------------------------------------------------

const CARD_DEFS = [
  { id: 'a', label: 'DUCK', color: '#e5c14a' },
  { id: 'b', label: 'GTR',  color: '#c65b3a' },
  { id: 'c', label: 'BBQ',  color: '#a9432e' },
  { id: 'd', label: 'NOTE', color: '#3f7d5c' },
];
// To use real images instead of placeholders, set e.g.
//   CARD_DEFS[0].img = 'assets/card-duck.png'
// and loadCardImages() below will use it automatically once loaded.

const cardImageCache = {};
function loadCardImages() {
  CARD_DEFS.forEach(def => {
    if (def.img && !cardImageCache[def.id]) {
      const im = new Image();
      im.src = def.img;
      cardImageCache[def.id] = im;
    }
  });
}
loadCardImages();

function drawCard(ctx, def, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const cached = cardImageCache[def.id];
  if (cached && cached.complete && cached.naturalWidth > 0) {
    ctx.drawImage(cached, 0, 0, size, size);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = def.color;
    ctx.fillRect(4, 4, size - 8, size - 8);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(size * 0.18)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, size / 2, size / 2);
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.restore();
}

function createMinigame() {
  return {
    reels: [0, 1, 2].map(() => ({ spinning: true, spinSpeed: 0.35 + Math.random() * 0.15, offset: Math.random() * CARD_DEFS.length, symbol: 0 })),
    stopIndex: 0, // which reel stops next on button press
    resultTimer: 0,
    state: 'spinning', // spinning | won | lost
    won: false,
    attempts: 0,
  };
}

function resetMinigameSpin(mg) {
  mg.reels.forEach(r => { r.spinning = true; r.spinSpeed = 0.35 + Math.random() * 0.15; });
  mg.stopIndex = 0;
  mg.state = 'spinning';
}

function updateMinigame(mg, dt, input) {
  mg.reels.forEach(r => {
    if (r.spinning) {
      r.offset += r.spinSpeed * (dt / 16.67);
      r.symbol = Math.floor(r.offset) % CARD_DEFS.length;
    }
  });

  if (mg.state === 'lost') {
    mg.resultTimer -= dt;
    if (mg.resultTimer <= 0) resetMinigameSpin(mg);
  }
}

// Returns true if the button press was consumed (caller should not fall through)
function pressMinigameButton(mg) {
  if (mg.state !== 'spinning') return;
  const reel = mg.reels[mg.stopIndex];
  if (!reel || !reel.spinning) return;
  reel.spinning = false;
  Sfx.reelStop();
  mg.stopIndex++;

  if (mg.stopIndex >= mg.reels.length) {
    mg.attempts++;
    const symbols = mg.reels.map(r => r.symbol);
    const allMatch = symbols.every(s => s === symbols[0]);
    if (allMatch) {
      mg.state = 'won';
      mg.won = true;
      Sfx.win();
    } else {
      mg.state = 'lost';
      mg.resultTimer = 1500;
      Sfx.fail();
    }
  }
}
