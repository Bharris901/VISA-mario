// ---------------------------------------------------------------------------
// Game orchestration: scene/state machine, camera, render loop.
// ---------------------------------------------------------------------------

// Rendered as HTML (see UI.showMessage) - the heading is wrapped in
// .message-heading (style.css) to match the "MEMPHIS MARIO" title's own
// gold-on-shadow look from the welcome screen, just smaller.
const CLUE_MESSAGE =
  '<span class="message-heading">Congrats Memphis Mario!</span>\n\n' +
  "To receive your next clue:\n\n" +
  "1. Go to Dim Sum King\n" +
  "2. Sit down & eat lunch with your team\n" +
  "3. When you order your lunch, show the server the playing card in your bag";

// Shown on a second, dedicated screen (UI.showLunchNote) right after the
// clue message above - a wide "character + speech bubble" layout rather
// than the standard centered message card, since this is a single one-off
// aside rather than a reusable message shape. Its own continue button is
// what actually resumes play back at the secret pipe (see the win-message
// wiring further below) - CLUE_MESSAGE's own button just advances to this
// screen first.
const LUNCH_NOTE_MESSAGE =
  "To-go orders are not allowed, and will not lead you to your next clue. " +
  "You &amp; your team must sit down at a table and enjoy a lunch break " +
  "together. All teams will be doing this, so you won't be falling behind!";

const BEALE_SPEECH_TEXT = "I need your help to match the cards in order to reveal the next clue! Tap to begin.";

const NOT_FOUND_MESSAGE = "You made it to the end! But…\nYou didn't find the clue :(\nStart over to try again!";
const FOUND_BUT_FINISHED_MESSAGE =
  "🏁 Level complete!\nYou already found the hidden clue — good luck with the rest of the hunt!";


// Native sprite px -> on-screen px. The redesigned Mario sprites (see
// sprites.js) are baked at a higher native resolution than before (big:
// 20x36, up from 16x18/20; small: 18x18, up from 16x14); this scale
// compensates for that so Mario's on-screen size is a deliberate choice
// here, not just whatever the native resolution happens to produce.
// Bumped from 5/6 to 1 - reference screenshots showed Mario reading a
// little small next to the pipes at 5/6, and pipes/tiles are staying the
// same size, so Mario alone got bigger.
const MARIO_DRAW_SCALE = 1;
const BEALE_BOX_SCALE = 2.2;  // fallback procedural treasure-box draw scale (see drawBealeChest)

// Timing for the chest's post-win sequence (see updateBealeGame's 'burst'
// branch): the chest starts a shake-in-place wiggle partway through, then
// "pops" open (image swap + fireworks) at CHEST_POP_MS - about 3s total
// from the last match, per the requested pacing.
const BEALE_CHEST_SHAKE_START_MS = 1400;
const BEALE_CHEST_POP_MS = 3000;

// Widest aspect ratio `#game` (see style.css) is ever allowed to crop up to
// via object-fit: cover before layoutCanvas() below steps in - see there for
// why this needs a cap at all.
const CANVAS_MAX_CROP_ASPECT = 2.0;

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

// The flag's own descent, independent of wherever Mario actually grabbed
// the pole - it always starts at the same spot near the top (matching its
// static draw offset) and always ends at the same spot near the base.
// FLAG_SLIDE_SPEED (derived from those two fixed points and how long a
// full-height slide should take) is the one shared px/ms speed used for
// *both* Mario and the flag while sliding - see the 'flagSlide' state in
// update() - so grabbing higher up naturally takes longer for both, and
// grabbing anywhere below the flag's own start means Mario (a shorter
// distance at that same speed) reaches the bottom before the flag does.
const FLAG_TOP_Y = FLAG_TOP_ROW * TILE + 4; // matches the flag sprite's draw offset from the pole top
const FLAG_BOTTOM_Y = GROUND_ROW * TILE - 14; // rests with its bottom edge at the ground line
const FLAG_SLIDE_MS = 650; // time a full-height slide (grabbed at the very top) takes
const FLAG_SLIDE_SPEED = (FLAG_BOTTOM_Y - FLAG_TOP_Y) / FLAG_SLIDE_MS; // px/ms, shared by Mario + flag

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
  flagY: FLAG_TOP_Y, // the flag's own current draw height - only moves during 'flagSlide'
  beale: null,  // Beale scene sub-state: fall-in, speech bubble, chest shake/pop
  memory: null, // the 20-card memory game state (see minigame.js)
  paused: false,
};

function resetLevel() {
  resetLevelTiles();
  game.player = createPlayer();
  game.enemies = ENTITY_SPAWNS.map(s => s.type === 'goomba' ? createGoomba(s.col, s.row) : createKoopa(s.col));
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
  game.flagY = FLAG_TOP_Y; // put the flag back at the top for the next attempt
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
    game.flagY = FLAG_TOP_Y; // the flag always starts its own descent from the top, regardless of where Mario grabbed
    Sfx.bump();
  }
}

function finishFlagpole() {
  game.state = 'frozen';
  Sfx.stopMusic();
  // Fireworks fire visually either way (below) - only the accompanying
  // music differs between "made it but missed the clue" and "found it".
  if (game.clueFound) Sfx.levelCompleteTheme(); else Sfx.gameOverTheme();
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
    case 'T': case 'g': return SPRITES.pipeTop;
    case 'U': case 'h': return null; // right cap drawn as part of left-cap image (double-wide draw handled below)
    case 'P': case 'G': return SPRITES.pipeBody; // baked double-wide; spans both body columns
    case 'Q': case 'H': return null; // right body column drawn as part of the left column's image, above
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
      if (ch === ' ' || ch === 'U' || ch === 'h' || ch === 'Q' || ch === 'H') continue;
      const spr = tileSprite(ch);
      if (!spr) continue;
      const x = col * TILE - camX;
      const y = row * TILE;
      if (isPipeCap(ch)) {
        // The cap sprite is baked wider than the 2 tile columns it sits on
        // and overhangs both sides slightly (a little lip ledge, like the
        // reference art) - purely visual, the underlying tile grid/collision
        // are still just the normal 2-wide cap columns.
        drawSprite(spr, x - PIPE_CAP_OVERHANG, y, PIPE_CAP_W, TILE);
      } else if (isPipeBodyLeft(ch)) {
        drawSprite(spr, x, y, TILE * 2, TILE);
      } else {
        drawSprite(spr, x, y, TILE, TILE);
      }
    }
  }
  // Ball finial at the top of the (deliberately shortened) pole, so the top
  // is always clearly visible with sky above it. The pennant, unlike the
  // ball, moves - game.flagY tracks its own descent (see the 'flagSlide'
  // state in update()), independent of wherever Mario actually grabbed the
  // pole, so it always starts at FLAG_TOP_Y and only reaches FLAG_BOTTOM_Y
  // once its own slide (at the same shared speed as Mario's) finishes.
  const poleTopY = FLAG_TOP_ROW * TILE;
  const poleCenterX = FLAG_COL * TILE - camX + TILE / 2;
  drawSprite(SPRITES.ball, poleCenterX - 8, poleTopY - 12, 16, 16);
  drawSprite(SPRITES.flag, poleCenterX - 24, game.flagY, 24, 14);

  drawEndPyramid(camX);
}

// A real (not tile-baked) 16-bit-style Memphis Pyramid, drawn as pure
// scenery past the flagpole in place of the plain block cluster that used
// to sit there - reuses the same card-pyramid.png the memory game's Pyramid
// card already loads (via loadCardPhotos() in minigame.js) rather than a
// second copy of the same art. Deliberately left unsmoothed (unlike the
// real-photo assets in the Beale scene) - main.js's global
// ctx.imageSmoothingEnabled = false is exactly right here, since this image
// is itself pixel art and should render crisp/blocky like the rest of the
// level's tiles, not softened.
//
// Gotcha: card-pyramid.png has an *opaque* white background baked in (it
// was made to sit on a card's own white face, not against open sky), so
// drawing it directly here shows a glaring white box behind the pyramid.
// getEndPyramidCanvas() chroma-keys the near-white background to
// transparent once, into a cached in-memory canvas - the actual asset file
// on disk is never touched/re-exported, only this runtime copy.
//
// Gotcha #2: the source image also has a few px of that same near-white
// margin *around* the pyramid itself (on every side, not just corners) -
// scaling/positioning off the raw image's own width/height (as an earlier
// version of this did) leaves that bottom margin between the pyramid's
// actual visual base and the ground line, reading as "floating" rather
// than sitting on the ground. getEndPyramidBBox() finds the chroma-keyed
// content's tight bounding box once (alongside the transparent canvas
// above), and drawEndPyramid() draws *that* sub-rect instead of the whole
// canvas, so its bottom edge is the pyramid's actual visual base.
const END_PYRAMID_HEIGHT = TILE * 7; // on-screen px
let endPyramidCanvas = null;
let endPyramidBBox = null;
function getEndPyramidCanvas() {
  if (endPyramidCanvas) return endPyramidCanvas;
  const img = cardPhotoImages.pyramid;
  if (!cardPhotoLoaded.pyramid || !img || img.naturalWidth === 0) return null;
  const off = document.createElement('canvas');
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0);
  const frame = octx.getImageData(0, 0, off.width, off.height);
  const px = frame.data;
  let minX = off.width, minY = off.height, maxX = 0, maxY = 0;
  for (let i = 0; i < px.length; i += 4) {
    const isBg = px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
    if (isBg) { px[i + 3] = 0; continue; }
    const p = i / 4, x = p % off.width, y = (p - x) / off.width;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  octx.putImageData(frame, 0, 0);
  endPyramidCanvas = off;
  endPyramidBBox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  return endPyramidCanvas;
}
function drawEndPyramid(camX) {
  const src = getEndPyramidCanvas();
  if (!src) return;
  const b = endPyramidBBox;
  const h = END_PYRAMID_HEIGHT;
  const w = b.w * (h / b.h);
  const x = (FLAG_COL + 4) * TILE - camX;
  const y = GROUND_ROW * TILE - h;
  ctx.drawImage(src, b.x, b.y, b.w, b.h, x, y, w, h);
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
//   'fall'   - Mario AND the closed chest drop in together from the top
//              (secretRoom state)
//   'bubble' - both have landed (Mario on the left, chest on the right) and
//              a speech bubble reads his line; tapping anywhere dismisses
//              it and starts the grid
//   'grid'   - the 20-card memory board is live (tap to flip)             \ minigame
//   'burst'  - winning pair #10: cards fly apart from the pile while the   /  state
//              chest (untouched, still sitting where it landed) shakes in
//              place, then pops open ~3s later
//   'open'   - chest is open, a "page" twirls out and grows to fill the
//              screen, then hands off to the DOM message overlay with the
//              clue text
// Mario and the chest both stay fixed in the spots they landed for the
// entire scene now - neither one ever moves again after 'fall'.
function renderSecretScene(dt) {
  drawBealeBackground(ctx, VIEW_W, VIEW_H);
  const b = game.beale;
  if (!b) return;
  const groundY = b.groundY;

  if (b.phase === 'fall' || b.phase === 'bubble') {
    drawBealeChest(ctx, b.chestFootX, b.chestFootY, true);
    drawBealeMario(ctx, b.marioFootX, b.marioFootY, BEALE_MARIO_HEIGHT);
    if (b.phase === 'bubble') {
      drawSpeechBubble(ctx, b.marioFootX, b.marioFootY - BEALE_MARIO_HEIGHT, BEALE_SPEECH_TEXT, 280);
    }
    return;
  }

  if (b.phase === 'grid') {
    drawMemoryGrid(ctx, game.memory);
    drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT);
    drawBealeChest(ctx, b.chestFootX, groundY, true);
    drawParticles(0, dt); // per-match confetti bursts (see handleCardTap)
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
    drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT);
    drawBealeChest(ctx, b.chestFootX, groundY, !b.chestOpen, bealeChestShakeAngle(b));
    drawParticles(0, dt); // the chest-pop fireworks (see updateBealeGame)
    return;
  }

  // 'open'
  drawMemoryGrid(ctx, game.memory);
  drawBealeMario(ctx, b.marioFootX, groundY, BEALE_MARIO_HEIGHT);
  drawBealeChest(ctx, b.chestFootX, groundY, false, 0, bealeChestPunchScale(b));
  drawParticles(0, dt); // fireworks keep falling/fading as the message twirls out
  if (b.openT > 0) {
    drawBealeMessageCardOpen(ctx, b.chestFootX, groundY - 20, b.openT);
  }
}

// Small side-to-side wiggle while the chest is building up to popping open -
// frequency and amplitude both ramp up across the shake window so it reads
// as rising anticipation rather than a flat rattle the whole time.
function bealeChestShakeAngle(b) {
  if (!b.chestShaking || b.chestOpen) return 0;
  const t = Math.min(1, Math.max(0,
    (b.chestTimer - BEALE_CHEST_SHAKE_START_MS) / (BEALE_CHEST_POP_MS - BEALE_CHEST_SHAKE_START_MS)));
  const freq = 16 + t * 22;
  const amp = 0.035 + t * 0.075;
  return Math.sin((b.chestTimer / 1000) * freq) * amp;
}

// A brief scale-punch right as the chest pops open, decaying back to normal
// size over BEALE_CHEST_POP_PUNCH_MS - driven by b.chestPopT rather than
// b.chestTimer, since the latter stops advancing once 'burst' phase ends
// (see updateBealeGame's 'open' branch, which ticks chestPopT itself).
const BEALE_CHEST_POP_PUNCH_MS = 300;
function bealeChestPunchScale(b) {
  const t = b.chestPopT || 0;
  if (t >= BEALE_CHEST_POP_PUNCH_MS) return 1;
  return 1 + (1 - t / BEALE_CHEST_POP_PUNCH_MS) * 0.18;
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
    // Mario and the closed chest drop in together, with identical fall
    // physics from identical starting heights, so they land at the same
    // moment - each tracked independently (rather than assuming they always
    // land in lockstep) so nothing breaks if their start heights/speeds
    // ever get tuned differently later.
    if (b.marioFootY < b.groundY) {
      b.marioVy += 0.5 * dtScale;
      b.marioFootY = Math.min(b.groundY, b.marioFootY + b.marioVy * dtScale);
    }
    if (b.chestFootY < b.groundY) {
      b.chestVy += 0.5 * dtScale;
      b.chestFootY = Math.min(b.groundY, b.chestFootY + b.chestVy * dtScale);
    }
    if (b.marioFootY >= b.groundY && b.chestFootY >= b.groundY) {
      b.phase = 'bubble';
      Sfx.thud();
      // The mini-game's music begins the instant Mario lands (not later, at
      // the tap-to-begin gesture) and replaces the main level's theme.
      Sfx.stopMusic();
      Sfx.startMiniGameMusic();
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
    updateCardScatter(mg, dt);
    b.chestTimer += dt;
    if (!b.chestShaking && b.chestTimer >= BEALE_CHEST_SHAKE_START_MS) {
      b.chestShaking = true;
    }
    if (!b.chestOpen && b.chestTimer >= BEALE_CHEST_POP_MS) {
      b.chestOpen = true;
      Sfx.boxOpen();
      const fx = b.chestFootX, fy = b.groundY;
      world.spawnFireworks(fx, fy - 40);
      Sfx.firework();
      setTimeout(() => { world.spawnFireworks(fx - 25, fy - 65); Sfx.firework(); }, 220);
      setTimeout(() => { world.spawnFireworks(fx + 25, fy - 55); Sfx.firework(); }, 440);
      b.phase = 'open';
      b.openT = 0;
      b.chestPopT = 0;
    }
  } else if (b.phase === 'open') {
    b.chestPopT = Math.min(BEALE_CHEST_POP_PUNCH_MS, b.chestPopT + dt);
    b.openT = Math.min(1, b.openT + dt / 650);
    if (b.openT >= 1 && !b.messageShown) {
      b.messageShown = true;
      game.clueFound = true;
      game.state = 'frozen';
      UI.showMessage(CLUE_MESSAGE, () => {
        // A second, dedicated screen (the "sit down for lunch" note) comes
        // next rather than resuming play immediately - see LUNCH_NOTE_MESSAGE/
        // UI.showLunchNote. Only *its* continue button actually resumes play.
        UI.showLunchNote(LUNCH_NOTE_MESSAGE, () => {
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
        });
      }, 'Next Instructions');
    }
  }
}

// Converts a client-space (viewport) coordinate to the canvas's internal
// 480x288 drawing space. `#game` is styled `width:100%; height:100%;
// object-fit: cover; object-position: center bottom` (see style.css) so the
// canvas fills the element edge-to-edge on any aspect ratio - whichever
// dimension doesn't match 480:288 *overflows* the element and is cropped
// (anchored to the bottom, so it's sky trimmed off the top, not ground),
// rather than being letterboxed with bars like a plain `object-fit: contain`
// would. Naively scaling by rect.width/rect.height ignores that crop, so
// every tap would be off by however much got cropped - worst at the top/
// edges. Any future canvas-tap interaction should reuse this helper rather
// than rect.width/height directly.
//
// contentW/contentH is the on-screen size of the actual 480x288 bitmap once
// scaled to *cover* the element (so it's >= the element's own box on the
// axis that overflows/crops, rather than <= it like the old letterboxed
// `contain` version of this function). offsetX/offsetY (anchored 50%/100%
// to match object-position: center bottom) can come out negative here -
// that's expected, it's how far the bitmap's top-left corner sits outside
// the visible element box on the cropped side.
function canvasCoordsFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const elemAspect = rect.width / rect.height;
  const contentAspect = VIEW_W / VIEW_H;
  let contentW, contentH;
  if (elemAspect > contentAspect) {
    // height overflows/crops - width matches the element exactly
    contentW = rect.width;
    contentH = contentW / contentAspect;
  } else {
    // width overflows/crops - height matches the element exactly
    contentH = rect.height;
    contentW = contentH * contentAspect;
  }
  const offsetX = (rect.width - contentW) / 2;  // object-position: center
  const offsetY = rect.height - contentH;        // object-position: bottom
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
    // (The mini-game's music already started when Mario landed - see
    // updateBealeIntro() - not here.)
    game.state = 'minigame';
    game.memory = createMemoryGame(VIEW_W, VIEW_H, game.beale.marioFootX, game.beale.groundY - BEALE_MARIO_HEIGHT, game.beale.chestFootX);
    game.beale.phase = 'grid';
    return;
  }

  if (game.beale.phase !== 'grid' || !game.memory) return;
  const { x, y } = canvasCoordsFromClient(clientX, clientY);
  const won = handleCardTap(game.memory, x, y);
  if (won) {
    Sfx.stopMiniGameMusic();
    Sfx.finalMatchTheme(); // plays through the chest's shake/pop/message-twirl
    game.beale.phase = 'burst';
    game.beale.chestTimer = 0;
    startCardScatter(game.memory); // plays the celebration cue; chest itself
                                    // shakes/pops on its own timer, see
                                    // updateBealeGame's 'burst' branch
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
        chestFootX: VIEW_W * 0.82,
        chestFootY: -20,
        chestVy: 0,
        groundY: bealeGroundY(VIEW_H),
        chestTimer: 0,
        chestShaking: false,
        chestOpen: false,
        chestPopT: 0,
        openT: 0,
        messageShown: false,
      };
      game.memory = null;
    }
  }
  else if (game.state === 'flagSlide') {
    const p = game.player;
    game.flagSlideTimer += dt;
    const standY = GROUND_ROW * TILE - p.h;
    // Mario and the flag both move at the same fixed FLAG_SLIDE_SPEED, just
    // from wherever each of them started - Mario from his actual grab
    // height (variable), the flag always from FLAG_TOP_Y (fixed). Whoever
    // has less distance left simply arrives (and clamps in place) sooner;
    // the state doesn't finish until *both* have landed.
    const dy = FLAG_SLIDE_SPEED * game.flagSlideTimer;
    p.y = Math.min(standY, game.flagSlideStartY + dy);
    game.flagY = Math.min(FLAG_BOTTOM_Y, FLAG_TOP_Y + dy);
    if (p.y >= standY && game.flagY >= FLAG_BOTTOM_Y) {
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

// Canvas internal resolution stays fixed (pixel-art); CSS scales it via
// object-fit: cover (see style.css), which fills the viewport edge-to-edge
// on any aspect ratio by cropping whichever dimension overflows - great for
// eliminating pillarbox bars on a typical phone-in-landscape, but on an
// extreme aspect ratio (e.g. a lot of Safari chrome eating the available
// height) an *uncapped* cover crop can trim away enough of the canvas's top
// to push on-canvas UI (the Beale scene's card grid, positioned in the
// upper-middle of the screen) off-screen entirely - not just visually
// cropped, but physically untappable, since no on-screen pixel maps to that
// canvas-internal position anymore.
//
// This caps it: past CANVAS_MAX_CROP_ASPECT, rather than cropping further,
// the canvas element itself narrows (leaving normal pillarbox bars on the
// sides for the excess) so the crop amount never exceeds what the cap
// allows. Below the cap, the canvas is simply 100% width/height and
// object-fit: cover does the (now-bounded) cropping on its own.
function fitCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const viewportAspect = vw / vh;
  canvas.style.width = viewportAspect > CANVAS_MAX_CROP_ASPECT
    ? `${vh * CANVAS_MAX_CROP_ASPECT}px`
    : '100%';
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);

// --- Boot ---
function boot() {
  UI.init();
  initInput();
  initBealeCardInput();
  loadBealeAssets();
  loadCardPhotos();
  Sfx.loadMusicTracks(); // fire-and-forget: fetch+decode starts immediately,
                          // well before the start-button tap that first
                          // plays anything (only playback needs the gesture)
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
