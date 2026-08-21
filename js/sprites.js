// ---------------------------------------------------------------------------
// Tiny pixel-art sprite system. Every sprite is authored as a grid of chars
// mapped to colors via a palette, then baked once onto an offscreen canvas.
// All art here is original (not traced from any copyrighted source).
// ---------------------------------------------------------------------------

const PX = 1; // native pixel-art resolution; scaling to on-screen tile size
              // happens at draw time via drawImage (kept crisp via
              // imageSmoothingEnabled = false on the destination context)

function bakeSprite(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * PX;
  c.height = h * PX;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' ) continue;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  return c;
}

const PAL = {
  // Mario's own redesigned sprites (see marioBigStand etc. below) use their
  // own separate palette rather than a shared 'mario' one - the growth/1-up
  // mushroom sprites below are unrelated art (their own reference image, own
  // redesign) and have their own palette (PAL.mushroom) too, so nothing here
  // needs shared colors across the two.
  heroMario: { '.': null, 'g':'#6f6d23', 'r':'#a23f2e', 'k':'#d7a75b' },
  // Growth/1-up mushroom, redesigned to match a reference image (see
  // mushroomSprite below) - orange/tan cap with dark red spots, white stem.
  // 1-up reuses the same shape recolored green, with the spot regions
  // shaded a darker green ('d') instead of literal red spots, for a subtle
  // highlight/shadow look rather than a flat single-tone cap.
  mushroom: { '.': null, 'o':'#db9f3f', 'r':'#a73c2a', 'w':'#ffffff', 'g':'#00a852', 'd':'#00782e' },
  goomba: { '.': null, 'b':'#5c2b03', 's':'#e9bf85', 'k':'#000000' },
  koopa: { '.': null, 'g':'#00a852', 'y':'#fbd000', 'w':'#ffffff', 'k':'#000000', 'd':'#00782e' },
  block: { '.': null, 'y':'#fbd000', 'o':'#c98800', 'k':'#7a4b00' },
  // Redesigned to match a reference image - black mortar lines instead of
  // this original 2-tone (no-black) look.
  brick: { '.': null, 'r':'#92531c', 'k':'#000000' },
  ground: { '.': null, 'g':'#c98800', 'd':'#8f5c00', 'k':'#5c3a00' },
  // Redefined further down, right before pipeTop/pipeBody are baked - the
  // redesigned pipe needs more than the 3 tones this original palette had.
  misc: { '.': null, 'w':'#ffffff', 'y':'#fbd000', 'g':'#00a852', 'k':'#000000', 'r':'#e52521', 'br':'#8f4718' },
  coin: { '.': null, 'k':'#000000', 'y':'#f0b429', 'd':'#c9932a', 'w':'#fff8e6' },
  // Redesigned to match a reference image: 'y' fill, 'o' corner bolts, 'w'
  // the "?" mark - no black outline/border tone, the source art is flat.
  qblock: { '.': null, 'y':'#f8d648', 'o':'#eb983f', 'w':'#ffffff' },
  face: { '.': null, 'y':'#ffcc4d', 'd':'#e0a233', 'k':'#664500', 'w':'#ffffff' },
};

const M = (rows, pal) => bakeSprite(rows, pal);

// --- Mario (small), redesigned to match a higher-detail reference: rounder
// cap/head silhouette, a distinct mustache, and a more natural walking
// stride, at higher native resolution (18x18, up from the old 16x14) so the
// extra shape detail stays crisp rather than blocky. Uses its own palette,
// PAL.heroMario (see above). ---

const marioSmallStand = M([
  '......rrrrr.......',
  '.....rrrrrrrrr....',
  '.....gggkkgrr.....',
  '....gggkkkgkk.....',
  '...gkkgkkkgkkkk...',
  '...ggkggkkkggkkk..',
  '...gggkkkkggggg...',
  '......kkkkkkkk....',
  '....gggrggg.......',
  '...ggggrggrgggg...',
  '..gggggrrrrggggg..',
  '..kkggrkrrkrggkk..',
  '..kkkrrrrrrrrkkk..',
  '..kkkrrrrrrrrkkk..',
  '...krrrrrrrrrrk...',
  '....rrrr..rrrr....',
  '...gggg....gggg...',
  '..ggggg....ggggg..',
], PAL.heroMario);

const marioSmallWalk1 = M([
  '......rrrrr.......',
  '.....rrrrrrrrr....',
  '.....gggkkrrr.....',
  '....ggggkkgkk.....',
  '....gkgkkkkkkkk...',
  '....gkggkkkggkkk..',
  '....ggkkkkggggg...',
  '......kkkkkkkk....',
  '..gggggrrgg.......',
  'kkgggggrrrggggkkk.',
  'kkkk.ggrkrrrgggkk.',
  'kkk..rrrrrrr...g..',
  '....rrrrrrrrr.gg..',
  '...rrrrrrrrrrrgg..',
  '..grrrrrrrrrrrgg..',
  '.gggrrr....rrrgg..',
  '.gggg.............',
  '...ggg............',
], PAL.heroMario);

const marioSmallWalk2 = M([
  '..................',
  '......rrrrr.......',
  '.....rrrrrrrrrr...',
  '.....gggkkrrr.....',
  '....ggggkkgkk.....',
  '...ggkgkkkgkkkk...',
  '...ggkggkkkggkkk..',
  '....ggkkkkggggg...',
  '......kkkkkkkk....',
  '.....ggggrg..k....',
  '....kggggggkkkk...',
  '..kkkrgggggkkk....',
  '..ggrrrrrrrrk.....',
  '..ggrrrrrrrrr.....',
  '..grrrrrrrrr......',
  '.ggrrrr.rrr.......',
  '.g.....ggg........',
  '.......gggg.......',
], PAL.heroMario);

const marioSmallJump = M([
  '...............kkk',
  '.......rrrrr...kkk',
  '......rrrrrrrrrkkk',
  '......rrrrrrrrrgkk',
  '.....ggggkkgkkgggg',
  '.....gkgkkkgkkkggg',
  '.....gkggkkkggkkkg',
  '.....ggkkkkgggggg.',
  '.......kkkkkkkkg..',
  '..ggggggrgggrgg...',
  '.ggggggggrgggg...g',
  'kkgggggggrrrrrr..g',
  'kkkggrggrrrrrrk.gg',
  '.kk.rrrgrrrrrrrrgg',
  '...ggrrrrrrrrrrrgg',
  '..ggggrrrrrrrrrrgg',
  '.ggggrrrrrrr......',
  '.g...rrrr.........',
], PAL.heroMario);

const MARIO_SMALL = { stand: marioSmallStand, walk: [marioSmallWalk1, marioSmallWalk2], jump: marioSmallJump };



// --- Mario (big), same redesign at 20x36 (up from the old 16x18/20). Each
// pose is authored as its own independent grid rather than sharing a common
// head/torso prefix (the old bigFrame() helper) - the new poses lean and
// shift enough through the shoulders that a shared prefix no longer fits
// all four frames. ---

const marioBigStand = M([
  '........rrrrr.......',
  '......rrrrrrr.......',
  '.....rrrrrrrk.......',
  '.....rrrrrrrkr......',
  '.....rrrrrrrrrrr....',
  '....ggggkkgkkkk.....',
  '...ggkkgkkggkkkkk...',
  '...ggkkggkkkkkkkkk..',
  '..gggkkggkkkgkkkkk..',
  '..gggkkkkkggggggg...',
  '..gggkkkkkkgggggg...',
  '....ggkkkkkkkkkg....',
  '.....ggkkkkkkk......',
  '......gkkkkkgg......',
  '.....ggrggggrgg.....',
  '....gggrggggrggg....',
  '...ggggrggggrgggg...',
  '..gggggrggggrggggg..',
  '..ggggrrggggrrgggg..',
  '.gggggrrggggrrggggg.',
  '.gggggrrrrrrrrggggg.',
  '.gggggrrrrrrrrggggg.',
  '.ggggrrrrrrrrrrgggg.',
  '.kkkkkrrrrrrrrrkkkk.',
  '.kkkkkrrrrrrrrrkkkk.',
  '..kkkkrrrrrrrrrkkk..',
  '..kkkrrrrrrrrrrrkk..',
  '...rrrrrrrrrrrrrr...',
  '..rrrrrrr..rrrrrrr..',
  '..rrrrrr....rrrrrr..',
  '..rrrrrr....rrrrrr..',
  '...rgggg....ggggg...',
  '...ggggg....ggggg...',
  '...ggggg....ggggg...',
  '.ggggggg....ggggggg.',
  '.ggggggg....ggggggg.',
], PAL.heroMario);

// Two distinct stepping poses (one leg forward+raised, the other trailing
// and extended back) so walking actually reads as a stride.

const marioBigWalk1 = M([
  '....................',
  '....................',
  '....................',
  '........rrrrr.......',
  '......rrrrrrr.......',
  '.....rrrrrrrk.......',
  '.....rrrrrrrrrrr....',
  '.....rrrrrrrrrrr....',
  '....ggggkkggkkk.....',
  '...ggkkgkkggkkkkk...',
  '...ggkkggkkkkkkkkk..',
  '..gggkkggkkkggkkkk..',
  '..gggkkkkkggggggg...',
  '...gggkkkkkgggggg...',
  '......gkkkkkkkkk....',
  '.....grrrkkk........',
  '....grgggrg.........',
  '...ggrggggrg........',
  '...ggrgggggrr.k.....',
  '..ggrrggggggrkkk....',
  '..ggrrgggggggkkkkk..',
  '...rrrrgggggggkkkk..',
  '....rrrggggggggkkk..',
  '....rrrrgggggggkkk..',
  '....rrrrrrgggrr.....',
  '....rrrrrrrrrrr.....',
  '....rrrrrrrrrgg.....',
  'ggggrrrrrrrrgrr.....',
  'gggggrrrrrggrrrr....',
  'gggggrrrrgrrrrr.....',
  'gggggrrr..rrrrr.....',
  'gggggrr...rrrr......',
  'gggg......ggggg.....',
  'gg........ggggg.....',
  'g.........ggggggg...',
  '..........ggggggg...',
], PAL.heroMario);

const marioBigWalk2 = M([
  '........rrrrr.......',
  '......rrrrrrr.......',
  '.....rrrrrrrk.......',
  '.....rrrrrrrkr......',
  '.....rrrrrrrrrrr....',
  '....ggggkkgkkkk.....',
  '...ggkkgkkggkkkkk...',
  '...ggkkggkkkkkkkkk..',
  '..gggkkggkkkgkkkkk..',
  '..gggkkkkkggggggg...',
  '..gggkkkkkkgggggg...',
  '....ggkkkkkkkkkg....',
  '......ggggkkk.......',
  '.......gggkk........',
  '......rrrrggr...kk..',
  '....gggggrrggrrkkkk.',
  '...gggggggrrgrggkkk.',
  '..ggggggggrrgggrkkk.',
  '..ggggggggrrgggrgkg.',
  '..gggggggrrrgggrgg..',
  '.gggggggrrrkrgggg...',
  '.gggggrrrrrrrrrk....',
  '.ggggkrrrrrrrrrr....',
  '.kkkkkkrrrrrrrrr....',
  '.kkkkkrrrrrrrrrr..g.',
  '.kkkkkrrrrrrrrrr.gg.',
  '..kkkkrrrrrrrgggggg.',
  '.....rgrrrrrrgggggg.',
  '....grrgrrrrrgggggg.',
  '.ggggrrrggrrrgggggg.',
  '.ggggrrrrr...gggggg.',
  '.gggggrr............',
  '..gggg..............',
  '..gggg..............',
  '..gggg..............',
  '....ggg.............',
], PAL.heroMario);

const marioBigJump = M([
  '..............kkk...',
  '............kkkkkk..',
  '.......rrrrrkkkgkk..',
  '.......rrrrrkkkgkk..',
  '....rrrrrrrrkkkkkk..',
  '....rrrrrrrrgggggg..',
  '....rrrrrrrrrrrrgg..',
  '...ggggkkgkkkggggg..',
  '..ggkkgkkgkkkkkkgg..',
  '..ggkkggkkkkkkkkkg..',
  '..ggkkggkkkgkkkkkg..',
  '..ggkkkkkgggggggg...',
  '.ggggkkkkkggggggg...',
  '..ggggkkkkkgggggg...',
  '....ggkkkkkkkkggg...',
  '.....rrrrggrggggg...',
  '.gggggggrrgrgggg....',
  'gggggggggrggrggg....',
  'gggggggggrrgrgg.....',
  'gggkgggggrrggr......',
  'ggkkkgggrrrrggk.....',
  'kkkkkkgrrrrrrr......',
  'kkkkkkrrrrrrrrr.....',
  'kkkkkrrrrrrrrrr.....',
  'k.kkrrrrrrrrrrr.gg..',
  '.kkrrrrrrrrrrrr.gg..',
  '....rrrrrrrrrggggg..',
  '...ggrrrrrrrrggggg..',
  'ggggrggrrrrrrggggg..',
  'ggggrrrggrrrrggggg..',
  'ggggrrrrr..rrggggg..',
  'ggggrrrrr...........',
  'ggggrrrr............',
  'ggggrrrr............',
  'gg..................',
  'g...................',
], PAL.heroMario);

const MARIO_BIG = { stand: marioBigStand, walk: [marioBigWalk1, marioBigWalk2], jump: marioBigJump };

// --- Goomba, redesigned to match a reference image (front-facing, angry
// eyebrows, a distinct tan face/snout against a dark brown head) - derived
// from that image the same way Mario's redesign was: classified to its own
// 3 flat colors, then downsampled with a majority-vote pool. Baked at 18x16
// (exactly the fixed size drawEnemies() always draws a goomba at - see
// `e.w + 2`/`e.h` in main.js - unlike Mario, goomba's draw size is NOT
// derived from the sprite's own canvas dimensions, so baking any bigger
// would just be downsampled/lost at draw time for no benefit). walk1/walk2
// only differ in the foot row (shifted a column) for a subtle step; squish
// reuses the head/face rows compressed into the bottom of the same canvas,
// with the feet dropped entirely, matching the original squish's approach.
const goombaWalk1 = M([
  '.......bbbb.......',
  '......bbbbbb......',
  '.....bbbbbbbb.....',
  '....bbbbbbbbbb....',
  '...bkkbbbbbbkkb...',
  '..bbbskbbbbksbbbb.',
  '.bbbbskbbbbksbbbb.',
  'bbbbbsksbbsksbbbbb',
  'bbbbbsssbbsssbbbbb',
  'bbbbbbbbbbbbbbbbbb',
  '.bbbbbssssssbbbbb.',
  '.....ssssssss.....',
  '..kkksssssssskkk..',
  '.kkkkkksssskkkkkk.',
  '..kkkkkk..kkkkkkk.',
  '...kkkkk..kkkkk...',
], PAL.goomba);
const goombaWalk2 = M([
  '.......bbbb.......',
  '......bbbbbb......',
  '.....bbbbbbbb.....',
  '....bbbbbbbbbb....',
  '...bkkbbbbbbkkb...',
  '..bbbskbbbbksbbbb.',
  '.bbbbskbbbbksbbbb.',
  'bbbbbsksbbsksbbbbb',
  'bbbbbsssbbsssbbbbb',
  'bbbbbbbbbbbbbbbbbb',
  '.bbbbbssssssbbbbb.',
  '.....ssssssss.....',
  '...kkksssssssskkk.',
  '..kkkkkksssskkkkkk',
  '...kkkkkk..kkkkkkk',
  '....kkkkk..kkkkk..',
], PAL.goomba);
const goombaSquish = M([
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '.......bbbb.......',
  '......bbbbbb......',
  '....bbbbbbbbbb....',
  '..bbbskbbbbksbbbb.',
  '.bbbbskbbbbksbbbb.',
  'bbbbbsssbbsssbbbbb',
  '.bbbbbssssssbbbbb.',
], PAL.goomba);
const GOOMBA = { walk: [goombaWalk1, goombaWalk2], squish: goombaSquish };

// --- Koopa Troopa, 16x24 ---
const koopaWalk1 = M([
  '.....gggg.......',
  '....gggggg......',
  '....gwkgwk......',
  '....gggggg......',
  '.....gggg.......',
  '....yyyyyy......',
  '...gggggggg.....',
  '..gg.gggg.gg....',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '..gg.gggg.gg....',
  '...gggggggg.....',
  '....gg....gg....',
  '...ggg....ggg...',
  '................',
], PAL.koopa);
const koopaWalk2 = M([
  '.....gggg.......',
  '....gggggg......',
  '....gwkgwk......',
  '....gggggg......',
  '.....gggg.......',
  '....yyyyyy......',
  '...gggggggg.....',
  '..gg.gggg.gg....',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '..gg.gggg.gg....',
  '...gggggggg.....',
  '...ggg....ggg...',
  '....gg....gg....',
  '................',
], PAL.koopa);
const koopaShell = M([
  '................',
  '................',
  '................',
  '....gggggg......',
  '...gggggggg.....',
  '..gg.gggg.gg....',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '.gg.gggggg.gg...',
  '..gg.gggg.gg....',
  '...gggggggg.....',
  '....gggggg......',
  '................',
  '................',
  '................',
  '................',
], PAL.koopa);
const KOOPA = { walk: [koopaWalk1, koopaWalk2], shell: koopaShell };

// --- Growth mushroom power-up, redesigned to match a reference image, and
// baked at exactly 16x16 for the same reason as the goomba above -
// drawMushrooms() (main.js) always draws at a fixed 16x16 regardless of the
// sprite's own canvas size, so that's the natural bake size for a clean 1:1
// blit. ---
const mushroomSprite = M([
  '......oooo......',
  '.....oooorr.....',
  '....oooorrrr....',
  '...ooooorrrrr...',
  '..ooooooorrroo..',
  '.oorrrooooooooo.',
  '.orrrrroooooooo.',
  'oorrrrrooooorroo',
  'oorrrrrooooorrro',
  'ooorrrooooooorro',
  'oooooooooooooooo',
  '.orrrwwwwwwrrro.',
  '....wwwwwwww....',
  '....wwwwwwow....',
  '....wwwwwwow....',
  '.....wwwwow.....',
], PAL.mushroom);

// 1-up mushroom (green cap) - same silhouette as the growth mushroom above,
// awarded instead of a growth mushroom when Mario is already big.
const mushroom1upSprite = M([
  '......gggg......',
  '.....ggggdd.....',
  '....ggggdddd....',
  '...gggggddddd...',
  '..gggggggdddgg..',
  '.ggdddggggggggg.',
  '.gdddddgggggggg.',
  'ggdddddgggggddgg',
  'ggdddddgggggdddg',
  'gggdddgggggggddg',
  'gggggggggggggggg',
  '.gdddwwwwwwdddg.',
  '....wwwwwwww....',
  '....wwwwwwgw....',
  '....wwwwwwgw....',
  '.....wwwwgw.....',
], PAL.mushroom);

// --- Blocks / terrain, 16x16 tiles ---
// Question block, redesigned to match a reference image - derived from that
// image the same way as Mario/goomba/mushroom above: classified to its own
// 3 flat colors (yellow fill, orange corner bolts, white "?" mark - no
// black outline, the source art is flat) and downsampled with a
// majority-vote pool, rather than hand-typed. The "?" mark's rounder,
// more naturalistic shape (vs. the previous hand-typed blocky mark) is a
// direct result of that - it's the actual reference shape, not a redraw.
const questionBlock = M([
  'yyyyyyyyyyyyyyyy',
  'yoyyyyyyyyyyyyoy',
  'yyywwwwwwwwwwyyy',
  'yywwwwwwwwwwwyyy',
  'yywwwwyyyywwwyyy',
  'yywwwwyyyywwwyyy',
  'yyywwyyyyywwwyyy',
  'yyyyyyywwwwwwyyy',
  'yyyyyywwwwwwyyyy',
  'yyyyyywwwwyyyyyy',
  'yyyyyywwwwyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyywwyyyyyyy',
  'yyyyyywwwwyyyyyy',
  'yoyyyyyyyyyyyyoy',
  'yyyyyyyyyyyyyyyy',
], PAL.qblock);
const usedBlock = M(Array(16).fill('oooooooooooooooo').map((r,i)=> i===0||i===15? r : 'o'+ 'k'.repeat(14)+'o'), PAL.block);
const groundTile = M([
  'gggggggggggggggg',
  'gddddddddddddddg',
  'gdggggggggggggdg',
  'gdgddddddddddgdg',
  'gdgdkkkkkkkkdgdg',
  'gdgdkggggggkdgdg',
  'gdgdkgddddgkdgdg',
  'gdgdkgdkkdgkdgdg',
  'gdgdkgdkkdgkdgdg',
  'gdgdkgddddgkdgdg',
  'gdgdkggggggkdgdg',
  'gdgdkkkkkkkkdgdg',
  'gdgddddddddddgdg',
  'gdggggggggggggdg',
  'gddddddddddddddg',
  'gggggggggggggggg',
], PAL.ground);
// Brick block, redesigned to match a reference image: a bold black outline
// framing the whole tile plus black mortar lines between individual
// bricks, in the classic running-bond layout (alternating rows of 2 full
// bricks / 3 bricks with half-width ones at each end) - built geometrically
// rather than downsampled from the reference photo, since that photo's
// mortar lines were too soft/blurry to reproduce crisply at this
// resolution; the reference's small center notch at the top edge is kept
// (row 1, cols 7-8). The reference also shows a thin blue sliver along one
// edge - not reproduced here, per instruction to use only the black/brown.
const brickTile = M([
  'kkkkkkkkkkkkkkkk',
  'krrrkrrkkrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'kkkkkkkkkkkkkkkk',
  'krrrrrrkrrrrrrrk',
  'krrrrrrkrrrrrrrk',
  'krrrrrrkrrrrrrrk',
  'krrrrrrkrrrrrrrk',
  'kkkkkkkkkkkkkkkk',
  'krrrkrrrrrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'krrrkrrrrrrkrrrk',
  'kkkkkkkkkkkkkkkk',
], PAL.brick);
const solidBlock = M(Array(16).fill(0).map((_,i)=> i===0||i===15 ? 'kkkkkkkkkkkkkkkk' : 'k'+ 'o'.repeat(14)+'k'), PAL.block);

// Note (historical): previously the lower cap rows and every body row were
// framed with a fully-transparent '.' column at each edge. Each pipe tile is
// drawn as its own independent tile, so two adjacent tiles' transparent
// edges met at the seam and showed as a thin vertical gap revealing the sky
// behind - the reported "blue line down the pipe". The redesign below keeps
// that fix (no transparent pixels anywhere in the interior) while also
// giving the pipe a proper black outline, banded color fill, and a
// crosshatch-textured band, matching a reference illustration.
//
// Baked at native SCREEN resolution rather than scaled up like most other
// sprites here (PIPE_W/PIPE_H match TILE*2/TILE from level.js - written as
// literal numbers, not references to TILE, since sprites.js loads before
// level.js and can't read its top-level const yet): the finer banding and
// crosshatch texture need more detail than the old 16px-wide native art
// could hold without visible scaling blockiness.
//
// The body is baked as ONE double-wide image spanning both tile columns a
// pipe occupies (like the cap already was), not the same single-tile image
// drawn twice - see isPipeBodyLeft()/tileSprite()/drawLevel() in main.js and
// the 'Q'/'H' "right half, already drawn" tile chars in level.js. Baking it
// this way means the band/crosshatch pattern reads as one continuous tube
// rather than a mirrored/repeated pair.
PAL.pipe = { '.': null, 'k':'#000000', 'l':'#a8e05a', 'm':'#5aa83f', 'd':'#3d7a2e', 'h':'#4f9436' };
const PIPE_W = 48; // TILE * 2
const PIPE_H = 24; // TILE
const PIPE_BORDER = 2; // black outline thickness, in native px
// The cap overhangs the body by a few px on each side (its own little lip
// ledge, like the reference art) - purely a wider *sprite*, not a wider
// *tile*: main.js's drawLevel() draws the cap shifted left by this amount
// and wider by twice this amount, while collision/tile placement never
// change (isSolid() etc. still only ever see the normal 2-tile-wide 'T'/'U'
// cap columns), so this is cosmetic only.
const PIPE_CAP_OVERHANG = 4;
const PIPE_CAP_W = PIPE_W + PIPE_CAP_OVERHANG * 2; // 56
// Vertical color bands across the body's interior (cols 2..45), left to
// right: a thin dark stripe, a bright highlight, a thin divider, another
// highlight, a flat matte mid-green, then a crosshatch/mesh band near the
// right edge. 'x' is resolved per-pixel in pipeColorAt() below (the
// crosshatch band).
const PIPE_BANDS = [
  [2, 5, 'd'], [5, 15, 'l'], [15, 17, 'd'], [17, 25, 'l'], [25, 37, 'm'], [37, 46, 'x'],
];
// The cap uses the same bands, widened to fill its overhanging extra width:
// the leftmost band grows to absorb the left overhang, the rightmost band
// grows to absorb the right overhang, and every band in between just shifts
// right by the overhang amount - so the reused middle bands land in the
// same relative place, just framed by a wider (and now overhanging) border.
function widenOutermostBands(bands, extra) {
  return bands.map(([c0, c1, color], i) => [
    i === 0 ? c0 : c0 + extra,
    i === bands.length - 1 ? c1 + extra * 2 : c1 + extra,
    color,
  ]);
}
const PIPE_CAP_BANDS = widenOutermostBands(PIPE_BANDS, PIPE_CAP_OVERHANG);
function pipeColorAt(col, row, bands) {
  for (const [c0, c1, color] of bands) {
    if (col < c0 || col >= c1) continue;
    if (color !== 'x') return color;
    // Crosshatch/mesh texture: alternating 2x2 blocks of two dark greens.
    return (Math.floor((col - c0) / 2) + Math.floor(row / 2)) % 2 === 0 ? 'd' : 'h';
  }
  return 'm'; // unreachable - the bands passed in always cover the full interior
}
function pipeRow(row, blackRow, width, bands) {
  let s = '';
  for (let col = 0; col < width; col++) {
    const edgeCol = col < PIPE_BORDER || col >= width - PIPE_BORDER;
    s += (blackRow || edgeCol) ? 'k' : pipeColorAt(col, row, bands);
  }
  return s;
}
// Cap: solid black border all the way around, with a slightly thicker
// bottom lip (reads as the rim that separates the cap from the body), baked
// PIPE_CAP_W wide (wider than the body) for the overhanging-lip look.
const pipeTop = M(
  Array.from({ length: PIPE_H }, (_, row) =>
    pipeRow(row, row < PIPE_BORDER || row >= PIPE_H - (PIPE_BORDER + 1), PIPE_CAP_W, PIPE_CAP_BANDS)),
  PAL.pipe
);
// Body: black border on the left/right edges only, no top/bottom bar, so
// stacking body tiles for a taller pipe reads as one continuous tube with
// no horizontal "rung" line at each tile boundary.
const pipeBody = M(
  Array.from({ length: PIPE_H }, (_, row) => pipeRow(row, false, PIPE_W, PIPE_BANDS)),
  PAL.pipe
);

// Round gold coin (matches the reference art) - used both for the HUD icon
// and the pop animation when a coin block is hit, replacing the previous
// small diamond placeholder (and the emoji HUD icon, which rendered as a
// dull silver/copper glyph on iOS instead of gold).
const coinSprite = M([
  '.....kkkkkk.....',
  '...kkyyyyyykk...',
  '..kyyyyyyyyyyk..',
  '.kyywyyyyddyyyk.',
  '.kywwyyyyddyyyk.',
  'kyyyyyyyyddyyyyk',
  'kyyyyyyyyddyyyyk',
  'kyyyyyyyyddyyyyk',
  'kyyyyyyyyddyyyyk',
  'kyyyyyyyyddyyyyk',
  'kyyyyyyyyddyyyyk',
  '.kyyyyyyyddyyyk.',
  '.kyyyyyyyddyyyk.',
  '..kyyyyyyyyyyk..',
  '...kkyyyyyykk...',
  '.....kkkkkk.....',
], PAL.coin);

const flagpoleTile = M([
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
  '.......gg.......',
], PAL.misc);

// White pennant with a green accent mark, attached at the pole (left edge).
const flagSprite = M([
  '................',
  '.gggggggg.......',
  '.gwwwwwwg.......',
  '.gwwggwwg.......',
  '.gwwggwwg.......',
  '.gwwwwwwg.......',
  '.gggggggg.......',
  '................',
], PAL.misc);

// Small ball finial for the top of the (now shortened) flagpole.
const ballSprite = M([
  '..gggg..',
  '.gggggg.',
  'gggggggg',
  'gggggggg',
  'gggggggg',
  'gggggggg',
  '.gggggg.',
  '..gggg..',
], PAL.misc);

// 8-bit grimacing face for the "try again" death screen.
// Classic 8-bit "KO'd" face: X eyes + an open circle mouth.
const grimaceFace = M([
  '.....kkkkkk.....',
  '...kkyyyyyykk...',
  '..kyyyyyyyyyyk..',
  '.kyyyyyyyyyyyyk.',
  'kyyyyyyyyyyyyyyk',
  'kyyk.kyyyk.kyyyk',
  'kyyykyyyyykyyyyk',
  'kyyk.kyyyk.kyyyk',
  'kyyyyyyyyyyyyyyk',
  'kyyyyykkkkyyyyyk',
  'kyyyyykyykyyyyyk',
  'kyyyyykyykyyyyyk',
  'kyyyyykkkkyyyyyk',
  'kyyyyyyyyyyyyyyk',
  '...kkyyyyyykk...',
  '.....kkkkkk.....',
], PAL.face);

const cloudSprite = M([
  '....wwww........',
  '..wwwwwwww......',
  '.wwwwwwwwww.....',
  'wwwwwwwwwwww....',
  'wwwwwwwwwwww....',
  '.wwwwwwwwww.....',
], PAL.misc);

const bushSprite = M([
  '....gggg....gggg....',
  '..gggggggg gggggggg.',
  '.gggggggggggggggggg.',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
], PAL.misc);

const SPRITES = {
  MARIO_SMALL, MARIO_BIG, GOOMBA, KOOPA,
  mushroom: mushroomSprite, mushroom1up: mushroom1upSprite,
  questionBlock, usedBlock, groundTile, brickTile, solidBlock,
  pipeTop, pipeBody, coin: coinSprite,
  flagpoleTile, flag: flagSprite, ball: ballSprite, cloud: cloudSprite, bush: bushSprite,
  grimaceFace,
};
