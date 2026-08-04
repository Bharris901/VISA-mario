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
  mario: { '.': null, 'r':'#e52521', 's':'#8b3a00', 'k':'#ffcc99', 'y':'#fbd000', 'w':'#ffffff', 'b':'#000000' },
  goomba: { '.': null, 'b':'#8b3a00', 'd':'#4a1f00', 'w':'#ffffff', 'k':'#000000' },
  koopa: { '.': null, 'g':'#00a852', 'y':'#fbd000', 'w':'#ffffff', 'k':'#000000', 'd':'#00782e' },
  block: { '.': null, 'y':'#fbd000', 'o':'#c98800', 'k':'#7a4b00' },
  brick: { '.': null, 'r':'#c9682a', 'd':'#8f4718' },
  ground: { '.': null, 'g':'#c98800', 'd':'#8f5c00', 'k':'#5c3a00' },
  pipe: { '.': null, 'g':'#00a852', 'd':'#00782e', 'l':'#5ce87a' },
  misc: { '.': null, 'w':'#ffffff', 'y':'#fbd000', 'g':'#00a852', 'k':'#000000', 'r':'#e52521', 'br':'#8f4718' },
};

const M = (rows, pal) => bakeSprite(rows, pal);

// --- Mario (small), 16x16 ---
const marioSmallStand = M([
  '......rrr.......',
  '.....rrrrrr.....',
  '.....sskkk......',
  '....skssks......',
  '....sksskkk.....',
  '....sskkksss....',
  '......kkkkk.....',
  '.....rrryry.....',
  '....rryryryrr...',
  '...rryryryryr...',
  '...rrryyyyrrr...',
  '.....yy.yy......',
  '....kk...kk.....',
  '....kkk.kkk.....',
  '................',
], PAL.mario);

const marioSmallWalk1 = M([
  '......rrr.......',
  '.....rrrrrr.....',
  '.....sskkk......',
  '....skssks......',
  '....sksskkk.....',
  '....sskkksss....',
  '......kkkkk.....',
  '....rrryry......',
  '...srryryryrr...',
  '..sssryryryr....',
  '.sss.rryyyyrr...',
  '.......yy.yy....',
  '......kk.kkk....',
  '.....kk...kk....',
  '................',
], PAL.mario);

const marioSmallWalk2 = M([
  '......rrr.......',
  '.....rrrrrr.....',
  '.....sskkk......',
  '....skssks......',
  '....sksskkk.....',
  '....sskkksss....',
  '......kkkkk.....',
  '......ryrrr.....',
  '...rryryryrrs...',
  '....ryryryrsss..',
  '...rryyyy.rrsss.',
  '....yy.yy.......',
  '....kkk.kk......',
  '....kk...kk.....',
  '................',
], PAL.mario);

const marioSmallJump = M([
  '......rrr.......',
  '.....rrrrrr.....',
  '.....sskkk......',
  '....skssks......',
  '....sksskkk.....',
  '...ssskkksss....',
  '..s...kkkkk.....',
  '.ss..rryry......',
  '.s..rryryryrr...',
  '...rryryryryr...',
  '...rrryyyyrr....',
  '.....yy..yy.....',
  '....kk....kk....',
  '................',
  '................',
], PAL.mario);

const MARIO_SMALL = { stand: marioSmallStand, walk: [marioSmallWalk1, marioSmallWalk2], jump: marioSmallJump };

// --- Mario (big), 16x24 ---
function bigFrame(extra) {
  return M([
    '......rrr.......',
    '.....rrrrrr.....',
    '.....sskkk......',
    '....skssks......',
    '....sksskkk.....',
    '....sskkksss....',
    '......kkkkk.....',
    '.....kk.kk......',
    '.....rrryry.....',
    '....rryryryrr...',
    '...rryryryryr...',
    '...rrryyyyrrr...',
    '...rrryyyyrrr...',
    '.....yyy.yyy....',
    ...extra,
  ], PAL.mario);
}
const marioBigStand = bigFrame([
  '.....yy..yy.....',
  '.....yy..yy.....',
  '....kkk..kkk....',
  '....kkk..kkk....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);
const marioBigWalk1 = bigFrame([
  '....syy..yy.....',
  '...ssyy..yy.....',
  '..sskkk..kkk....',
  '.ss..kk..kk.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);
const marioBigJump = bigFrame([
  '.....yy.yy......',
  '....kk...kk.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]);
const MARIO_BIG = { stand: marioBigStand, walk: [marioBigWalk1, marioBigStand], jump: marioBigJump };

// --- Goomba, 16x16 ---
const goombaWalk1 = M([
  '................',
  '.....bbbbbb.....',
  '...bbbbbbbbbb...',
  '..bbbbbbbbbbbb..',
  '.bbbbwwbbwwbbbb.',
  '.bbbbwkbbkwbbbb.',
  '.bbbbbbbbbbbbbb.',
  '..bbbdddddbbbb..',
  '...bbdddddbbb...',
  '....bbbbbbbb....',
  '....bb....bb....',
  '...bbb....bbb...',
  '..bb........bb..',
  '................',
  '................',
  '................',
], PAL.goomba);
const goombaWalk2 = M([
  '................',
  '.....bbbbbb.....',
  '...bbbbbbbbbb...',
  '..bbbbbbbbbbbb..',
  '.bbbbwwbbwwbbbb.',
  '.bbbbwkbbkwbbbb.',
  '.bbbbbbbbbbbbbb.',
  '..bbbdddddbbbb..',
  '...bbdddddbbb...',
  '....bbbbbbbb....',
  '...bb....bb.....',
  '..bbb....bbb....',
  '................',
  '................',
  '................',
  '................',
], PAL.goomba);
const goombaSquish = M([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....bbbbbb.....',
  '...bbbbbbbbbb...',
  '.bbbbwwbbwwbbbb.',
  '.bbbbbbbbbbbbbb.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
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

// --- Mushroom power-up, 16x16 ---
const mushroomSprite = M([
  '................',
  '.....rrrrrr.....',
  '...rrrrrrrrrr...',
  '..rrwwrrrrwwrr..',
  '.rrwwwrrrrwwwrr.',
  '.rrrrrrrrrrrrrr.',
  '.rrrrrrrrrrrrrr.',
  '..wwwwwwwwwwww..',
  '..wkkkkkkkkkkw..',
  '..wkwwwwwwwwkw..',
  '..wkw......wkw..',
  '..wkw......wkw..',
  '...kk......kk...',
  '................',
  '................',
  '................',
], PAL.mario);

// --- Blocks / terrain, 16x16 tiles ---
const questionBlock = M([
  'oooooooooooooooo',
  'oyyyyyyyyyyyyyyo',
  'oyoookkkkkooyyyo',
  'oyokkkyyyykk.yyo',
  'oyokkyyoooykkyyo',
  'oyokkyy.ooykkyyo',
  'oyoookkkkkooyyyo',
  'oyyyyoookkyyyyyo',
  'oyyyyyyokkyyyyyo',
  'oyyyyyyyokyyyyyo',
  'oyyyyyyokkyyyyyo',
  'oyyyyyoooyyyyyyo',
  'oyyyyyyyyyyyyyyo',
  'oyyyyyyyyyyyyyyo',
  'oyyyyyyyyyyyyyyo',
  'oooooooooooooooo',
], PAL.block);
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
const brickTile = M([
  'dddddddddddddddd',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'dddddddddddddddd',
  'rrrrrrrdrrrrrrrr',
  'rrrrrrrdrrrrrrrr',
  'dddddddddddddddd',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'dddddddddddddddd',
  'rdrrrrrrrrrrrrrr',
  'rdrrrrrrrrrrrrrr',
  'dddddddddddddddd',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'dddddddddddddddd',
], PAL.brick);
const solidBlock = M(Array(16).fill(0).map((_,i)=> i===0||i===15 ? 'kkkkkkkkkkkkkkkk' : 'k'+ 'o'.repeat(14)+'k'), PAL.block);

const pipeTop = M([
  'llddddddddddddgg',
  'lgddddddddddddgg',
  'lgddddddddddddgg',
  'lgddddddddddddgg',
  'lgddddddddddddgg',
  'lgddddddddddddgg',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
], PAL.pipe);
const pipeBody = M([
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
  '.lgddddddddddgg.',
], PAL.pipe);

const coinSprite = M([
  '................',
  '.....yyyy.......',
  '....ywwyy.......',
  '...yywyyy.......',
  '...yywyyy.......',
  '...yywyyy.......',
  '...yywyyy.......',
  '....ywyy........',
  '.....yyyy.......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], PAL.block);

const flagpoleTile = M([
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
], PAL.misc);

const flagSprite = M([
  '................',
  '.gggggggg.......',
  '.gwwwwwgg.......',
  '.gwgggwgg.......',
  '.gwgggwgg.......',
  '.gwwwwwgg.......',
  '.gggggggg.......',
  '................',
], PAL.misc);

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
  mushroom: mushroomSprite,
  questionBlock, usedBlock, groundTile, brickTile, solidBlock,
  pipeTop, pipeBody, coin: coinSprite,
  flagpoleTile, flag: flagSprite, cloud: cloudSprite, bush: bushSprite,
};
