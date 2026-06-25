# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

Open `index.html` directly in a browser — no build step, no server, no dependencies. Everything runs client-side with the native Canvas API.

## File Structure

```
index.html       # Entry point, canvas, HUD elements, game-over/win overlays
src/style.css    # All styling
src/game.js      # All game logic
```

## Architecture

**Game loop** (`gameLoop`): called via `requestAnimationFrame`. Each frame: clear canvas → `drawBackground` → `updatePlayer` / `updateEnemies` / `updateCollectibles` → draw everything → `drawHUD`.

**World** is built once by `buildWorld()` and stored in the `world` object, which contains:
- `platforms` — ground segments (with random gaps) plus elevated platforms
- `enemies` — patrolling enemies placed on ground segments
- `collectibles` — coins placed above elevated platforms
- `portal` — the win condition at `x = WORLD_WIDTH - 120`

The world is 6000px wide (`WORLD_WIDTH`). On restart, `buildWorld()` is called again to regenerate the layout.

**Camera**: `cameraX` is a world-space offset. All draw functions convert world coordinates to screen via `wx(x) = x - cameraX`. The camera tracks the player horizontally, clamped to world bounds.

**Difficulty scaling** happens inside `buildWorld()`: gap probability and enemy count/speed all increase linearly with the segment's X position relative to `WORLD_WIDTH`.

**Player state** is a single mutable object (`player`) with position, velocity, flags (`onGround`, `dashing`, `crouching`, `invulnerable`), and cooldown counters. Physics are manual: gravity accumulates `velocityY` each frame, AABB collision (`checkCollision`) with platforms zeroes velocity and sets `onGround`.

**Scoring**: progress score is `Math.floor(player.x / 10)`, updated every frame. Coins add 50 pts, stomping an enemy adds 100 pts.

**Win/lose**: touching the portal calls `winGame()` (shows `#gameWin`); losing all lives calls `endGame()` (shows `#gameOver`). Both are overlays in `index.html`. `restartGame()` resets all state and calls `buildWorld()`.

**Player character**: drawn as a stick figure in `drawPlayer()` using canvas strokes — circle head, line body, V-arms, V-legs. Color changes to red while dashing. Blinks when invulnerable.

## Key Quirks

- Dash uses `setTimeout` (200 ms) to clear `player.dashing`, mixed with a frame-counted `dashCooldown`. The two clocks can drift on tab-blur/focus.
- `buildWorld()` uses `GROUND_Y()` which reads `canvas.height` at call time — if called before the canvas is sized, platforms will be misaligned.
- Enemy stomp is detected by checking `player.velocityY > 0 && player.y + player.height < enemy.y + enemy.height * 0.5`. Touching from the side or below triggers damage instead.
