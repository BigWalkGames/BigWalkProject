# Fonts

Players pick two fonts in **Settings > Gameplay**:

| Setting | CSS variable | Used for |
| --- | --- | --- |
| Menu Font | `--font` | Everything except the words being typed: menus, buttons, tabs, HUD, results |
| Typing Font | `--font-typing` | The words in a match (Time Attack, Quick Match, Custom Game) and the results Word Bank |

Both start on **Jersey 10**. The choice is saved on the device (`localStorage` key `bigwalk.fontSettings`).

## Files

| File | What it does |
| --- | --- |
| `fonts.ts` | The list of fonts (`FONTS`) and the default (`DEFAULT_FONT`). **Edit this file to add a font.** |
| `fontSettings.ts` | Saves the player's two choices, loads the fonts, and sets the CSS variables. |
| `loadFont.ts` | Loads a font and scales it to match Jersey 10's size (see below). |
| `fonts.test.ts` | Tests. |

`src/main.tsx` calls `applyFontSettings()` once at startup. After that, every change from the Settings screen applies right away without a reload.

## Current fonts

| Font | Kind | Source |
| --- | --- | --- |
| Jersey 10 (default) | Pixel | Google Fonts |
| Roboto Slab | Serif | Google Fonts |
| Cascadia Mono | Sans-serif monospace | Google Fonts |
| OpenDyslexic | Dyslexia-friendly | Fontsource on jsDelivr (it isn't on Google Fonts) |

## Adding a font

Add one entry to `FONTS` in `fonts.ts`. It shows up in both dropdowns.

**From Google Fonts:** use the family name exactly as Google Fonts spells it. The stylesheet URL is built from the name.

```ts
{ name: 'Press Start 2P', fallback: 'monospace' },
```

**From another font service:** also give `url`, a stylesheet that declares an `@font-face` whose `font-family` matches `name` exactly. The service must allow cross-origin requests (send `Access-Control-Allow-Origin`), because the app downloads the stylesheet itself to read it. Google Fonts, Fontsource/jsDelivr and most font CDNs do.

```ts
{ name: 'OpenDyslexic', fallback: 'sans-serif', url: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/index.css' },
```

Fields:

- `name`: the CSS font family name. It's also the text in the dropdown and the value saved for the player, so renaming a font sends anyone who picked it back to the default.
- `fallback`: `serif`, `sans-serif` or `monospace`. Shown if the font can't load.
- `url` (optional): leave it out for Google Fonts.

To check a Google Fonts name, open `https://fonts.googleapis.com/css2?family=Font+Name` (spaces as `+`). A 400 response means Google doesn't host that name.

## Size matching

Every size in the app (the `--fs-*` scale in `src/index.css` and the hard-coded `px` sizes) was designed for Jersey 10, which is very narrow. At the same pixel size the other fonts are much wider: OpenDyslexic is about 2.1x, which pushes text off the screen.

So each font is scaled to take up about as much room as Jersey 10 (`SIZE_REFERENCE_FONT` in `fonts.ts`). When a font is first picked, `loadFont()`:

1. Downloads the font's stylesheet and reads its `@font-face` rules.
2. Measures the width of a few ordinary sentences in that font and in Jersey 10, using a temporary unscaled copy of each.
3. Registers the font with `size-adjust` set to Jersey 10's width divided by the font's width.
4. Waits for it to be ready. Only then does the screen switch to it, so the old font stays up while the new one loads.

`size-adjust` resizes the font itself, so every place it's used matches, whatever its `font-size` is. Nothing else in the CSS needs to know about scaling, and new fonts are scaled with no extra work.

Scales measured in Chrome (they're measured on the player's machine each time, not stored):

| Font | Scale | Width vs Jersey 10 after scaling |
| --- | --- | --- |
| Jersey 10 | 100% | 1.00x |
| Roboto Slab | ~73% | 0.96-1.01x |
| Cascadia Mono | ~60% | 0.97-0.99x |
| OpenDyslexic | ~47% | 0.94-1.00x |

Width is what's matched, because width is what overflows. Fonts with tall letters for their width (like OpenDyslexic) also stay a bit shorter than Jersey 10.

## Things to know

- **Only fonts in use are downloaded.** A font loads the first time it's picked, along with Jersey 10 to measure against, so the other fonts in the list cost nothing. Within a font, only the character sets on screen are downloaded.
- **Fonts need a connection.** None are bundled anymore. If the font service can't be reached, text shows in the `fallback` family.
- **First load shows the fallback briefly.** On the very first paint no font is registered yet, so text uses the system monospace font until Jersey 10 (or the player's choice) is ready, usually a fraction of a second.
- **Removing a font is safe.** Saved choices that are no longer in `FONTS` go back to the default when the app loads.
- **The 3D flourish doesn't follow the setting.** It draws Jersey 10 from its own three.js typeface file (`src/features/3d-flourish/fonts`).
