# Police Chase — project conventions

## Git identity

This is a **personal** project. Commit as:

```
user.name  = buildbyfahad
user.email = fahadittechnical@gmail.com
```

The machine's global git config is the Zluck **office** identity
(`Fahad Jariwala` / `fahadj@zluck.in`) and will be inherited silently if the
local config is missing. Never use it here. Verify before pushing:

```bash
git log --format='%an <%ae>' -1
```

## Commit messages

Plain messages describing the change. **No AI or tool attribution of any kind** —
no `Co-Authored-By: Claude`, no "Generated with Claude Code", no trailer block.
This applies to commit messages and pull request descriptions alike.

## Remote

```
git@github.com:buildbyfahad/police-chase-browser-game.git
```

Note: the only SSH key on this machine authenticates to GitHub as `fahad-zluck`
(the office account). Commit *authorship* is controlled by the local git config
above and is what GitHub displays, but the *push* itself uses whichever
credential is configured.

## Code conventions

- All gameplay tuning lives in `src/game/config/GameConfig.ts` — no magic numbers
  in the systems.
- One manager per concern in `src/game/systems/`. Don't grow `GameScene`.
- No asset files. Art is drawn procedurally in `src/game/utils/Textures.ts`;
  audio is synthesised in `src/game/systems/AudioManager.ts`.
- Pool anything that spawns during a run. A run should not allocate after
  `create()`.
- `npm run build` runs `tsc --noEmit` first — keep it clean.
