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

  return {
    unlock() { ensure(); },
    jump() { slide(300, 600, 0.18); },
    coin() { tone(988, 0.08, 'square', 0.18); tone(1319, 0.18, 'square', 0.15, 0.06); },
    stomp() { slide(180, 60, 0.12, 'square', 0.2); },
    bump() { tone(140, 0.08, 'square', 0.18); },
    powerup() { [523,659,784,1047].forEach((f,i)=>tone(f,0.12,'square',0.16,i*0.09)); },
    pipe() { slide(220, 90, 0.4, 'sine', 0.2); },
    die() { slide(400, 100, 0.6, 'sawtooth', 0.18); },
    win() { [523,659,784,1047,1319].forEach((f,i)=>tone(f,0.18,'triangle',0.18,i*0.12)); },
    fail() { slide(300, 150, 0.3, 'sawtooth', 0.15); },
    click() { tone(700, 0.05, 'square', 0.1); },
    reelStop() { tone(440, 0.06, 'square', 0.15); },
  };
})();
