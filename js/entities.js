// ---------------------------------------------------------------------------
// Player + enemy + item entity logic.
// ---------------------------------------------------------------------------

function createPlayer() {
  return {
    x: TILE * 2, y: TILE * (GROUND_ROW - 1), vx: 0, vy: 0,
    w: 14, h: 16,
    big: false,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuffer: 0,
    animTimer: 0,
    animFrame: 0,
    hurtInvuln: 0,     // brief flashing invulnerability after shrinking
    dead: false,
    inPipe: false,     // true during the secret-pipe entry cutscene
  };
}

function resizePlayerBox(p) {
  p.h = p.big ? 28 : 16;
}

function updatePlayer(p, input, dt, world) {
  if (p.inPipe || p.dead) return;

  // Normalize all physics to be independent of actual device frame rate -
  // every constant below is tuned assuming ~60fps, and dtScale rescales the
  // per-frame deltas to match however fast this device is actually ticking
  // (matters on 90/120Hz phones, which would otherwise run everything,
  // including jump apex timing, at 1.5-2x speed).
  const dtScale = dt / FRAME_MS;

  const accel = PHYS.WALK_ACCEL * (p.onGround ? 1 : PHYS.AIR_ACCEL_MULT) * dtScale;

  if (input.left && !input.right) {
    p.vx -= accel;
    if (p.vx < -PHYS.WALK_MAX) p.vx = -PHYS.WALK_MAX;
    p.facing = -1;
  } else if (input.right && !input.left) {
    p.vx += accel;
    if (p.vx > PHYS.WALK_MAX) p.vx = PHYS.WALK_MAX;
    p.facing = 1;
  } else {
    const friction = PHYS.FRICTION * dtScale;
    if (p.vx > 0) p.vx = Math.max(0, p.vx - friction);
    else if (p.vx < 0) p.vx = Math.min(0, p.vx + friction);
  }

  // Coyote time + jump buffering for forgiving jumps
  if (p.onGround) p.coyote = PHYS.COYOTE_FRAMES; else p.coyote = Math.max(0, p.coyote - dtScale);
  if (input.jumpPressed) p.jumpBuffer = PHYS.JUMP_BUFFER_FRAMES; else p.jumpBuffer = Math.max(0, p.jumpBuffer - dtScale);

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = PHYS.JUMP_VELOCITY;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    Sfx.jump();
  }
  if (!input.jumpHeld && p.vy < PHYS.JUMP_VELOCITY * PHYS.JUMP_CUT_MULT) {
    p.vy = PHYS.JUMP_VELOCITY * PHYS.JUMP_CUT_MULT;
  }

  const g = (p.vy > 0 ? PHYS.GRAVITY * PHYS.FALL_GRAVITY_MULT : PHYS.GRAVITY) * dtScale;
  p.vy = Math.min(p.vy + g, PHYS.TERMINAL_VELOCITY);

  moveAndCollide(p, p.vx * dtScale, 0, null);
  moveAndCollide(p, 0, p.vy * dtScale, (col, row, ch) => onHeadBump(world, p, col, row, ch));

  // Animation: cycle frames based on distance actually covered, not just
  // elapsed time, so running visibly moves Mario's legs faster than walking
  // (previously the walk cycle advanced at a fixed rate regardless of
  // speed, so RUN didn't look like it was doing anything).
  if (Math.abs(p.vx) > 0.2 && p.onGround) {
    p.animTimer += Math.abs(p.vx) * dtScale;
    if (p.animTimer > 14) { p.animTimer = 0; p.animFrame = 1 - p.animFrame; }
  } else {
    p.animFrame = 0; p.animTimer = 0;
  }

  if (p.hurtInvuln > 0) p.hurtInvuln--;

  // Secret pipe entry: standing on the secret pipe cap + pressing down
  // (via the joystick or the dedicated DESCEND button - either works).
  // Trying to descend a normal (non-secret) pipe gets a subtle "nope" sound
  // instead, once per press rather than spamming while held.
  if ((input.down || input.descendHeld) && p.onGround) {
    const footCol = Math.floor((p.x + p.w / 2) / TILE);
    const footRow = Math.floor((p.y + p.h) / TILE);
    const belowCh = tileAt(footCol, footRow);
    if (belowCh === 'g' || belowCh === 'h') {
      world.enterSecretPipe();
    } else if ((belowCh === 'T' || belowCh === 'U') && input.descendPressed) {
      world.denyDescend();
    }
  }

  // Fell into a pit
  if (p.y > LEVEL_PIXEL_HEIGHT) {
    world.onPlayerDeath('pit');
  }
}

function onHeadBump(world, p, col, row, ch) {
  if (ch === '?' ) {
    setTile(col, row, 'x');
    Sfx.bump();
    if (col === MUSHROOM_COL_1 || col === MUSHROOM_COL_2) {
      // Growth mushroom if still small, a 1-up if already big.
      world.spawnMushroom(col, row - 1, p.big ? '1up' : 'grow');
    } else {
      world.spawnCoinPop(col, row);
      world.addCoin();
      Sfx.coin();
    }
  } else if (ch === 'B') {
    if (p.big) {
      setTile(col, row, ' ');
      world.spawnBrickParticles(col, row);
      Sfx.stomp();
    } else {
      Sfx.bump();
      world.spawnBlockPop(col, row);
    }
  } else if (isSolid(ch)) {
    Sfx.bump();
  }
}

function growPlayer(p) {
  if (!p.big) {
    p.big = true;
    resizePlayerBox(p);
    p.y -= (28 - 16);
    Sfx.powerup();
  }
}
function shrinkPlayer(p, world) {
  if (p.big) {
    p.big = false;
    p.y += (28 - 16); // keep feet planted at the same spot as the box shrinks
    resizePlayerBox(p);
    p.hurtInvuln = 120;
  } else {
    world.onPlayerDeath('enemy');
  }
}

// --- Enemies ---
// Spawn columns aren't all flat ground (some sit on stair terrain), so the
// spawn height is derived from the actual tile grid rather than assuming
// GROUND_ROW - this is what fixed a goomba spawning embedded in a step and
// rendering as if floating next to its wall face.
function createGoomba(col) {
  const row = groundSurfaceRowAt(col);
  // Goomba is 16px tall, shorter than a full TILE (24px), so the resting
  // y is row*TILE - h, not (row-1)*TILE - that formula only happens to work
  // for entities exactly one tile tall (like the koopa below).
  // dir/moveSpeed are the *authoritative* patrol state (see updateEnemy) -
  // vx is just derived from them every frame, never read back as state.
  return { type: 'goomba', x: col * TILE, y: row * TILE - 16, w: 16, h: 16, dir: -1, moveSpeed: 1.0, vx: -1.0, vy: 0, dead: false, squished: 0, animTimer: 0, animFrame: 0 };
}
function createKoopa(col) {
  const row = groundSurfaceRowAt(col);
  return { type: 'koopa', x: col * TILE, y: (row - 2) * TILE, w: 16, h: 24, dir: -1, moveSpeed: 1.0, vx: -1.0, vy: 0, dead: false, shell: false, shellVx: 0, animTimer: 0, animFrame: 0 };
}

// Is there a solid tile directly ahead (in direction `dir`), anywhere across
// this entity's full vertical extent? Checked *before* moving, rather than
// inferring a wall hit from position deltas after the fact.
function isWallAhead(e, dir) {
  const aheadX = e.x + (dir > 0 ? e.w : -1);
  const aheadCol = Math.floor(aheadX / TILE);
  const rowTop = Math.floor(e.y / TILE);
  const rowBot = Math.floor((e.y + e.h - 1) / TILE);
  for (let r = rowTop; r <= rowBot; r++) {
    if (isSolid(tileAt(aheadCol, r))) return true;
  }
  return false;
}

function updateEnemy(e, dt) {
  if (e.dead) return;
  if (e.type === 'goomba' && e.squished > 0) { e.squished -= dt; return; }

  const dtScale = dt / FRAME_MS;

  if (e.type === 'koopa' && e.shell) {
    // Kicked shells: shellVx is an absolute velocity, 0 while resting.
    if (e.shellVx !== 0 && isWallAhead(e, e.shellVx > 0 ? 1 : -1)) {
      e.shellVx = -e.shellVx;
    }
    moveAndCollide(e, e.shellVx * dtScale, 0, null);
  } else {
    // Reverse *before* moving if a wall is directly ahead, using the
    // authoritative dir/moveSpeed (never derived from e.vx). This is what
    // actually fixes enemies permanently stopping at obstacles: the old
    // code inferred a wall hit from "did I move as far as intended", but
    // moveAndCollide had already zeroed e.vx as part of resolving that same
    // collision - if the heuristic ever missed by a frame, e.vx was left at
    // 0 with no way to recover (reversing 0 is still 0), so the goomba was
    // stuck there for good. dir/moveSpeed are separate fields moveAndCollide
    // never touches, so they can't be silently corrupted this way, and
    // every frame re-derives vx fresh from them.
    if (isWallAhead(e, e.dir)) e.dir *= -1;
    e.vx = e.dir * e.moveSpeed;
    moveAndCollide(e, e.vx * dtScale, 0, null);
  }

  // gravity
  e.vy = Math.min(e.vy + PHYS.GRAVITY * dtScale, PHYS.TERMINAL_VELOCITY);
  moveAndCollide(e, 0, e.vy * dtScale, null);

  // reverse at ledges (only when walking, not shells sliding - shells keep going for arcade feel)
  if (!(e.type === 'koopa' && e.shell)) {
    const footRow = Math.floor((e.y + e.h + 1) / TILE);
    const aheadCol = Math.floor((e.x + (e.dir > 0 ? e.w + 1 : -1)) / TILE);
    if (!isSolid(tileAt(aheadCol, footRow))) {
      e.dir *= -1;
      e.vx = e.dir * e.moveSpeed;
    }
  }

  e.animTimer += dt;
  if (e.animTimer > 200) { e.animTimer = 0; e.animFrame = 1 - e.animFrame; }
}

// --- Mushroom power-up ---
// kind: 'grow' (red, grows small Mario) or '1up' (green, awarded instead
// when Mario is already big).
function createMushroom(col, row, kind = 'grow') {
  return { x: col * TILE, y: row * TILE, w: 16, h: 16, vx: 1.2, vy: -2, emerging: 12, kind };
}
function updateMushroom(m, dt) {
  const dtScale = dt / FRAME_MS;
  if (m.emerging > 0) { m.y -= 1 * dtScale; m.emerging -= dtScale; return; }
  const prevX = m.x;
  moveAndCollide(m, m.vx * dtScale, 0, null);
  if (Math.abs(m.x - prevX) < Math.abs(m.vx) * dtScale * 0.5) m.vx *= -1;
  m.vy = Math.min(m.vy + PHYS.GRAVITY * dtScale, PHYS.TERMINAL_VELOCITY);
  moveAndCollide(m, 0, m.vy * dtScale, null);
}
