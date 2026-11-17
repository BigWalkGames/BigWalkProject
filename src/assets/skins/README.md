# Keyboard Skins

## Overview

A keyboard skin is a texture that fills every keycap in the game: the on-screen keys, the results heatmap and the 3D keys on Home. All skins live in one file, `key-textures.png`, as a grid of 16×16 tiles, one tile per skin.

The game builds everything else from the tile:

- **The key's shape and shading** come from `src/assets/keyframe.png`. Its face is clear, and its edge and bevel are see-through black, so they darken the texture under them without changing its color.
- **The label color** (dark or light) is picked to read best on the texture.
- **The 3D key sides** are the texture's average color, darkened like the edge.

Pressed keys and unused (blank) keys keep their own solid art in every skin.

## Drawing a tile

| Rule | Why |
|---|---|
| **16×16 pixels** | The game cuts the sheet into 16×16 cells. |
| **1 tile pixel = 1 keycap pixel** | Draw at the same pixel scale as the key art. Don't scale the tile up or down. |
| **Seamless** | The tile repeats across each key, and many times across wide keys like Space and Enter. Seams or a stand-out detail show up as a visible repeating stamp. |
| **Fully opaque** | Transparent pixels show the page behind the key. |
| **Keep the middle readable** | The label sits on top. Very busy or high-contrast patterns make letters hard to read. |

To see the shading as you draw, put `keyframe.png` on a layer above a 32×32 key filled with the tile, starting 2 pixels in from the top-left.

## Adding a skin

1. **Add the tile** to `key-textures.png` in the next empty cell after the last skin.
2. **Register it** by adding one line at the end of `KEY_SKINS` in `src/features/skins/keySkins.ts`:

   ```ts
   { id: 'lava', label: 'Lava' },
   ```

   - `id` is saved as the player's equipped skin. Use lowercase, and never rename or reuse an ID once it ships.
   - `label` is the name shown in the Account → Customization picker.
3. **Run the tests** (`pnpm test`). They fail if the sheet has no cell for a listed skin, or if its size isn't a multiple of 16.
4. **Check it** on the Customization tab, then on a typing screen, the results heatmap and Home.

A tile with no `KEY_SKINS` entry is loaded but never offered, so step 2 is required.

## Sheet order

Cells are read **left to right, then top to bottom**. The first cell is skin 1 in `KEY_SKINS`, the second cell is skin 2, and so on. A player's equipped skin points at a position, so:

- **Only add at the end.** Never reorder, insert or delete cells. Every later skin would shift, and players would silently get a different texture.
- **Fix the width once there are rows.** While the sheet is one row, add cells to the right. Once it has more than one row, keep its width the same and fill the next empty slot. Making it wider moves every cell after the first row.
- **Retiring a skin:** remove it from `KEY_SKINS` but leave its cell in the sheet, so the cells after it don't move.

## Current skins

| # | ID | Name | Notes |
|---|---|---|---|
| 1 | `classic` | Classic | The default. Always the first cell. Guests can only use this one. |
| 2 | `mint` | Mint | Placeholder art |
| 3 | `wood` | Wood | Placeholder art |
| 4 | `speckle` | Speckle | Placeholder art |

Replace the placeholder tiles in place (same cell, same ID) when the final art is ready.

## Not done yet

- **Saving to the account:** the equipped skin is stored in the player's browser only. Moving it to the account, and adding each new ID to the server's skin catalog, is part of M7's server work.
