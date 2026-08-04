// ---------------------------------------------------------------------------
// The hidden Beale Street room. All landmark art below is an original,
// simplified 8-bit-style silhouette rendering (not traced photography),
// drawn directly with canvas primitives since these are one-off background
// set pieces rather than repeating tile sprites.
// ---------------------------------------------------------------------------

function drawPyramid(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#b9c4cc';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s, s * 0.86);
  ctx.lineTo(0, s * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8fa0ab';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s, s * 0.86);
  ctx.lineTo(s * 0.5, s * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, s * 0.86 - 1, s, 3);
  ctx.restore();
}

function drawBridge(ctx, x, y, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#d8dde2';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#232838';
  ctx.fillRect(0, 40, w, 6);
  // two M-shaped arch towers (recognizable "M Bridge" silhouette)
  for (const cx of [w * 0.28, w * 0.72]) {
    ctx.beginPath();
    ctx.moveTo(cx - 34, 40);
    ctx.lineTo(cx - 14, -6);
    ctx.lineTo(cx, 14);
    ctx.lineTo(cx + 14, -6);
    ctx.lineTo(cx + 34, 40);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShell(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#e7ddc6';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.62, s * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#8a7a52';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.62);
    const ang = Math.PI + (i / 6) * Math.PI;
    ctx.lineTo(s * 0.5 + Math.cos(ang) * s * 0.5, s * 0.62 + Math.sin(ang) * s * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a7a52';
  ctx.fillRect(-6, s * 0.6, s + 12, 8);
  ctx.restore();
}

function drawNeonSign(ctx, x, y, text, color, t) {
  ctx.save();
  ctx.translate(x, y);
  const flicker = 0.75 + 0.25 * Math.sin(t / 220 + x);
  ctx.globalAlpha = flicker;
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawBrickBuilding(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let wy = y + 8; wy < y + h - 6; wy += 16) {
    for (let wx = x + 6; wx < x + w - 10; wx += 18) {
      ctx.fillRect(wx, wy, 8, 10);
    }
  }
}

function drawSecretRoom(ctx, w, h, t) {
  // sky
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a1035');
  grad.addColorStop(1, '#3a2060');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % w;
    const sy = (i * 53) % (h * 0.5);
    if ((Math.floor(t / 500) + i) % 7 === 0) continue;
    ctx.fillRect(sx, sy, 2, 2);
  }

  // river / bridge in far background
  drawBridge(ctx, w * 0.05, h * 0.18, w * 0.4);
  // pyramid
  drawPyramid(ctx, w * 0.55, h * 0.14, h * 0.32);
  // Overton Park Shell
  drawShell(ctx, w * 0.78, h * 0.42, h * 0.22);

  // street-level brick buildings (Beale St facades)
  const buildColors = ['#7a2f2f', '#8a4a2f', '#6a3350', '#7a5230'];
  let bx = 0, i = 0;
  while (bx < w) {
    const bw = 60 + (i % 3) * 20;
    const bh = h * 0.34 + (i % 2) * 20;
    drawBrickBuilding(ctx, bx, h * 0.62 - bh + h * 0.34, bw, bh, buildColors[i % buildColors.length]);
    bx += bw + 4;
    i++;
  }

  // neon signs
  drawNeonSign(ctx, w * 0.18, h * 0.5, 'BEALE ST', '#ff5fd1', t);
  drawNeonSign(ctx, w * 0.62, h * 0.56, 'BLUES', '#5fd1ff', t);
  drawNeonSign(ctx, w * 0.85, h * 0.7, 'BBQ', '#ffd15f', t);

  // string lights across the street
  ctx.strokeStyle = '#555';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  ctx.quadraticCurveTo(w * 0.5, h * 0.52, w, h * 0.44);
  ctx.stroke();
  for (let x = 10; x < w; x += 24) {
    const y = h * 0.46 + Math.sin((x / w) * Math.PI) * (h * 0.05);
    ctx.fillStyle = (Math.floor(t / 300) + x) % 5 === 0 ? '#ffd15f' : '#ff8f5f';
    ctx.beginPath();
    ctx.arc(x, y + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // street / sidewalk
  ctx.fillStyle = '#3a3038';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  ctx.fillStyle = '#4a4048';
  for (let x = 0; x < w; x += 40) ctx.fillRect(x, h * 0.82, 26, h * 0.18);
}
