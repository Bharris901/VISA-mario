// ---------------------------------------------------------------------------
// Unified input: keyboard (desktop/testing) + touch (mobile).
// Touch is a big drag-anywhere virtual stick (left zone) + two large buttons
// (right zone), tuned for reliability over precision - see design notes in
// README.md under "Controls".
// ---------------------------------------------------------------------------

const Input = {
  left: false,
  right: false,
  down: false,
  up: false,
  jumpHeld: false,
  jumpPressed: false, // true only on the frame the jump was first pressed
  runHeld: false,
  _jumpWasHeld: false,
};

Input.update = function () {
  this.jumpPressed = this.jumpHeld && !this._jumpWasHeld;
  this._jumpWasHeld = this.jumpHeld;
};

function initInput() {
  // --- Keyboard ---
  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'up', KeyW: 'up',
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code]) { Input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'KeyZ') { Input.jumpHeld = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') { Input.runHeld = true; }
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) Input[keyMap[e.code]] = false;
    if (e.code === 'Space' || e.code === 'KeyZ') Input.jumpHeld = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') Input.runHeld = false;
  });

  // --- Touch: virtual stick ---
  const dpadZone = document.getElementById('dpad-zone');
  const stick = document.getElementById('dpad-stick');
  let dpadTouchId = null;
  let originX = 0, originY = 0;
  const DEAD = 12;      // px dead zone before a direction registers
  const DOWN_THRESH = 26; // px downward drag to register "down"

  function resetStick() {
    Input.left = Input.right = Input.down = Input.up = false;
    stick.style.transform = '';
    stick.classList.remove('active');
    dpadTouchId = null;
  }

  function handleStickMove(touch) {
    const dx = touch.clientX - originX;
    const dy = touch.clientY - originY;
    const maxR = 34;
    const dist = Math.min(Math.hypot(dx, dy), maxR);
    const angle = Math.atan2(dy, dx);
    stick.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    Input.left = dx < -DEAD;
    Input.right = dx > DEAD;
    Input.down = dy > DOWN_THRESH;
    Input.up = dy < -DOWN_THRESH;
  }

  dpadZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    dpadTouchId = t.identifier;
    originX = t.clientX; originY = t.clientY;
    stick.classList.add('active');
  }, { passive: false });

  dpadZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === dpadTouchId) handleStickMove(t);
    }
  }, { passive: false });

  function onDpadEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === dpadTouchId) resetStick();
    }
  }
  dpadZone.addEventListener('touchend', onDpadEnd);
  dpadZone.addEventListener('touchcancel', onDpadEnd);

  // --- Touch: buttons ---
  function bindButton(el, onDown, onUp) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { onUp(); });
    // mouse fallback for desktop testing
    el.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(); });
    window.addEventListener('mouseup', () => onUp());
  }

  bindButton(document.getElementById('btn-jump'),
    () => { Input.jumpHeld = true; },
    () => { Input.jumpHeld = false; });

  bindButton(document.getElementById('btn-run'),
    () => { Input.runHeld = true; },
    () => { Input.runHeld = false; });

  // Prevent double-tap zoom / scroll on the whole document
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
