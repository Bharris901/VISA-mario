# Mini-game card images

Drop the final Beale Street mini-game images in this folder (e.g.
`card-duck.png`, `card-guitar.png`, `card-bbq.png`, `card-note.png` — any
names you like) and point to them from `js/minigame.js`:

```js
const CARD_DEFS = [
  { id: 'a', label: 'DUCK', color: '#e5c14a', img: 'assets/card-duck.png' },
  { id: 'b', label: 'GTR',  color: '#c65b3a', img: 'assets/card-guitar.png' },
  { id: 'c', label: 'BBQ',  color: '#a9432e', img: 'assets/card-bbq.png' },
  { id: 'd', label: 'NOTE', color: '#3f7d5c', img: 'assets/card-note.png' },
];
```

Square images work best (they're drawn at 64x64). Until `img` is set for a
card, it renders as a colored placeholder square with its label instead —
safe to leave some placeholders and swap others in as they're ready.
