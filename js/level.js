// ---------------------------------------------------------------------------
// Level 1 layout: a tile grid + entity/coin spawn lists.
// This is an original layout designed to *feel* like the classic World 1-1
// flow (open start -> pipes -> gaps -> block clusters -> staircases ->
// flagpole) without reproducing exact copyrighted level data.
//
// Tile legend:
//   '#'  solid ground / block
//   '?'  question block (coin or mushroom)
//   'B'  breakable brick
//   'P'  pipe body, LEFT column / 'Q' pipe body, RIGHT column (decorative,
//        solid) - distinct chars (like the cap's 'T'/'U') so the body can be
//        baked+drawn as one continuous double-wide image instead of the same
//        tile mirrored twice; see isPipeBodyLeft() and tileSprite()/drawLevel()
//        in main.js.
//   'T'  pipe top-left cap tile / 'U' top-right cap tile (decorative, solid)
//   'g'  SECRET pipe top-left cap  / 'h' secret pipe top-right cap
//   'G'  secret pipe body, LEFT column / 'H' secret pipe body, RIGHT column -
//        solid, visually identical to normal ('P'/'Q')
//   'F'  flagpole
// ---------------------------------------------------------------------------

const TILE = 24;
const ROWS = 12;
const COLS = 240;
const GROUND_ROW = 9; // top surface row index of normal ground

function buildLevel() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(' '));

  const solidGround = (c0, c1, topRow = GROUND_ROW) => {
    for (let c = c0; c <= c1; c++) {
      for (let r = topRow; r < ROWS; r++) grid[r][c] = '#';
    }
  };
  const pipe = (col, heightTiles, secret = false) => {
    const top = GROUND_ROW - heightTiles;
    grid[top][col] = secret ? 'g' : 'T';
    grid[top][col + 1] = secret ? 'h' : 'U';
    for (let r = top + 1; r < GROUND_ROW; r++) {
      grid[r][col] = secret ? 'G' : 'P';
      grid[r][col + 1] = secret ? 'H' : 'Q';
    }
    return { col, top };
  };
  const block = (col, row, ch) => { grid[row][col] = ch; };
  const stairsUp = (startCol, steps, dir = 1) => {
    for (let i = 0; i < steps; i++) {
      const col = startCol + i * dir;
      for (let h = 0; h <= i; h++) {
        solidGround(col, col, GROUND_ROW - h);
      }
    }
    return startCol + (steps - 1) * dir;
  };

  // --- Ground with pits (gaps) ---
  const pits = [[54, 55], [83, 85], [146, 148]];
  let c = 0;
  const groundSegments = [];
  let segStart = 0;
  for (const [p0, p1] of pits) {
    groundSegments.push([segStart, p0 - 1]);
    segStart = p1 + 1;
  }
  groundSegments.push([segStart, COLS - 1]);
  groundSegments.forEach(([a, b]) => solidGround(a, b));

  // --- Opening area: classic block cluster ---
  block(16, 5, '?');
  block(20, 5, 'B'); block(21, 5, '?'); block(22, 5, 'B'); block(23, 5, '?'); block(24, 5, 'B');
  block(22, 2, '?'); // high lone block

  // --- First pipes (ascending height) ---
  pipe(28, 2);
  pipe(38, 3);
  pipe(46, 4);

  // pit at 54-55 already carved

  // --- Floating block cluster past first pit ---
  block(60, 5, 'B'); block(61, 5, '?'); block(62, 5, '?'); block(63, 5, 'B');
  block(65, 2, '?');

  // --- Small staircase up-and-over ---
  stairsUp(70, 4, 1);
  stairsUp(77, 4, -1);

  // pit at 83-85 already carved

  // --- Long brick+coin corridor ---
  for (let i = 0; i < 6; i++) {
    block(92 + i * 2, 5, i % 2 === 0 ? 'B' : '?');
  }
  block(90, 2, '?');
  block(108, 5, '?');

  // --- Mid pipe ---
  pipe(118, 2);

  // --- Multi-brick block with hidden bonus feel ---
  block(128, 5, 'B'); block(129, 5, '?'); block(130, 5, 'B');
  block(129, 2, '?');

  // pit at 146-148 already carved

  // --- Staircase down into the final stretch ---
  stairsUp(155, 3, 1);

  // --- SECRET PIPE: placed within the final 25% of the level (col >= 172) ---
  const SECRET_PIPE_COL = 182;
  pipe(SECRET_PIPE_COL, 3, true);

  // decorative pipes around it so it doesn't visually stand out
  pipe(190, 3, false);

  block(198, 5, '?'); block(200, 5, 'B'); block(202, 5, '?');

  // --- Final big staircase up to the flagpole ---
  const flagStairTop = stairsUp(208, 8, 1);
  // Close enough that a single running jump straight off the stair-top peak
  // (col 215) lands right on the pole. Simulated a maxed-out running jump
  // (full speed, held for max height) off that peak: it lands around col
  // 220-221 - this sits right at that ceiling, as far out as a committed
  // jump can reach without requiring extra walking afterward. (228 was
  // tried and was well beyond a single jump's reach; 219 landed with room
  // to spare and read as too close.)
  const flagCol = 220;
  // Shortened on purpose (6 tiles instead of spanning the full screen
  // height) so the ball finial at the top is clearly visible with sky
  // above it, rather than running off the top of the view.
  const FLAGPOLE_HEIGHT = 6;
  const flagTopRow = GROUND_ROW - FLAGPOLE_HEIGHT;
  for (let r = flagTopRow; r < GROUND_ROW; r++) grid[r][flagCol] = 'F';

  // Past the flagpole there's just open ground - the Memphis Pyramid is
  // drawn there as pure scenery (drawEndPyramid() in main.js, a real image
  // rather than a tile) rather than a placed/collidable tile structure,
  // since the flagpole always captures the player before they'd ever reach
  // it on foot anyway.

  return { grid, SECRET_PIPE_COL, FLAG_COL: flagCol, FLAG_TOP_ROW: flagTopRow };
}

const LEVEL = buildLevel();

function tileAt(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return ' ';
  return LEVEL.grid[row][col];
}
function setTile(col, row, ch) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
  LEVEL.grid[row][col] = ch;
}
function isSolid(ch) {
  return ch === '#' || ch === '?' || ch === 'B' || ch === 'P' || ch === 'Q' || ch === 'T' || ch === 'U' ||
         ch === 'G' || ch === 'H' || ch === 'g' || ch === 'h' || ch === 'x' /* used block */;
}
function isPipeCap(ch) { return ch === 'T' || ch === 'U' || ch === 'g' || ch === 'h'; }
// The LEFT half of a double-wide pipe body tile pair - drawn as one
// continuous 2-tile-wide image (see drawLevel() in main.js), same pattern as
// isPipeCap()'s 'T'/'g' left-cap chars.
function isPipeBodyLeft(ch) { return ch === 'P' || ch === 'G'; }

// Finds the row an entity standing in this column should rest on. Spawn
// columns aren't all flat ground (some sit on stair-step terrain of
// varying height), so spawning at a hardcoded row could embed an entity in
// solid tiles or leave it hovering next to a step's wall face - this is
// what was actually happening.
//
// Scans from the *bottom* up through the contiguous solid stack (handles
// stairs of any height) rather than top-down: a top-down scan would stop at
// the first solid tile in the column, which can be an unrelated floating
// block well above the real ground (e.g. col 63 has both a floating brick
// block and a ground-level goomba spawn) and misplace the entity up there.
function groundSurfaceRowAt(col) {
  let r = ROWS - 1;
  if (!isSolid(tileAt(col, r))) return ROWS; // pit column - no ground here
  while (r > 0 && isSolid(tileAt(col, r - 1))) r--;
  return r;
}

// --- Entity spawns (Goombas only - no green enemies per design) ---
const ENTITY_SPAWNS = [
  { type: 'goomba', col: 18 },
  { type: 'goomba', col: 33 },
  { type: 'goomba', col: 42 },
  { type: 'goomba', col: 50 },
  { type: 'goomba', col: 63 },
  { type: 'goomba', col: 74 },
  { type: 'goomba', col: 96 },
  { type: 'goomba', col: 100 },
  { type: 'goomba', col: 112 },
  { type: 'goomba', col: 132 },
  { type: 'goomba', col: 134 },
  { type: 'goomba', col: 140 },
  { type: 'goomba', col: 160 },
  { type: 'goomba', col: 170 },
  { type: 'goomba', col: 198 },
];

const LEVEL_PIXEL_WIDTH = COLS * TILE;
const LEVEL_PIXEL_HEIGHT = ROWS * TILE;
const SECRET_PIPE_COL = LEVEL.SECRET_PIPE_COL;
const FLAG_COL = LEVEL.FLAG_COL;
const FLAG_TOP_ROW = LEVEL.FLAG_TOP_ROW;

// The two question-block columns that spawn a mushroom instead of a coin -
// growth (red) mushroom if Mario is small, 1-up (green) if already big.
const MUSHROOM_COL_1 = 16;  // near the very start
const MUSHROOM_COL_2 = 108; // roughly halfway through the level
