// ---------------------------------------------------------------------------
// Game orchestration: scene/state machine, camera, render loop.
// ---------------------------------------------------------------------------

// !!! Put the real scavenger-hunt clue text here before the event. !!!
const CLUE_MESSAGE =
  "🎉 YOU FOUND IT!\n\n[PLACEHOLDER — insert real scavenger-hunt clue text here]";

const NOT_FOUND_MESSAGE = "You didn't find the hidden clue.\nStart over to try again.";
const FOUND_BUT_FINISHED_MESSAGE =
  "🏁 Level complete!\nYou already found the hidden clue — good luck with the rest of the hunt!";

const ASSIST_MODE_DEATH_THRESHOLD = 3;
const MARIO_DRAW_SCALE = 1.5; // native sprite px -> on-screen px

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;

// Deep copy of the level grid so a "death" can restore any broken/used blocks.
const ORIGINAL_GRID = LEVEL.grid.map(row => row.slice());
function resetLevelTiles() {
  for (let r = 0; r < ROWS; r++) LEVEL.grid[r] = ORIGINAL_GRID[r].slice();
}

const game = {
  state: 'start', // start | playing | pipeEnter | secretRoom | minigame | flagSlide | frozen
  player: null,
  enemies: [],
  mushrooms: [],
  particles: [], // {x,y,life,text?}
  cameraX: 0,
  score: 0,
  coins: 0,
  extraLives: 0,
  timeLeft: 400,
  clueFound: false,
  deathCount: 0,
  assistMode: false,
  pipeAnimTimer: 0,
  secretRoomTimer: 0,
  flagSlideTimer: 0,
  flagSlideStartY: 0,
  minigame: null,
  paused: false,
};

function resetLevel() {
  resetLevelTiles();
  game.player = createPlayer();
  game.enemies = ENTITY_SPAWNS.map(s => s.type === 'goomba' ? createGoomba(s.col) : createKoopa(s.col));
  game.mushrooms = [];
  game.particles = [];
  game.score = 0;
  game.coins = 0;
  game.extraLives = 0;
  game.timeLeft = 400;
  game.clueFound = false;
  game.cameraX = 0;
  game.state = 'playing';
}

// Used for any "start fresh" button (death's Start Over, the flagpole's
// Play Again) so the music always begins again from the top of the loop -
// not used for the mini-game win continue, which resumes play in place.
function restartLevel() {
  Sfx.stopMusic();
  Sfx.startMusic();
  resetLevel();
}

// --- world callbacks passed into player/enemy update code ---
const world = {
  addCoin() { game.coins++; game.score += 200; },
  spawnBlockPop(col, row) {
    game.particles.push({ x: col * TILE, y: row * TILE, life: 300, type: 'pop' });
  },
  spawnBrickParticles(col, row) {
    for (let i = 0; i < 4; i++) {
      game.particles.push({
        x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
        vx: (i < 2 ? -1 : 1) * (1 + Math.random()), vy: -3 - Math.random() * 2,
        life: 600, type: 'brick',
      });
    }
    game.score += 50;
  },
  spawnCoinPop(col, row) {
    // A coin that pops up out of the block and falls back, rather than the
    // old plain fading square - reuses the same gold coin art as the HUD.
    game.particles.push({
      x: col * TILE + TILE / 2 - 8, y: row * TILE,
      vx: 0, vy: -4.2, life: 550, type: 'coin',
    });
  },
  spawnMushroom(col, row, kind) {
    game.mushrooms.push(createMushroom(col, row, kind));
  },
  spawnFloatingText(x, y, text, color) {
    game.particles.push({ x, y, vy: -0.7, life: 900, type: 'text', text, color });
  },
  spawnFireworks(x, y) {
    const colors = ['#ff5f5f', '#5fd1ff', '#ffe15f', '#5fff8f', '#d15fff', '#ff9f5f'];
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.3 + Math.random() * 2.4;
      game.particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
        life: 650 + Math.random() * 350, maxLife: 1000,
        type: 'firework', color: colors[i % colors.length],
      });
    }
  },
  enterSecretPipe() {
    if (game.state !== 'playing') return;
    game.state = 'pipeEnter';
    game.pipeAnimTimer = 0;
    game.player.inPipe = true;
    game.player.vx = 0; game.player.vy = 0;
    Sfx.pipe();
  },
  denyDescend() {
    Sfx.denied();
  },
  onPlayerDeath(reason) {
    if (game.player.dead) return;
    game.player.dead = true;
    game.deathCount++;
    if (game.deathCount >= ASSIST_MODE_DEATH_THRESHOLD) game.assistMode = true;
    Sfx.die();
    game.state = 'frozen';
    setTimeout(() => {
      UI.showMessage('Try again Memphis Mario!', () => restartLevel(), 'START OVER', SPRITES.grimaceFace);
    }, 500);
  },
};

function checkEnemyCollisions() {
  const p = game.player;
  if (p.dead || p.inPipe) return;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (!aabbOverlap(p, e)) continue;

    // Require real downward motion (not just barely-positive residual
    // gravity) and a shallow overlap into the enemy's top edge - the old
    // "< 10" tolerance was more than half a goomba's height (16px), so an
    // approach from the side often misread as a stomp: the enemy died and
    // Mario took no damage, which looked like "nothing happened."
    const stomping = p.vy > 1 && (p.y + p.h) - e.y < 6;

    if (e.type === 'koopa' && e.shell && Math.abs(e.shellVx) > 1.5) {
      // moving shell hits player
      if (game.assistMode || p.hurtInvuln > 0) continue;
      shrinkPlayer(p, world);
      continue;
    }

    if (stomping) {
      if (e.type === 'goomba') {
        e.dead = true; e.squished = 300;
        game.score += 100;
      } else if (e.type === 'koopa') {
        if (!e.shell) { e.shell = true; e.shellVx = 0; e.h = 16; e.y += 8; }
        else if (e.shellVx !== 0) { e.shellVx = 0; }
        else { e.shellVx = p.facing * 3; }
        game.score += 100;
      }
      p.vy = -6.5;
      Sfx.stomp();
    } else {
      if (e.type === 'koopa' && e.shell && e.shellVx === 0) {
        // kick a resting shell
        e.shellVx = (p.x < e.x ? 1 : -1) * 3;
        continue;
      }
      if (game.assistMode || p.hurtInvuln > 0) continue;
      shrinkPlayer(p, world);
    }
  }

  // Mushroom pickup
  for (const m of game.mushrooms) {
    if (m.collected) continue;
    if (aabbOverlap(p, m)) {
      m.collected = true;
      if (m.kind === '1up') {
        game.extraLives++;
        game.score += 1000;
        Sfx.powerup();
        world.spawnFloatingText(p.x, p.y - 12, '1UP', '#5fff8f');
      } else {
        growPlayer(p);
        game.score += 1000;
      }
    }
  }
  game.mushrooms = game.mushrooms.filter(m => !m.collected);
}

function checkFlagpole() {
  const p = game.player;
  if (p.dead || p.inPipe) return;
  if (p.x + p.w / 2 >= FLAG_COL * TILE) {
    // Grab the pole at whatever height it's touched (including landing on
    // top of it from a jump off the final staircase) and slide down to the
    // bottom - the message/fireworks/music-stop happen once he lands, not
    // the instant he touches the pole.
    game.state = 'flagSlide';
    game.player.x = FLAG_COL * TILE + (TILE - p.w) / 2;
    game.player.vx = 0; game.player.vy = 0;
    game.flagSlideTimer = 0;
    game.flagSlideStartY = game.player.y;
    Sfx.bump();
  }
}

function finishFlagpole() {
  game.state = 'frozen';
  Sfx.stopMusic();
  Sfx.win();
  const p = game.player;
  const baseX = p.x + p.w / 2, baseY = p.y;
  world.spawnFireworks(baseX, baseY - 20);
  Sfx.firework();
  setTimeout(() => { world.spawnFireworks(baseX - 20, baseY - 40); Sfx.firework(); }, 220);
  setTimeout(() => { world.spawnFireworks(baseX + 20, baseY - 30); Sfx.firework(); }, 440);
  const msg = game.clueFound ? FOUND_BUT_FINISHED_MESSAGE : NOT_FOUND_MESSAGE;
  setTimeout(() => {
    UI.showMessage(msg, () => restartLevel(), 'PLAY AGAIN');
  }, 900);
}

// --- Rendering ---
function drawBackground(camX) {
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // parallax hills/bushes/clouds
  const cloudPar = camX * 0.3;
  for (let i = 0; i < 14; i++) {
    const x = i * 220 - (cloudPar % 220) - 100;
    drawSprite(SPRITES.cloud, x, 24 + (i % 3) * 10, 48, 24);
  }
  const bushPar = camX * 0.6;
  for (let i = 0; i < 20; i++) {
    const x = i * 180 - (bushPar % 180) - 100;
    drawSprite(SPRITES.bush, x, VIEW_H - TILE - 20, 60, 20);
  }
}

function drawSprite(img, x, y, w, h) {
  ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
}

function tileSprite(ch) {
  switch (ch) {
    case '#': return SPRITES.groundTile;
    case '?': return SPRITES.questionBlock;
    case 'x': return SPRITES.usedBlock;
    case 'B': return SPRITES.brickTile;
    case 'C': return SPRITES.solidBlock;
    case 'T': case 'g': return SPRITES.pipeTop;
    case 'U': case 'h': return null; // right cap drawn as part of left-cap image (double-wide draw handled below)
    case 'P': case 'G': return SPRITES.pipeBody;
    case 'F': return SPRITES.flagpoleTile;
    default: return null;
  }
}

function drawLevel(camX) {
  const firstCol = Math.max(0, Math.floor(camX / TILE) - 1);
  const lastCol = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  for (let col = firstCol; col <= lastCol; col++) {
    for (let row = 0; row < ROWS; row++) {
      const ch = tileAt(col, row);
      if (ch === ' ' || ch === 'U' || ch === 'h') continue;
      const spr = tileSprite(ch);
      if (!spr) continue;
      const x = col * TILE - camX;
      const y = row * TILE;
      if (isPipeCap(ch)) {
        drawSprite(spr, x, y, TILE * 2, TILE);
      } else {
        drawSprite(spr, x, y, TILE, TILE);
      }
    }
  }
  // Ball finial + pennant at the top of the (deliberately shortened) pole,
  // so the top is always clearly visible with sky above it.
  const poleTopY = FLAG_TOP_ROW * TILE;
  const poleCenterX = FLAG_COL * TILE - camX + TILE / 2;
  drawSprite(SPRITES.ball, poleCenterX - 8, poleTopY - 12, 16, 16);
  drawSprite(SPRITES.flag, poleCenterX - 14, poleTopY + 4, 24, 12);
}

function drawEnemies(camX) {
  for (const e of game.enemies) {
    if (e.dead) continue;
    const x = e.x - camX;
    let spr;
    if (e.type === 'goomba') {
      spr = e.squished > 0 ? SPRITES.GOOMBA.squish : SPRITES.GOOMBA.walk[e.animFrame];
    } else {
      spr = e.shell ? SPRITES.KOOPA.shell : SPRITES.KOOPA.walk[e.animFrame];
    }
    drawSprite(spr, x, e.y, e.w + 2, e.h + (e.type === 'koopa' && !e.shell ? 0 : 0));
  }
}

function drawMushrooms(camX) {
  for (const m of game.mushrooms) {
    const spr = m.kind === '1up' ? SPRITES.mushroom1up : SPRITES.mushroom;
    drawSprite(spr, m.x - camX, m.y, 16, 16);
  }
}

function drawParticles(camX, dt) {
  game.particles = game.particles.filter(p => {
    p.life -= dt;

    // --- physics per type ---
    if (p.type === 'coin') {
      p.y += p.vy; p.vy += 0.35;
    } else if (p.type === 'firework') {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; // gentle gravity, floaty burst
    } else if (p.type === 'text') {
      p.y += p.vy;
    } else if (p.vx !== undefined) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.25;
    } else {
      p.y -= 0.6;
    }
    if (p.life <= 0) return false;

    // --- drawing per type ---
    if (p.type === 'coin') {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 200));
      drawSprite(SPRITES.coin, p.x - camX, p.y, 16, 16);
      ctx.globalAlpha = 1;
    } else if (p.type === 'firework') {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.type === 'text') {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 300));
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(p.text, p.x - camX + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x - camX, p.y);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = p.type === 'brick' ? '#c9682a' : '#fff';
      ctx.globalAlpha = Math.max(0, p.life / (p.type === 'brick' ? 600 : 300));
      ctx.fillRect(p.x - camX, p.y, p.type === 'brick' ? 6 : 4, p.type === 'brick' ? 6 : 4);
      ctx.globalAlpha = 1;
    }
    return true;
  });
}

function drawPlayer(camX) {
  const p = game.player;
  if (p.inPipe) return;
  const set = p.big ? SPRITES.MARIO_BIG : SPRITES.MARIO_SMALL;
  let spr;
  if (!p.onGround) spr = set.jump;
  else if (Math.abs(p.vx) > 0.3) spr = set.walk[p.animFrame];
  else spr = set.stand;

  if (p.hurtInvuln > 0 && Math.floor(p.hurtInvuln / 6) % 2 === 0) return; // flicker

  ctx.save();
  const x = p.x - camX;
  // Derive draw size from the sprite's own native pixel-art dimensions
  // (rather than a hardcoded guess) so it always sits flush with the floor,
  // even if a sprite's row count changes.
  const w = spr.width * MARIO_DRAW_SCALE;
  const h = spr.height * MARIO_DRAW_SCALE;
  if (p.facing < 0) {
    ctx.translate(x + w, p.y - (h - p.h));
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0, w, h);
  } else {
    ctx.drawImage(spr, x, p.y - (h - p.h), w, h);
  }
  ctx.restore();
}

function render(dt) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  const inSecretScene = game.state === 'secretRoom' || game.state === 'minigame';
  document.body.classList.toggle('secret-scene', inSecretScene);

  if (inSecretScene) {
    renderSecretScene(dt);
    return;
  }

  const camX = game.cameraX;
  drawBackground(camX);
  drawLevel(camX);
  drawMushrooms(camX);
  drawEnemies(camX);
  drawParticles(camX, dt);

  if (game.state === 'pipeEnter') {
    drawPipeEnterAnim(camX);
  } else {
    drawPlayer(camX);
  }
}

function drawPipeEnterAnim(camX) {
  const p = game.player;
  const set = p.big ? SPRITES.MARIO_BIG : SPRITES.MARIO_SMALL;
  const dropY = p.y + Math.min(40, game.pipeAnimTimer / 12);
  ctx.save();
  const x = p.x - camX;
  const w = set.stand.width * MARIO_DRAW_SCALE, h = set.stand.height * MARIO_DRAW_SCALE;
  ctx.drawImage(set.stand, x, dropY - (h - p.h), w, h);
  ctx.restore();
}

// --- Secret room / minigame rendering ---
function renderSecretScene(dt) {
  drawSecretRoom(ctx, VIEW_W, VIEW_H, performance.now());

  if (game.state === 'secretRoom') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, VIEW_H - 40, VIEW_W, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BEALE STREET...', VIEW_W / 2, VIEW_H - 16);
    return;
  }

  // minigame overlay: kiosk + 3 reels
  const mg = game.minigame;
  const boardW = 300, boardH = 130;
  const bx = (VIEW_W - boardW) / 2, by = (VIEW_H - boardH) / 2 - 10;

  ctx.fillStyle = 'rgba(20,10,30,0.88)';
  roundRect(ctx, bx, by, boardW, boardH, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd15f';
  ctx.lineWidth = 3;
  roundRect(ctx, bx, by, boardW, boardH, 10);
  ctx.stroke();

  ctx.fillStyle = '#ffd15f';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MATCH ALL THREE!', VIEW_W / 2, by + 20);

  const cardSize = 64;
  const gap = 14;
  const totalW = cardSize * 3 + gap * 2;
  const startX = VIEW_W / 2 - totalW / 2;
  mg.reels.forEach((r, i) => {
    const cx = startX + i * (cardSize + gap);
    const cy = by + 32;
    drawCard(ctx, CARD_DEFS[r.symbol], cx, cy, cardSize);
  });

  ctx.fillStyle = '#fff';
  ctx.font = '12px "Courier New", monospace';
  if (mg.state === 'lost') {
    ctx.fillStyle = '#ff8f8f';
    ctx.fillText('Not quite — try again!', VIEW_W / 2, by + boardH - 12);
  } else {
    ctx.fillText('Tap JUMP to stop each reel', VIEW_W / 2, by + boardH - 12);
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// --- Update ---
function update(dt) {
  if (game.paused) return;

  if (game.state === 'playing') {
    updatePlayer(game.player, Input, dt, world);
    game.enemies.forEach(e => updateEnemy(e, dt));
    game.mushrooms.forEach(m => updateMushroom(m, dt));
    checkEnemyCollisions();
    checkFlagpole();

    game.timeLeft -= (dt / 1000) * 2.5;
    if (game.timeLeft <= 0 && !game.player.dead) {
      game.timeLeft = 0;
      world.onPlayerDeath('time');
    }

    const targetCam = game.player.x - VIEW_W / 2 + 40;
    game.cameraX = Math.max(0, Math.min(targetCam, LEVEL_PIXEL_WIDTH - VIEW_W));
    const baseLives = (3 - (game.deathCount % 3)) || 3;
    UI.updateHud({ score: game.score, coins: game.coins, timeLeft: game.timeLeft, livesDisplay: baseLives + game.extraLives });
  }
  else if (game.state === 'pipeEnter') {
    game.pipeAnimTimer += dt;
    if (game.pipeAnimTimer > 700) {
      game.state = 'secretRoom';
      game.secretRoomTimer = 0;
    }
  }
  else if (game.state === 'flagSlide') {
    const p = game.player;
    const SLIDE_MS = 650;
    game.flagSlideTimer += dt;
    const t = Math.min(1, game.flagSlideTimer / SLIDE_MS);
    const standY = GROUND_ROW * TILE - p.h;
    p.y = game.flagSlideStartY + (standY - game.flagSlideStartY) * t;
    if (t >= 1) {
      p.y = standY;
      finishFlagpole();
    }
  }
  else if (game.state === 'secretRoom') {
    game.secretRoomTimer += dt;
    if (game.secretRoomTimer > 1600) {
      game.state = 'minigame';
      game.minigame = createMinigame();
    }
  }
  else if (game.state === 'minigame') {
    updateMinigame(game.minigame, dt, Input);
    if (Input.jumpPressed) pressMinigameButton(game.minigame);
    if (game.minigame.state === 'won') {
      game.clueFound = true;
      game.state = 'frozen';
      setTimeout(() => {
        UI.showMessage(CLUE_MESSAGE, () => {
          // send Mario back up the pipe to keep playing toward the flagpole
          game.player.inPipe = false;
          game.player.x = (SECRET_PIPE_COL) * TILE;
          game.player.y = (GROUND_ROW - 4) * TILE;
          game.player.vx = 0; game.player.vy = 0;
          game.state = 'playing';
        }, 'AWESOME!');
      }, 600);
    }
  }

  Input.update();
}

// --- Main loop ---
let lastT = performance.now();
function loop(now) {
  let dt = now - lastT;
  lastT = now;
  if (dt > 100) dt = 100; // clamp huge gaps (tab switches etc.)

  update(dt);
  render(dt);

  requestAnimationFrame(loop);
}

function fitCanvas() {
  // Canvas internal resolution stays fixed (pixel-art); CSS scales it via
  // object-fit: contain (see style.css). Nothing else needed here, but keep
  // the hook in case we want DPI-based supersampling later.
}
window.addEventListener('resize', fitCanvas);

// --- Boot ---
function boot() {
  UI.init();
  initInput();
  resetLevel();
  game.state = 'start'; // wait for tap
  fitCanvas();

  document.getElementById('start-btn').addEventListener('click', () => {
    Sfx.unlock();
    Sfx.startMusic();
    document.getElementById('start-overlay').classList.add('hidden');
    game.state = 'playing';
  }, { once: true });

  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(loop); });
}

boot();
