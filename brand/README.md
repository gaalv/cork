# Noxe brand assets

Source-of-truth vector assets for the Noxe app. Derived rasters
(`src-tauri/icons/*`, `public/favicon.png`) are regenerated from
`noxe-logo.svg` via `pnpm tauri icon brand/noxe-logo.png` after any
update to the source SVG.

## Files

| File                | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `noxe-logo.svg`     | Square app glyph (used for icons, favicon, NavPane brand badge). |
| `noxe-wordmark.svg` | Wordmark (used in README banner, HelpModal, EmptyVault hero).    |
| `noxe-logo.png`     | 1024×1024 PNG render of the glyph — feeds `tauri icon`.          |

## Palette

- **Primary indigo:** `#3F3DFF` → `#1F1D5A` linear gradient
- **Ink:** `#0F172A`
- **Paper:** `#FFFFFF`
- **Accent (ember):** `#FF9A3C`

## Regenerating the Tauri icon matrix

```sh
pnpm tauri icon brand/noxe-logo.png
```

This rewrites every file under `src-tauri/icons/`. Commit the result.

## Regenerating `noxe-logo.png`

```sh
# Using rsvg-convert (preferred — sharper)
rsvg-convert -w 1024 -h 1024 brand/noxe-logo.svg -o brand/noxe-logo.png

# Or with ImageMagick
magick brand/noxe-logo.svg -background none -resize 1024x1024 brand/noxe-logo.png
```
