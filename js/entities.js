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

  const runMax = input.runHeld ? PHYS.RUN_MAX : PHYS.WALK_MAX;
  const accel = (input.runHeld ? PHYS.RUN_ACCEL : PHYS.WALK_ACCEL) * (p.onGround ? 1 : PHYS.AIR_ACCEL_MULT);

  if (input.left && !input.right) {
    p.vx -= accel;
    if (p.vx < -runMax) p.vx = -runMax;
    p.facing = -1;
  } else if (input.right && !input.left) {
    p.vx += accel;
    if (p.vx > runMax) p.vx = runMax;
    p.facing = 1;
  } else {
    if (p.vx > 0) p.vx = Math.max(0, p.vx - PHYS.FRICTION);
    else if (p.vx < 0) p.vx = Math.min(0, p.vx + PHYS.FRICTION);
  }

  // Coyote time + jump buffering for forgiving jumps
  if (p.onGround) p.coyote = PHYS.COYOTE_FRAMES; else p.coyote = Math.max(0, p.coyote - 1);
  if (input.jumpPressed) p.jumpBuffer = PHYS.JUMP_BUFFER_FRAMES; else p.jumpBuffer = Math.max(0, p.jumpBuffer - 1);

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

  const g = p.vy > 0 ? PHYS.GRAVITY * PHYS.FALL_GRAVITY_MULT : PHYS.GRAVITY;
  p.vy = Math.min(p.vy + g, PHYS.TERMINAL_VELOCITY);

  moveAndCollide(p, p.vx, 0, null);
  moveAndCollide(p, 0, p.vy, (col, row, ch) => onHeadBump(world, p, col, row, ch));

  // Animation
  if (Math.abs(p.vx) > 0.2 && p.onGround) {
    p.animTimer += dt;
    if (p.animTimer > 90) { p.animTimer = 0; p.animFrame = 1 - p.animFrame; }
  } else {
    p.animFrame = 0; p.animTimer = 0;
  }

  if (p.hurtInvuln > 0) p.hurtInvuln--;

  // Secret pipe entry: standing on the secret pipe cap + pressing down
  if (input.down && p.onGround) {
    const footCol = Math.floor((p.x + p.w / 2) / TILE);
    const footRow = Math.floor((p.y + p.h) / TILE);
    const belowCh = tileAt(footCol, footRow);
    if (belowCh === 'g' || belowCh === 'h') {
      world.enterSecretPipe();
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
    world.spawnBlockPop(col, row);
    if (col === 16) {
      world.spawnMushroom(col, row - 1);
    } else {
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
function createGoomba(col) {
  return { type: 'goomba', x: col * TILE, y: (GROUND_ROW - 1) * TILE, w: 16, h: 16, vx: -1.0, vy: 0, dead: false, squished: 0, animTimer: 0, animFrame: 0 };
}
function createKoopa(col) {
  return { type: 'koopa', x: col * TILE, y: (GROUND_ROW - 2) * TILE, w: 16, h: 24, vx: -1.0, vy: 0, dead: false, shell: false, shellVx: 0, animTimer: 0, animFrame: 0 };
}

function updateEnemy(e, dt) {
  if (e.dead) return;
  if (e.type === 'goomba' && e.squished > 0) { e.squished--; return; }

  const speed = (e.type === 'koopa' && e.shell) ? e.shellVx : e.vx;
  const prevX = e.x;
  moveAndCollide(e, speed, 0, null);
  // reverse on wall hit
  if (Math.abs(e.x - prevX) < Math.abs(speed) * 0.5) {
    e.vx *= -1;
    if (e.type === 'koopa') e.shellVx *= -1;
  }
  // gravity
  e.vy = Math.min(e.vy + PHYS.GRAVITY, PHYS.TERMINAL_VELOCITY);
  moveAndCollide(e, 0, e.vy, null);

  // reverse at ledges (only when walking, not shells sliding - shells keep going for arcade feel)
  if (!(e.type === 'koopa' && e.shell)) {
    const footRow = Math.floor((e.y + e.h + 1) / TILE);
    const aheadCol = Math.floor((e.x + (e.vx > 0 ? e.w + 1 : -1)) / TILE);
    if (!isSolid(tileAt(aheadCol, footRow))) {
      e.vx *= -1;
    }
  }

  e.animTimer += dt;
  if (e.animTimer > 200) { e.animTimer = 0; e.animFrame = 1 - e.animFrame; }
}

// --- Mushroom power-up ---
function createMushroom(col, row) {
  return { x: col * TILE, y: row * TILE, w: 16, h: 16, vx: 1.2, vy: -2, emerging: 12 };
}
function updateMushroom(m) {
  if (m.emerging > 0) { m.y -= 1; m.emerging--; return; }
  const prevX = m.x;
  moveAndCollide(m, m.vx, 0, null);
  if (Math.abs(m.x - prevX) < Math.abs(m.vx) * 0.5) m.vx *= -1;
  m.vy = Math.min(m.vy + PHYS.GRAVITY, PHYS.TERMINAL_VELOCITY);
  moveAndCollide(m, 0, m.vy, null);
}
