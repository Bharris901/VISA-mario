// ---------------------------------------------------------------------------
// The Beale Street bonus game: a classic 20-card memory match (10 pairs).
// Cards are drawn procedurally (not baked pixel sprites) so icon art stays
// crisp at whatever card size the layout needs. Winning triggers a treasure
// chest sequence (js/main.js owns that state machine; this file owns the
// card grid + the physical burst/scatter simulation).
// ---------------------------------------------------------------------------

const CARD_ICONS = ['memphis', 'grizzlies', 'redbirds', 'elvis', 'pyramid', 'duck', 'guitar', 'bridge', 'lorraine', 'stjude'];

// Real user-provided artwork for 5 of the 10 icons (the other 5 stay
// procedurally drawn below). These files are used as-is - never re-touched,
// re-pixelated, or otherwise edited - just scaled down to fit the card.
const CARD_PHOTOS = {
  elvis: 'assets/card-elvis.png',
  grizzlies: 'assets/card-grizzlies.png',
  guitar: 'assets/card-guitar.png',
  lorraine: 'assets/card-lorraine.png',
  bridge: 'assets/card-bridge.png',
};
const cardPhotoImages = {};
const cardPhotoLoaded = {};
function loadCardPhotos() {
  Object.entries(CARD_PHOTOS).forEach(([id, src]) => {
    const img = new Image();
    cardPhotoImages[id] = img;
    cardPhotoLoaded[id] = false;
    img.onload = () => { cardPhotoLoaded[id] = true; };
    img.src = src;
  });
}

function shuffleDeck(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Original pixel-art interpretations of each Memphis icon (not traced from
// any source image - hand-drawn from general knowledge of each mark) drawn
// with canvas primitives into a size x size box centered at (cx, cy). Five
// of the ten ids (see CARD_PHOTOS above) instead draw the real provided
// artwork once it's loaded - the procedural version below still renders as
// a brief fallback for those five while the image loads.
function drawCardIcon(ctx, id, cx, cy, size) {
  if (CARD_PHOTOS[id] && cardPhotoLoaded[id]) {
    const img = cardPhotoImages[id];
    // "Contain" fit - shrink to fit inside the size x size box without
    // cropping (unlike the Beale backdrop's "cover" fit), since these are
    // discrete pieces of art that need to stay fully visible, not a
    // fill-the-frame background.
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    // Same reasoning as the Beale Street backdrop fix: the shared canvas
    // context has imageSmoothingEnabled = false globally (js/main.js) so
    // the game's pixel-art sprites stay crisp, which would otherwise make
    // this downscale blocky/aliased. Scope smoothing to just this draw.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  const s = size / 40;
  const rr = (x, y, w, h, r) => roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineWidth = 1;
  switch (id) {
    case 'memphis': { // University of Memphis - tiger paw
      ctx.fillStyle = '#003087';
      ctx.beginPath(); ctx.ellipse(0, 6, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
      const toe = (tx, ty) => { ctx.beginPath(); ctx.ellipse(tx, ty, 5, 6, 0, 0, Math.PI * 2); ctx.fill(); };
      toe(-11, -8); toe(-4, -14); toe(4, -14); toe(11, -8);
      ctx.fillStyle = '#8a8d8f';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('M', 0, 10);
      break;
    }
    case 'grizzlies': { // bear head
      ctx.fillStyle = '#12173d';
      ctx.beginPath(); ctx.arc(0, 2, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-11, -9, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -9, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fdb927';
      ctx.beginPath(); ctx.arc(-11, -9, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -9, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6d7079';
      ctx.beginPath(); ctx.ellipse(0, 8, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 8, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, -2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -2, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'redbirds': { // cardinal
      ctx.fillStyle = '#c8102e';
      ctx.beginPath(); ctx.ellipse(0, 5, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(5, -18); ctx.lineTo(11, -14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8f0c22';
      ctx.beginPath(); ctx.ellipse(-4, 6, 6, 4, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a33d';
      ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(19, -4); ctx.lineTo(14, -3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(10, -7, 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'elvis': { // pompadour + sideburns + sunglasses
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(0, -6, 11, Math.PI, 0); ctx.fill();
      rr(-13, -8, 4, 12, 2); ctx.fill();
      rr(9, -8, 4, 12, 2); ctx.fill();
      ctx.fillStyle = '#000';
      rr(-8, -1, 6, 2.5, 1); ctx.fill();
      rr(2, -1, 6, 2.5, 1); ctx.fill();
      rr(-2, -0.5, 4, 1.2, 0.5); ctx.fill();
      ctx.fillStyle = '#c8102e';
      rr(-4, 8, 8, 3, 1); ctx.fill();
      break;
    }
    case 'pyramid': {
      ctx.fillStyle = '#b9c4cc';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(15, 12); ctx.lineTo(-15, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8fa0ab';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(15, 12); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-15 + i * 7.5, 12); ctx.stroke(); }
      break;
    }
    case 'duck': { // Peabody Hotel mallard
      ctx.fillStyle = '#c97a3d';
      ctx.beginPath(); ctx.ellipse(0, 6, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e6b3e';
      ctx.beginPath(); ctx.arc(9, -4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      rr(3, 0, 10, 2.5, 1); ctx.fill();
      ctx.fillStyle = '#e8a33d';
      ctx.beginPath(); ctx.moveTo(15, -4); ctx.lineTo(21, -3); ctx.lineTo(15, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(10, -6, 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'guitar': {
      ctx.fillStyle = '#8a4a1c';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -3, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2010';
      ctx.beginPath(); ctx.arc(0, 9, 3, 0, Math.PI * 2); ctx.fill();
      rr(-1.5, -18, 3, 16, 1); ctx.fill();
      ctx.strokeStyle = '#e8c88a'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-2.5 + i * 1.7, -17); ctx.lineTo(-2.5 + i * 1.7, 14); ctx.stroke(); }
      break;
    }
    case 'bridge': { // Hernando de Soto (M) bridge
      ctx.strokeStyle = '#c7ccd1'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-17, 10); ctx.lineTo(17, 10); ctx.stroke();
      [-9, 9].forEach(bx => {
        ctx.beginPath();
        ctx.moveTo(bx - 8, 10); ctx.quadraticCurveTo(bx, -12, bx + 8, 10); ctx.stroke();
      });
      break;
    }
    case 'lorraine': {
      ctx.fillStyle = '#fff'; rr(-15, -14, 30, 26, 2); ctx.fill();
      ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 2; roundRect(ctx, -15, -14, 30, 26, 2); ctx.stroke();
      ctx.fillStyle = '#1c3f94'; rr(-15, -14, 30, 6, 2); ctx.fill();
      ctx.fillStyle = '#c8102e';
      ctx.font = 'bold 6px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LORRAINE', 0, -1);
      ctx.fillText('MOTEL', 0, 8);
      ctx.fillStyle = '#ffd400';
      [[-11, -16], [11, -16]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, Math.PI * 2); ctx.fill(); });
      break;
    }
    case 'stjude': {
      ctx.fillStyle = '#c8102e';
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(4, -4); ctx.lineTo(14, 0); ctx.lineTo(4, 4);
      ctx.lineTo(0, 14); ctx.lineTo(-4, 4); ctx.lineTo(-14, 0); ctx.lineTo(-4, -4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 5px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ST JUDE', 0, 19);
      break;
    }
  }
  ctx.restore();
}

function drawCardBack(ctx, x, y, w, h) {
  ctx.fillStyle = '#4b1f7a';
  roundRect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = '#2c1050'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 5); ctx.stroke();
  ctx.fillStyle = '#c9a6ff';
  ctx.font = `bold ${Math.floor(h * 0.5)}px "Courier New", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('M', x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawCardFace(ctx, x, y, w, h, iconId) {
  ctx.fillStyle = '#fff';
  roundRect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 5); ctx.stroke();
  drawCardIcon(ctx, iconId, x + w / 2, y + h / 2, Math.min(w, h) * 0.82);
}

// marioFootX/marioTopY: where Mario is standing (he stays visible in place
// for the whole mini-game, not just the fall-in intro) - the grid shifts
// right just enough to clear him, and the pile of matched cards builds up
// just above his head.
function createMemoryGame(viewW, viewH, marioFootX, marioTopY) {
  const deck = shuffleDeck([...CARD_ICONS, ...CARD_ICONS]);
  const cols = 5, rows = 4;
  const gap = 6;
  const cardW = 58, cardH = 44;
  const gridW = cols * cardW + (cols - 1) * gap;
  const gridH = rows * cardH + (rows - 1) * gap;
  const marioClearance = marioFootX + cardW / 2 + 14;
  const startX = Math.max((viewW - gridW) / 2, marioClearance);
  const startY = (viewH - gridH) / 2 + 6;
  const cards = deck.map((icon, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    return {
      icon, matched: false, flipped: false, flipT: 0,
      x: startX + col * (cardW + gap), y: startY + row * (cardH + gap),
      w: cardW, h: cardH,
      vx: 0, vy: 0, rot: 0, vrot: 0,
    };
  });
  // Where matched pairs pile up: directly above Mario's head, with a small
  // gap so the pile never visually touches him - the treasure chest gets a
  // fixed spot to burst out from behind once the last pair is found.
  const pileX = marioFootX - cardW / 2;
  const pileY = marioTopY - cardH - 10;
  return {
    cards, cardW, cardH,
    flippedIndices: [], mismatchTimer: 0, matchesFound: 0,
    pileX, pileY,
    boxX: 0, boxY: 0, boxVx: 0, boxVy: 0, boxLanded: false, boxTargetX: viewW * 0.82,
  };
}

// Returns true if all 10 pairs are now found (caller advances the scene).
function handleCardTap(mg, x, y) {
  if (mg.mismatchTimer > 0 || mg.flippedIndices.length >= 2) return false;
  for (let i = 0; i < mg.cards.length; i++) {
    const c = mg.cards[i];
    if (c.matched || c.flipped) continue;
    if (x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) continue;

    c.flipped = true;
    mg.flippedIndices.push(i);
    Sfx.cardFlip();
    if (mg.flippedIndices.length === 2) {
      const [ia, ib] = mg.flippedIndices;
      if (mg.cards[ia].icon === mg.cards[ib].icon) {
        mg.cards[ia].matched = true; mg.cards[ib].matched = true;
        mg.matchesFound++;
        mg.flippedIndices = [];
        Sfx.cardMatch();
        const cx = (mg.cards[ia].x + mg.cards[ia].w / 2 + mg.cards[ib].x + mg.cards[ib].w / 2) / 2;
        const cy = (mg.cards[ia].y + mg.cards[ib].y) / 2 + mg.cardH / 2;
        for (let p = 0; p < 10; p++) {
          const angle = Math.random() * Math.PI * 2;
          game.particles.push({
            x: cx, y: cy, type: 'firework',
            vx: Math.cos(angle) * (0.8 + Math.random()), vy: Math.sin(angle) * (0.8 + Math.random()) - 1,
            life: 450 + Math.random() * 200, maxLife: 650,
            color: ['#ffe15f', '#c9a6ff', '#5fff8f'][p % 3],
          });
        }
        // Both cards of the pair slide into the shared pile to the left of
        // the grid (not just onto each other) - a small deterministic jitter
        // per pair keeps the pile looking like a messy stack of cards rather
        // than one perfectly aligned block.
        const pairIndex = mg.matchesFound - 1;
        const jitterX = ((pairIndex * 37) % 9) - 4;
        const jitterY = ((pairIndex * 53) % 9) - 4;
        mg.cards[ia]._stackTargetX = mg.pileX + jitterX;
        mg.cards[ia]._stackTargetY = mg.pileY + jitterY;
        mg.cards[ib]._stackTargetX = mg.pileX + jitterX + 1;
        mg.cards[ib]._stackTargetY = mg.pileY + jitterY + 1;
      } else {
        mg.mismatchTimer = 700;
        Sfx.cardMiss();
      }
    }
    return mg.matchesFound >= 10;
  }
  return false;
}

function updateMemoryGame(mg, dt) {
  if (mg.mismatchTimer > 0) {
    mg.mismatchTimer -= dt;
    if (mg.mismatchTimer <= 0) {
      mg.flippedIndices.forEach(i => { mg.cards[i].flipped = false; });
      mg.flippedIndices = [];
    }
  }
  mg.cards.forEach(c => {
    const target = (c.flipped || c.matched) ? 1 : 0;
    c.flipT += (target - c.flipT) * Math.min(1, dt / 90);
    if (c._stackTargetX !== undefined) {
      c.x += (c._stackTargetX - c.x) * Math.min(1, dt / 120);
      c.y += (c._stackTargetY - c.y) * Math.min(1, dt / 120);
    }
  });
}

function startTreasureBurst(mg, viewW, viewH) {
  mg.cards.forEach(c => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    c.vx = Math.cos(angle) * speed;
    c.vy = Math.sin(angle) * speed - 2;
    c.vrot = (Math.random() - 0.5) * 0.3;
  });
  // The chest starts right at the card pile (all 20 cards end up clustered
  // there once the 10th pair matches) so it visibly bursts out from behind
  // the pile, then arcs over to land on the ground on the right.
  mg.boxX = mg.pileX + mg.cardW / 2; mg.boxY = mg.pileY + mg.cardH / 2 - 8;
  mg.boxVx = 3.0; mg.boxVy = -3.4;
  mg.boxLanded = false;
  Sfx.treasureBurst();
}

function updateTreasureBurst(mg, dt, groundY) {
  const dtScale = dt / 16.67;
  mg.cards.forEach(c => {
    c.x += c.vx * dtScale; c.y += c.vy * dtScale; c.vy += 0.16 * dtScale;
    c.rot = (c.rot || 0) + c.vrot * dtScale;
  });
  if (!mg.boxLanded) {
    // X (reaching the target spot on the right) and Y (falling to the
    // ground) are resolved independently, and "landed" only fires once
    // *both* are done - not as soon as gravity happens to bring it down.
    // The chest now bursts from the card pile (near the left edge, close to
    // ground level already) rather than screen-center, so the vertical drop
    // alone is short; if landing were gated on Y only, the chest would touch
    // down mid-flight, well short of the intended right-side spot, and just
    // stop there instead of continuing over.
    if (mg.boxY < groundY) {
      mg.boxVy += 0.22 * dtScale;
      mg.boxY += mg.boxVy * dtScale;
      if (mg.boxY >= groundY) { mg.boxY = groundY; mg.boxVy = 0; }
    }
    if (mg.boxX < mg.boxTargetX) {
      mg.boxX += mg.boxVx * dtScale;
      if (mg.boxX >= mg.boxTargetX) { mg.boxX = mg.boxTargetX; mg.boxVx = 0; }
    }
    if (mg.boxY >= groundY && mg.boxX >= mg.boxTargetX) {
      mg.boxLanded = true;
      Sfx.thud();
      return true; // just landed
    }
  }
  return false;
}

function drawTreasureBox(ctx, cx, footY, scale, openAmount) {
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#8a5a2c';
  roundRect(ctx, -16, -14, 32, 14, 2); ctx.fill();
  ctx.fillStyle = '#c99a4a';
  roundRect(ctx, -16, -14, 32, 3, 1); ctx.fill();
  ctx.fillStyle = '#5a3a1a';
  roundRect(ctx, -3, -10, 6, 6, 1); ctx.fill();

  if (openAmount > 0.15) {
    ctx.globalAlpha = Math.min(1, openAmount) * 0.85;
    const g = ctx.createRadialGradient(0, -16, 2, 0, -16, 24);
    g.addColorStop(0, 'rgba(255,244,180,0.95)');
    g.addColorStop(1, 'rgba(255,244,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -16, 24, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(-openAmount * (Math.PI * 0.62));
  ctx.fillStyle = '#a5703a';
  roundRect(ctx, -16, -10, 32, 10, 4); ctx.fill();
  ctx.fillStyle = '#c99a4a';
  roundRect(ctx, -16, -3, 32, 3, 1); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawMemoryGrid(ctx, mg) {
  mg.cards.forEach(c => {
    ctx.save();
    const squish = Math.max(0.06, Math.abs(1 - 2 * Math.min(c.flipT, 1)));
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    if (c.rot) ctx.rotate(c.rot);
    ctx.scale(squish, 1);
    ctx.translate(-c.w / 2, -c.h / 2);
    if (c.flipT > 0.5) drawCardFace(ctx, 0, 0, c.w, c.h, c.icon);
    else drawCardBack(ctx, 0, 0, c.w, c.h);
    ctx.restore();
  });
}
