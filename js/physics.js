// ---------------------------------------------------------------------------
// Movement tuning + tile collision. Values are hand-tuned to feel close to
// the source material while being forgiving (coyote time + jump buffering)
// per the usability priority for scavenger-hunt participants who may not be
// regular gamers.
// ---------------------------------------------------------------------------

const PHYS = {
  GRAVITY: 0.62,
  FALL_GRAVITY_MULT: 1.15,   // extra gravity once falling, snappier arc
  WALK_ACCEL: 0.28,
  RUN_ACCEL: 0.4,
  FRICTION: 0.3,
  WALK_MAX: 2.6,
  RUN_MAX: 4.4,
  AIR_ACCEL_MULT: 0.85,
  JUMP_VELOCITY: -10.8,
  JUMP_CUT_MULT: 0.45,       // releasing jump early cuts upward velocity
  TERMINAL_VELOCITY: 11,
  COYOTE_FRAMES: 7,          // grace window after walking off a ledge
  JUMP_BUFFER_FRAMES: 7,     // a jump press just before landing still fires
};

// Resolve AABB movement against the solid tile grid, axis-separated.
function moveAndCollide(entity, dx, dy, onTileEvent) {
  entity.onGround = false;

  // --- Horizontal ---
  entity.x += dx;
  let boxL = entity.x, boxR = entity.x + entity.w;
  let rowTop = Math.floor(entity.y / TILE);
  let rowBot = Math.floor((entity.y + entity.h - 1) / TILE);
  if (dx > 0) {
    const col = Math.floor(boxR / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(tileAt(col, r))) {
        entity.x = col * TILE - entity.w;
        entity.vx = 0;
        break;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor(boxL / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(tileAt(col, r))) {
        entity.x = (col + 1) * TILE;
        entity.vx = 0;
        break;
      }
    }
  }

  // --- Vertical ---
  entity.y += dy;
  boxL = entity.x; boxR = entity.x + entity.w - 1;
  let colL = Math.floor(boxL / TILE);
  let colR = Math.floor(boxR / TILE);
  if (dy > 0) {
    const row = Math.floor((entity.y + entity.h) / TILE);
    for (let cc = colL; cc <= colR; cc++) {
      if (isSolid(tileAt(cc, row))) {
        entity.y = row * TILE - entity.h;
        entity.vy = 0;
        entity.onGround = true;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor(entity.y / TILE);
    for (let cc = colL; cc <= colR; cc++) {
      const ch = tileAt(cc, row);
      if (isSolid(ch)) {
        entity.y = (row + 1) * TILE;
        entity.vy = 0;
        if (onTileEvent) onTileEvent(cc, row, ch);
      }
    }
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
