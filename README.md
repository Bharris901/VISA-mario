# Memphis Quest

A browser-playable recreation of World 1-1 with a hidden custom twist: a
secret green pipe near the end of the level leads to an 8-bit Beale Street
scene and a picture-matching bonus game. Winning it reveals a scavenger-hunt
clue. No app, no install — just a URL.

All art is original pixel art drawn in code (not traced from any
copyrighted source), tuned to feel close to the classic game.

## Before the event: two things to fill in

1. **The clue text** — edit `CLUE_MESSAGE` at the top of `js/main.js`.
2. **The mini-game card images** — see `assets/README.md`. Until you add
   real images, placeholder colored cards are used automatically.

## Running it locally

No build step — it's a static site.

```
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying (GitHub Pages)

1. Push this branch (or merge it to `main`).
2. In the repo: **Settings → Pages → Source**, pick the branch and `/ (root)`.
3. GitHub gives you a URL like `https://<user>.github.io/<repo>/` — that's
   the link to share with scavenger-hunt participants.

Any static host works equally well (Netlify, Vercel, Cloudflare Pages) if
you'd rather use one of those instead.

## Controls

- **Desktop (testing):** Arrow keys / WASD to move, Space or Z to jump,
  Shift or X to run.
- **Mobile:** drag anywhere in the bottom-left zone to move (a virtual
  stick, not a rigid d-pad — more forgiving with imprecise thumbs), RUN and
  JUMP buttons bottom-right. Phone must be in landscape — a rotate prompt
  shows automatically in portrait.

### Usability choices (why controls feel more forgiving than "true" NES)

- **Coyote time** — you can still jump for a few frames after walking off
  a ledge.
- **Jump buffering** — a jump tapped slightly early still fires the moment
  you land.
- **No game over, ever** — dying (falling in a pit, an enemy hit while
  small, or time running out) just restarts the level instantly. There's
  no fail state that stops play.
- **Assist mode** — after 3 deaths in a session, the player becomes
  invincible to enemy contact for the rest of that session, so nobody can
  get permanently stuck during the event. This is automatic and silent.

## How the hidden clue works

- The secret pipe is a normal-looking green pipe in roughly the last
  quarter of the level. Press "down" while standing on top of it to enter
  (no visual hint marks it as special, by design).
- Inside, the reels keep spinning; each tap of JUMP stops the next reel.
  Match all three to win. A miss just resets the reels — unlimited
  attempts, no penalty.
- On winning, the clue message is shown, then play resumes right back at
  the pipe so the player can continue to the flagpole.
- Reaching the flagpole **without ever finding/winning the secret game**
  shows "You didn't find the hidden clue, start over to try again," and
  restarts the level.
- Reaching the flagpole **after already finding the clue** shows a
  congratulatory completion message instead.

## Project structure

```
index.html          markup + overlays (start, rotate-prompt, message, HUD)
style.css            layout, HUD, touch controls, responsive/orientation CSS
js/sprites.js        pixel-art sprite definitions (Mario, enemies, tiles...)
js/audio.js          procedural 8-bit-style sound effects (WebAudio)
js/input.js          keyboard + touch input
js/level.js          tile map layout + entity spawn list
js/physics.js        movement tuning + tile collision
js/entities.js       player/enemy/mushroom update logic
js/secretRoom.js     Beale Street backdrop rendering
js/minigame.js       the 3-reel picture-matching bonus game
js/ui.js             HUD + message overlay helpers
js/main.js           state machine, camera, render loop, boot
```
