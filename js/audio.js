// ---------------------------------------------------------------------------
// Tiny procedural 8-bit-style sound effects via WebAudio. No external audio
// files needed, and mobile autoplay restrictions are satisfied because the
// context is only created/resumed after the player's first tap.
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

  // --- Background music: a cheery, upbeat original 8-bit-style loop (not
  // the Mario theme - an original composition), kept quiet so it sits under
  // the SFX. Built from four 16-step phrases stitched into a longer
  // ~25s sequence so it doesn't feel like it's looping every few seconds. ---
  const STEP_SEC = 0.16;
  const MUSIC_VOL = 0.045; // deliberately well below SFX (~0.15-0.2)

  // Bright, bouncy major-key phrases ('.' = rest).
  const PHRASE_A_MEL = [523,'.',659,'.', 784,'.',659,'.', 523,'.',659,'.', 784,'.','.','.'];
  const PHRASE_A_BASS = [262,'.','.','.', 330,'.','.','.', 392,'.','.','.', 330,'.','.','.'];

  const PHRASE_B_MEL = [784,'.',880,'.', 1047,'.',880,'.', 784,'.',698,'.', 659,'.','.','.'];
  const PHRASE_B_BASS = [392,'.','.','.', 440,'.','.','.', 523,'.','.','.', 440,'.','.','.'];

  const PHRASE_C_MEL = [659,'.',587,'.', 523,'.',587,'.', 659,'.',784,'.', 659,'.','.','.'];
  const PHRASE_C_BASS = [330,'.','.','.', 294,'.','.','.', 262,'.','.','.', 294,'.','.','.'];

  const PHRASE_D_MEL = [1047,'.',988,'.', 880,'.',784,'.', 880,'.',988,'.', 1047,'.','.','.'];
  const PHRASE_D_BASS = [523,'.','.','.', 494,'.','.','.', 440,'.','.','.', 392,'.','.','.'];

  const PHRASES = {
    A: { mel: PHRASE_A_MEL, bass: PHRASE_A_BASS },
    B: { mel: PHRASE_B_MEL, bass: PHRASE_B_BASS },
    C: { mel: PHRASE_C_MEL, bass: PHRASE_C_BASS },
    D: { mel: PHRASE_D_MEL, bass: PHRASE_D_BASS },
  };
  // ~25.6s total (10 phrases * 16 steps * 0.16s) before it repeats.
  const SONG_ORDER = ['A', 'B', 'A', 'C', 'A', 'B', 'D', 'A', 'C', 'A'];
  const MELODY = SONG_ORDER.flatMap(p => PHRASES[p].mel);
  const BASS = SONG_ORDER.flatMap(p => PHRASES[p].bass);

  let musicOn = false;
  let musicStep = 0;
  let nextNoteTime = 0;
  let schedulerHandle = null;

  function scheduleAhead() {
    const c = ensure();
    while (nextNoteTime < c.currentTime + 0.2) {
      const mel = MELODY[musicStep % MELODY.length];
      const bass = BASS[musicStep % BASS.length];
      if (mel !== '.') toneAt(nextNoteTime, mel, STEP_SEC * 0.85, 'square', MUSIC_VOL);
      if (bass !== '.') toneAt(nextNoteTime, bass, STEP_SEC * 0.95, 'triangle', MUSIC_VOL * 0.9);
      // A light rhythmic pulse (soft "kick" on the downbeat, a short tick on
      // the offbeat) to give the loop some bounce/energy rather than just
      // a bare melody.
      const beat = musicStep % 4;
      if (beat === 0) toneAt(nextNoteTime, 100, 0.09, 'sine', MUSIC_VOL * 0.8);
      if (beat === 2) toneAt(nextNoteTime, 1800, 0.02, 'square', MUSIC_VOL * 0.5);
      nextNoteTime += STEP_SEC;
      musicStep++;
    }
  }

  return {
    unlock() { ensure(); },
    startMusic() {
      if (musicOn) return;
      musicOn = true;
      const c = ensure();
      musicStep = 0;
      nextNoteTime = c.currentTime + 0.05;
      scheduleAhead();
      schedulerHandle = setInterval(scheduleAhead, 100);
    },
    stopMusic() {
      musicOn = false;
      if (schedulerHandle) clearInterval(schedulerHandle);
      schedulerHandle = null;
    },
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
    // Classic descending "womp womp womp waaah" - plays over the death
    // screen (background music is stopped first) so death has a distinct,
    // ~5s musical sting rather than silence or the upbeat loop continuing.
    deathJingle() {
      const notes = [196, 185, 165, 147, 110];
      const durs  = [0.7, 0.7, 0.7, 0.7, 2.2];
      let t = 0;
      notes.forEach((f, i) => { tone(f, durs[i], 'sawtooth', 0.17, t); t += durs[i]; });
    },
    win() { [523,659,784,1047,1319].forEach((f,i)=>tone(f,0.18,'triangle',0.18,i*0.12)); },
    firework() {
      const base = 700 + Math.random() * 500;
      slide(base, base * 1.8, 0.12, 'sine', 0.14);
      tone(base * 2, 0.06, 'square', 0.08, 0.05);
    },
    fail() { slide(300, 150, 0.3, 'sawtooth', 0.15); },
    click() { tone(700, 0.05, 'square', 0.1); },
    reelStop() { tone(440, 0.06, 'square', 0.15); },
  };
})();
