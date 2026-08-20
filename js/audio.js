// ---------------------------------------------------------------------------
// Tiny procedural 8-bit-style sound effects via WebAudio for every one-shot
// SFX (jump, coin, stomp, card flip, ...), plus real MP3 music tracks for
// the level/mini-game loops and the death/flagpole/final-match stings (see
// "Real music tracks" below). Mobile autoplay restrictions are satisfied
// because the AudioContext is only *resumed*, and any music/SFX actually
// played, after the player's first tap - decoding the MP3s ahead of that
// tap is fine (see loadMusicTracks()), only playback needs the gesture.
// ---------------------------------------------------------------------------

const Sfx = (() => {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.15, delay = 0) {
    try {
      const c = ensure();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain).connect(c.destination);
      const t0 = c.currentTime + delay;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* audio not available, ignore */ }
  }

  function slide(f0, f1, dur, type = 'square', vol = 0.15) {
    try {
      const c = ensure();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      gain.gain.value = vol;
      osc.frequency.setValueAtTime(f0, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
      osc.connect(gain).connect(c.destination);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.start();
      osc.stop(c.currentTime + dur + 0.02);
    } catch (e) {}
  }

  // Schedules a note at an *absolute* AudioContext time (rather than "now
  // + delay") so a lookahead scheduler can queue notes precisely without
  // setTimeout drift - the standard approach for WebAudio music loops.
  function toneAt(startTime, freq, dur, type, vol) {
    try {
      const c = ensure();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.02);
    } catch (e) {}
  }

  // --- Real music tracks (MP3s), replacing the game's earlier procedural
  // loops/stings entirely. Decoded into AudioBuffers (loadMusicTracks(),
  // kicked off from boot() in main.js, well before they're first needed)
  // rather than played via a plain <audio> element, so looping is
  // sample-accurate - MP3 encoders commonly pad a file with a few ms of
  // silence at the start/end, which shows up as an audible click at the
  // loop seam with <audio loop>, but not when a decoded AudioBuffer is
  // looped through an AudioBufferSourceNode. decodeAudioData() itself
  // doesn't need a "resumed" (post-gesture) context, so this can start
  // fetching/decoding immediately at boot - only actual playback is gated
  // behind ensure()/the start-button tap, same as every other sound here.
  // ?v= matches index.html's shared cache-busting query (see CLAUDE.md) -
  // fetch() doesn't get that for free the way <script>/<link> tags do, so
  // it's applied here explicitly; bump it alongside the rest whenever one
  // of these files is ever swapped for a new version.
  const MUSIC_VERSION = 'v=15';
  const MUSIC_FILES = {
    ground: `assets/music-ground-theme.mp3?${MUSIC_VERSION}`,
    underwater: `assets/music-underwater-theme.mp3?${MUSIC_VERSION}`,
    finalMatch: `assets/music-final-match-theme.mp3?${MUSIC_VERSION}`,
    mariodies: `assets/music-mario-dies-theme.mp3?${MUSIC_VERSION}`,
    gameover: `assets/music-game-over-theme.mp3?${MUSIC_VERSION}`,
    levelcomplete: `assets/music-level-complete-theme.mp3?${MUSIC_VERSION}`,
  };
  // Real mastered audio doesn't need to be nearly as quiet as the old
  // procedural loops (which were deliberately turned way down to sit under
  // the SFX) - these are a starting point and may want ear-tuning.
  const LOOP_VOL = 0.5;
  const STING_VOL = 0.6;

  const musicBuffers = {};
  let groundSource = null, underwaterSource = null;
  // Tracks what *should* be playing so a startMusic()/startMiniGameMusic()
  // call that arrives before its file has finished loading (e.g. a very
  // fast tap on a slow connection) isn't silently lost - once the buffer
  // finishes decoding, tryStartPending() starts it if it's still wanted.
  let desiredGround = false, desiredUnderwater = false;

  async function loadMusicTracks() {
    const c = ensure();
    await Promise.all(Object.entries(MUSIC_FILES).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        musicBuffers[name] = await c.decodeAudioData(arr);
        tryStartPending();
      } catch (e) { /* that track just won't play - rest of the game still works */ }
    }));
  }

  function tryStartPending() {
    if (desiredGround && !groundSource && musicBuffers.ground) startLoop('ground');
    if (desiredUnderwater && !underwaterSource && musicBuffers.underwater) startLoop('underwater');
  }

  // 'ground' and 'underwater' are mutually exclusive (never both at once,
  // matching the two-separate-loops design this replaces) - starting one
  // always stops the other first.
  function startLoop(which) {
    stopLoop(which === 'ground' ? 'underwater' : 'ground');
    const already = which === 'ground' ? groundSource : underwaterSource;
    if (already) return;
    const buf = musicBuffers[which];
    if (!buf) return;
    const c = ensure();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.value = LOOP_VOL;
    src.connect(gain).connect(c.destination);
    src.start(0);
    if (which === 'ground') groundSource = src; else underwaterSource = src;
  }
  function stopLoop(which) {
    const src = which === 'ground' ? groundSource : underwaterSource;
    if (src) {
      try { src.stop(); } catch (e) {}
      try { src.disconnect(); } catch (e) {}
    }
    if (which === 'ground') groundSource = null; else underwaterSource = null;
  }

  function playSting(name) {
    const buf = musicBuffers[name];
    if (!buf) return;
    try {
      const c = ensure();
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = STING_VOL;
      src.connect(gain).connect(c.destination);
      src.start(0);
    } catch (e) {}
  }

  return {
    unlock() { ensure(); },
    loadMusicTracks,
    startMusic() {
      desiredGround = true; desiredUnderwater = false;
      startLoop('ground');
    },
    stopMusic() {
      desiredGround = false;
      stopLoop('ground');
    },
    startMiniGameMusic() {
      desiredUnderwater = true; desiredGround = false;
      startLoop('underwater');
    },
    stopMiniGameMusic() {
      desiredUnderwater = false;
      stopLoop('underwater');
    },
    // Upon finding the mini-game's final (10th) match - plays alongside
    // treasureBurst()'s short procedural fanfare below, through the chest's
    // shake/pop/message-twirl sequence.
    finalMatchTheme() { playSting('finalMatch'); },
    // Flagpole outcomes - fireworks still fire visually either way (see
    // finishFlagpole() in main.js), only the accompanying music differs.
    gameOverTheme() { playSting('gameover'); },
    levelCompleteTheme() { playSting('levelcomplete'); },
    jump() { slide(300, 600, 0.18); },
    coin() { tone(988, 0.08, 'square', 0.18); tone(1319, 0.18, 'square', 0.15, 0.06); },
    stomp() { slide(180, 60, 0.12, 'square', 0.2); },
    bump() { tone(140, 0.08, 'square', 0.18); },
    powerup() { [523,659,784,1047].forEach((f,i)=>tone(f,0.12,'square',0.16,i*0.09)); },
    // Big -> small: a quick downward "deflate", distinct from die()'s longer/
    // more severe slide, so a hit that merely shrinks Mario reads differently
    // from an actual death.
    shrink() { [880,660,440].forEach((f,i)=>tone(f,0.11,'square',0.16,i*0.06)); slide(300,120,0.2,'triangle',0.12); },
    pipe() { slide(220, 90, 0.4, 'sine', 0.2); },
    // Subtle "nope" for trying to descend a pipe that isn't the secret one -
    // deliberately quiet/short so it reads as a gentle nudge, not a buzzer.
    denied() { tone(180, 0.07, 'square', 0.1); tone(140, 0.09, 'square', 0.09, 0.05); },
    die() { slide(400, 100, 0.6, 'sawtooth', 0.18); },
    // Plays over the death screen (background music is stopped first) - a
    // real musical sting rather than silence or the loop continuing.
    deathJingle() { playSting('mariodies'); },
    firework() {
      const base = 700 + Math.random() * 500;
      slide(base, base * 1.8, 0.12, 'sine', 0.14);
      tone(base * 2, 0.06, 'square', 0.08, 0.05);
    },
    fail() { slide(300, 150, 0.3, 'sawtooth', 0.15); },
    click() { tone(700, 0.05, 'square', 0.1); },
    reelStop() { tone(440, 0.06, 'square', 0.15); },

    // --- Beale Street memory game ---
    thud() { tone(90, 0.12, 'sine', 0.2); },
    cardFlip() { tone(500, 0.05, 'square', 0.1); },
    cardMatch() { [659, 880, 1109, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.18, i * 0.07)); },
    cardMiss() { tone(220, 0.1, 'square', 0.1); tone(180, 0.12, 'square', 0.09, 0.08); },
    treasureBurst() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.06));
      slide(150, 60, 0.3, 'sawtooth', 0.15);
    },
    boxOpen() { slide(300, 900, 0.35, 'sine', 0.15); },
  };
})();
