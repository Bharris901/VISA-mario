// ---------------------------------------------------------------------------
// Game orchestration: scene/state machine, camera, render loop.
// ---------------------------------------------------------------------------

// !!! Put the real scavenger-hunt clue text here before the event. !!!
const CLUE_MESSAGE =
  "Congrats Memphis Mario!\n\n[PLACEHOLDER — insert real scavenger-hunt clue text here]";

const BEALE_SPEECH_TEXT = "I need your help to match the cards in order to reveal the next clue! Tap to begin.";

const NOT_FOUND_MESSAGE = "You made it to the end! But…\nYou didn't find the clue :(\nStart over to try again!";
const FOUND_BUT_FINISHED_MESSAGE =
  "🏁 Level complete!\nYou already found the hidden clue — good luck with the rest of the hunt!";

const MARIO_DRAW_SCALE = 1.5; // native sprite px -> on-screen px
const BEALE_BOX_SCALE = 2.2;  // treasure-box draw scale in the Beale scene

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
  pipeAnimTimer: 0,
  flagSlideTimer: 0,
  flagSlideStartY: 0,
  beale: null,  // Beale scene sub-state: fall/land/bubble intro + walk-to-box
  memory: null, // the 20-card memory game state (see minigame.js)
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
  game.beale = null;
  game.memory = null;
  Sfx.stopMiniGameMusic(); // safety net in case a reset happens mid mini-game
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
    // Background music cuts out and a ~5s "womp womp" plays instead, then
    // silence until Start Over restarts the music fresh (via restartLevel).
    Sfx.stopMusic();
    Sfx.deathJingle();
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

    // A stomp is: falling, AND Mario's feet were at or above the enemy's
    // top edge *last* frame (so this frame's overlap can only have come
    // from landing on top of it) - checked against the previous frame's
    // position rather than how deep this frame's overlap happens to be.
    // Two earlier versions of this check used an instantaneous overlap-depth
    // threshold (first "< 10px", then "<= half the enemy's height"), and
    // both had the same underlying flaw: at high fall speed (up to 11px/
    // frame at terminal velocity) it's possible to step clean over a
    // several-pixel-wide detection window in a single frame, depending on
    // the exact sub-pixel alignment - about 1 in 8 falls tunneled through
    // in testing, landing squarely on a goomba but registering as a side
    // hit (goomba survives, Mario takes damage). Comparing against
    // `prevBottom` is exact regardless of fall speed, since it doesn't rely
    // on measuring how deep into the enemy Mario ended up this frame.
    const stomping = p.vy > 0 && p.prevBottom <= e.y;

    if (e.type === 'koopa' && e.shell && Math.abs(e.shellVx) > 1.5) {
      // moving shell hits player
      if (p.hurtInvuln > 0) continue;
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
      if (p.hurtInvuln > 0) continue;
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
  const btnLabel = game.clueFound ? 'PLAY AGAIN' : 'START OVER';
  setTimeout(() => {
    UI.showMessage(msg, () => restartLevel(), btnLabel);
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
  // The D-pad is normally hidden for the whole Beale scene (card matching is
  // tap-only) but re-enabled during the brief player-controlled "walk to the
  // treasure box" sub-phase - see the body.beale-walk rule in style.css.
  document.body.classList.toggle('beale-walk', inSecretScene && !!game.beale && game.beale.phase === 'walk');
  // #game is styled `image-rendering: pixelated` (see style.css) so the
  // browser's own upscale of the low-res canvas backing store to the actual
  // on-screen size stays crisp for tile/sprite art - but the same forced
  // nearest-neighbor scaling makes the Beale scene's photo backdrop look
  // blocky. Nothing pixel-art is drawn while inSecretScene, so switch the
  // whole canvas element to smooth upscaling for the duration of the scene.
  canvas.style.imageRendering = inSecretScene ? 'auto' : 'pixelated';

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
// Sub-phases (game.beale.phase), all drawn over the same photo backdrop:
//   'fall'   - Mario drops in from the top of the screen (secretRoom state)
//   'bubble' - he's landed on the left and a speech bubble reads his line;
//              tapping anywhere dismisses it and starts the grid
//   'grid'   - the 20-card memory board is live (tap to flip)             \ minigame
//   'burst'  - winning pair #10 pops the treasure chest, cards scatter    /  state
//   'walk'   - player walks Mario over to the landed chest
//   'open'   - chest opens, a white "page" grows to fill the screen, then
//              hands off to the DOM message overlay with the clue text
// Mario stays visible in the same spot (where he landed) through 'fall'
// through 'burst' - he only moves once the 'walk' phase starts.
function renderSecretScene(dt) {
  drawBealeBackground(ctx, VIEW_W, VIEW_H);
  const b = game.beale;
  if (!b) return;
  const groundY = b.groundY;

  if (b.phase === 'fall' || b.phase === 'bubble') {
    drawBealeMario(ctx, b.marioFootX, b.marioFootY, BEALE_MARIO_HEIGHT, b.phase === 'fall' ? 'fall' : 'stand', 1);
    if (b.phase === 'bubble') {
      drawSpeechBubble(ctx, b.marioFootX, b.marioFootY - BEALE_MARIO_HEIGHT, BEALE_SPEECH_TEXT, 280);
    }
    return;
  }

  if (b.phase === 'grid') {
    drawMemoryGrid(ctx, game.memory);
    drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT, 'stand', 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, VIEW_H - 26, VIEW_W, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Tap cards to find all 10 matching pairs!', VIEW_W / 2, VIEW_H - 9);
    return;
  }

  if (b.phase === 'burst') {
    drawMemoryGrid(ctx, game.memory);
    drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT, 'stand', 1);
    drawTreasureBox(ctx, game.memory.boxX, game.memory.boxY, BEALE_BOX_SCALE, 0);
    return;
  }

  // 'walk' / 'open' - the lid finishes opening by BEALE_CARD_TWIRL_END, i.e.
  // just before the message card twirls out of it.
  const lidOpenAmount = b.phase === 'open' ? Math.min(1, b.openT / BEALE_CARD_TWIRL_END) : 0;
  drawTreasureBox(ctx, game.memory.boxX, groundY, BEALE_BOX_SCALE, lidOpenAmount);
  const pose = b.phase === 'walk'
    ? (b.walking ? (Math.floor((b.walkAnimTimer || 0) / 150) % 2 === 0 ? 'walk1' : 'walk2') : 'stand')
    : 'stand';
  drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT, pose, b.marioFacing || 1);

  if (b.phase === 'open' && b.openT > 0) {
    drawBealeMessageCardOpen(ctx, game.memory.boxX, groundY - 20, b.openT);
  }
}

// The "message card" that pops the chest open: it twirls out (spinning while
// growing, traveling from the chest toward screen center) for the first
// TWIRL_END fraction of openT, then - already centered and unrotated -
// grows the rest of the way to fill the screen, crossfading its fill color
// from card-white to the DOM message overlay's near-black so the handoff to
// the real UI.showMessage() overlay (see updateBealeGame's 'open' branch)
// reads as one continuous motion rather than a flash cut.
const BEALE_CARD_TWIRL_END = 0.45;
function drawBealeMessageCardOpen(ctx, chestX, chestY, openT) {
  if (openT < BEALE_CARD_TWIRL_END) {
    const tt = openT / BEALE_CARD_TWIRL_END;
    const cardW = 90, cardH = 130;
    const endX = VIEW_W / 2, endY = VIEW_H / 2;
    const cx = chestX + (endX - chestX) * tt;
    const cy = chestY + (endY - chestY) * tt;
    const scale = 0.35 + 0.65 * tt;
    const rotation = tt * Math.PI * 6; // three full spins, ends upright
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, tt * 3);
    ctx.fillStyle = '#fff';
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 10);
    ctx.stroke();
    ctx.restore();
  } else {
    const tt = (openT - BEALE_CARD_TWIRL_END) / (1 - BEALE_CARD_TWIRL_END);
    const cardW = 90, cardH = 130;
    const w = cardW + (VIEW_W - cardW) * tt;
    const h = cardH + (VIEW_H - cardH) * tt;
    // white -> the overlay's near-black, so the final frame here matches
    // the DOM overlay's own background with no visible seam
    const shade = Math.round(255 * (1 - tt));
    ctx.save();
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.92 + 0.08 * (1 - tt)})`;
    roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H / 2 - h / 2, w, h, 12 * (1 - tt));
    ctx.fill();
    ctx.restore();
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

// --- Beale scene sub-state updates ---
function updateBealeIntro(dt) {
  const b = game.beale;
  const dtScale = dt / FRAME_MS;
  if (b.phase === 'fall') {
    b.marioVy += 0.5 * dtScale;
    b.marioFootY += b.marioVy * dtScale;
    if (b.marioFootY >= b.groundY) {
      b.marioFootY = b.groundY;
      b.marioVy = 0;
      b.phase = 'bubble';
      b.phaseTimer = 0;
      Sfx.thud();
    }
  }
  // 'bubble' just waits here - dismissed by a tap anywhere on screen,
  // handled in handleBealeCanvasTap (not a timer), which starts the grid.
}

function updateBealeGame(dt) {
  const b = game.beale;
  const mg = game.memory;
  if (b.phase === 'grid') {
    updateMemoryGame(mg, dt);
  } else if (b.phase === 'burst') {
    const landed = updateTreasureBurst(mg, dt, b.groundY);
    if (landed) {
      b.phase = 'walk';
      b.marioFootX = VIEW_W * 0.16;
      b.marioFootY = b.groundY;
      b.marioFacing = 1;
      b.walking = false;
      b.walkAnimTimer = 0;
    }
  } else if (b.phase === 'walk') {
    const speed = 2.6 * (dt / FRAME_MS);
    if (Input.left) { b.marioFootX -= speed; b.marioFacing = -1; b.walking = true; }
    else if (Input.right) { b.marioFootX += speed; b.marioFacing = 1; b.walking = true; }
    else { b.walking = false; }
    b.marioFootX = Math.max(18, Math.min(VIEW_W - 18, b.marioFootX));
    b.walkAnimTimer += dt;
    if (Math.abs(b.marioFootX - mg.boxX) < 26) {
      b.phase = 'open';
      b.openT = 0;
      Sfx.boxOpen();
    }
  } else if (b.phase === 'open') {
    b.openT = Math.min(1, b.openT + dt / 650);
    if (b.openT >= 1 && !b.messageShown) {
      b.messageShown = true;
      game.clueFound = true;
      game.state = 'frozen';
      UI.showMessage(CLUE_MESSAGE, () => {
        // send Mario back up the pipe to keep playing toward the flagpole,
        // and bring the main level music back (it was paused for the
        // mini-game's own loop when the card grid started)
        game.player.inPipe = false;
        game.player.x = (SECRET_PIPE_COL) * TILE;
        game.player.y = (GROUND_ROW - 4) * TILE;
        game.player.vx = 0; game.player.vy = 0;
        game.beale = null;
        game.memory = null;
        game.state = 'playing';
        Sfx.startMusic();
      }, 'AWESOME!');
    }
  }
}

// Converts a client-space (viewport) coordinate to the canvas's internal
// 480x288 drawing space. `#game` is styled `width:100%; height:100%;
// object-fit: contain` (see style.css) so, whenever the on-screen aspect
// ratio doesn't exactly match 480:288, the canvas is letterboxed - its
// *element* box (what getBoundingClientRect returns) is bigger than the
// actual visible/scaled bitmap inside it. Naively scaling by
// rect.width/rect.height (as an early version of this did) ignores those
// letterbox bars, so every tap is off by however wide the bars are - worst
// at the edges, which is exactly why the leftmost/rightmost card columns
// were the most unreliable to tap. Any future canvas-tap interaction should
// reuse this helper rather than rect.width/height directly.
function canvasCoordsFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const elemAspect = rect.width / rect.height;
  const contentAspect = VIEW_W / VIEW_H;
  let contentW, contentH, offsetX, offsetY;
  if (elemAspect > contentAspect) {
    // letterboxed left/right - element is wider than the scaled content
    contentH = rect.height;
    contentW = contentH * contentAspect;
    offsetX = (rect.width - contentW) / 2;
    offsetY = 0;
  } else {
    // letterboxed top/bottom
    contentW = rect.width;
    contentH = contentW / contentAspect;
    offsetX = 0;
    offsetY = (rect.height - contentH) / 2;
  }
  return {
    x: (clientX - rect.left - offsetX) * (VIEW_W / contentW),
    y: (clientY - rect.top - offsetY) * (VIEW_H / contentH),
  };
}

// Card taps (and the bubble-dismissing tap) are handled outside the
// update() tick (directly off the DOM event) so they register the instant
// a finger lands, same as every other touch control in this game.
function handleBealeCanvasTap(clientX, clientY) {
  if (!game.beale) return;

  if (game.beale.phase === 'bubble') {
    // Any tap anywhere dismisses the speech bubble and starts the grid.
    // The main level's music pauses for the mini-game's own peppy loop,
    // which plays only while the grid is live (see the 'grid' win branch
    // below and updateBealeGame's 'open' completion for where it resumes).
    Sfx.stopMusic();
    Sfx.startMiniGameMusic();
    game.state = 'minigame';
    game.memory = createMemoryGame(VIEW_W, VIEW_H, game.beale.marioFootX, game.beale.groundY - BEALE_MARIO_HEIGHT);
    game.beale.phase = 'grid';
    return;
  }

  if (game.beale.phase !== 'grid' || !game.memory) return;
  const { x, y } = canvasCoordsFromClient(clientX, clientY);
  const won = handleCardTap(game.memory, x, y);
  if (won) {
    Sfx.stopMiniGameMusic();
    game.beale.phase = 'burst';
    startTreasureBurst(game.memory, VIEW_W, VIEW_H); // plays the celebration cue
  }
}

function initBealeCardInput() {
  canvas.addEventListener('touchstart', (e) => {
    if (!game.beale || (game.beale.phase !== 'grid' && game.beale.phase !== 'bubble')) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    handleBealeCanvasTap(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('click', (e) => handleBealeCanvasTap(e.clientX, e.clientY));
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
      game.beale = {
        phase: 'fall',
        marioFootX: VIEW_W * 0.16,
        marioFootY: -20,
        marioVy: 0,
        marioFacing: 1,
        groundY: bealeGroundY(VIEW_H),
        phaseTimer: 0,
        walking: false,
        walkAnimTimer: 0,
        openT: 0,
        messageShown: false,
      };
      game.memory = null;
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
    updateBealeIntro(dt);
  }
  else if (game.state === 'minigame') {
    updateBealeGame(dt);
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
  initBealeCardInput();
  loadBealeAssets();
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
