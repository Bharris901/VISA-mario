// ---------------------------------------------------------------------------
// The hidden Beale Street scene: a real pixel-art skyline photo as the
// backdrop, with Mario drawn *procedurally* (arcs/rounded-rects) rather than
// as a tiny baked pixel sprite - he needs to read clearly at a much larger
// size here than anywhere else in the game (see BEALE_MARIO_HEIGHT), and
// smooth shape primitives scale far better than blowing up an 16px sprite.
// ---------------------------------------------------------------------------

const bealeBgImage = new Image();
let bealeBgLoaded = false;
function loadBealeAssets() {
  bealeBgImage.onload = () => { bealeBgLoaded = true; };
  bealeBgImage.src = 'assets/beale-street-bg.png';
}

// Ground (top of the sidewalk) as a fraction of canvas height, measured
// against the reference photo's foreground plaza.
const BEALE_GROUND_Y_FRAC = 0.83;
const BEALE_MARIO_HEIGHT = 92; // on-screen px - tall enough to read against the
                                // photo's stone railing/sidewalk scale

function drawBealeBackground(ctx, w, h) {
  if (bealeBgLoaded && bealeBgImage.naturalWidth > 0) {
    const iw = bealeBgImage.naturalWidth, ih = bealeBgImage.naturalHeight;
    const scale = Math.max(w / iw, h / ih); // "cover" fit, crop overflow
    const dw = iw * scale, dh = ih * scale;
    // main.js sets ctx.imageSmoothingEnabled = false globally so the game's
    // pixel-art sprites stay crisp - but that same setting makes a *photo*
    // look blocky/aliased when downscaled. This is the one draw call on the
    // whole canvas that isn't pixel art, so re-enable smoothing just for it
    // (save/restore scopes it to this call only; smoothing has no effect on
    // the procedural Mario/card/UI vector drawing elsewhere in this scene,
    // only on drawImage, so nothing else needs to toggle it back).
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bealeBgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    // brief fallback while the image loads
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1045'); g.addColorStop(1, '#c9451f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

function bealeGroundY(h) { return h * BEALE_GROUND_Y_FRAC; }

// pose: 'stand' | 'walk1' | 'walk2' | 'fall'
function drawBealeMario(ctx, footX, footY, heightPx, pose, facing = 1) {
  const scale = heightPx / 48; // sprite authored in ~48-unit-tall local space
  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(scale * facing, scale);

  const walking = pose === 'walk1' || pose === 'walk2';
  const legSwing = pose === 'walk1' ? 3.5 : pose === 'walk2' ? -3.5 : 0;
  const armSwing = pose === 'walk1' ? -3 : pose === 'walk2' ? 3 : 0;
  const falling = pose === 'fall';

  const rr = (x, y, w, hh, r) => { roundRect(ctx, x, y, w, hh, r); };

  // shoes
  ctx.fillStyle = '#3a2010';
  rr(-9 - legSwing * 0.3, -6, 8, 6, 2); ctx.fill();
  rr(1 + legSwing * 0.3, -6, 8, 6, 2); ctx.fill();

  // legs
  ctx.fillStyle = '#2255cc';
  rr(-8 - legSwing * 0.3, -16, 6, 11, 2); ctx.fill();
  rr(2 + legSwing * 0.3, -16, 6, 11, 2); ctx.fill();

  // overalls body
  ctx.fillStyle = '#2255cc';
  rr(-10, -28, 20, 13, 3); ctx.fill();

  // shirt collar band
  ctx.fillStyle = '#e5261f';
  rr(-12, -30, 24, 6, 3); ctx.fill();

  // arms (behind torso edges, sleeve + glove)
  const armBaseY = falling ? -33 : -27;
  const armEndY = falling ? -41 : (walking ? -15 : -16);
  ctx.fillStyle = '#e5261f';
  rr(-15, armBaseY + armSwing * 0.3, 6, 12, 3); ctx.fill();
  rr(9, armBaseY - armSwing * 0.3, 6, 12, 3); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-12, armEndY + armSwing * 0.3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, armEndY - armSwing * 0.3, 4, 0, Math.PI * 2); ctx.fill();

  // straps + buttons
  ctx.fillStyle = '#1a3f99';
  rr(-8, -30, 3, 8, 1); ctx.fill();
  rr(5, -30, 3, 8, 1); ctx.fill();
  ctx.fillStyle = '#ffd400';
  ctx.beginPath(); ctx.arc(-6.5, -24, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6.5, -24, 1.6, 0, Math.PI * 2); ctx.fill();

  // head
  ctx.fillStyle = '#ffcf9e';
  ctx.beginPath(); ctx.arc(0, -38, 8, 0, Math.PI * 2); ctx.fill();

  // sideburns
  ctx.fillStyle = '#4a2e12';
  rr(-8, -40, 2, 5, 1); ctx.fill();
  rr(6, -40, 2, 5, 1); ctx.fill();

  // mustache
  ctx.fillStyle = '#4a2e12';
  rr(-5, -35, 10, 3, 1.5); ctx.fill();

  // eyes
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-3, -39.5, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -39.5, 1.1, 0, Math.PI * 2); ctx.fill();

  // cap
  ctx.fillStyle = '#e5261f';
  ctx.beginPath(); ctx.arc(0, -42, 9, Math.PI, 0); ctx.fill();
  rr(-10, -43, 20, 4, 2); ctx.fill();
  rr(-13, -40, 9, 3, 1.5); ctx.fill();

  ctx.restore();
}

// Word-wrapped speech bubble with a tail pointing down at (tipX, tipY).
function drawSpeechBubble(ctx, tipX, tipY, text, maxWidth) {
  ctx.font = 'bold 12px "Courier New", monospace';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth - 24 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH = 16;
  const bw = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24);
  const bh = lines.length * lineH + 18;
  const bx = Math.max(6, Math.min(tipX - bw / 2, ctx.canvas.width / (window.devicePixelRatio || 1) - bw - 6));
  const by = tipY - bh - 14;

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill(); ctx.stroke();

  // tail
  ctx.beginPath();
  ctx.moveTo(tipX - 7, by + bh - 1);
  ctx.lineTo(tipX, tipY - 2);
  ctx.lineTo(tipX + 9, by + bh - 1);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tipX - 7, by + bh - 1);
  ctx.lineTo(tipX, tipY - 2);
  ctx.lineTo(tipX + 9, by + bh - 1);
  ctx.strokeStyle = '#000';
  ctx.stroke();
  // cover the seam where the tail meets the box border
  ctx.fillStyle = '#fff';
  ctx.fillRect(tipX - 6, by + bh - 2, 14, 2);

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    ctx.fillText(l, bx + bw / 2, by + 16 + i * lineH);
  });
}
