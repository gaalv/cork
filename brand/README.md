# Cork brand assets

Source-of-truth assets for the Cork app. Derived rasters
(`src-tauri/icons/*`, `public/favicon-32.png`) are regenerated from
`cork-logo.png` via `pnpm tauri icon brand/cork-logo.png`.

## Files

| File                 | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `cork-logo.png`      | 1024×1024 app icon PNG (dark variant) — feeds `tauri icon`.   |
| `cork-mark-black.svg`| Glyph-only vector mark, black stroke. For light backgrounds.  |
| `cork-mark-white.svg`| Glyph-only vector mark, white stroke. For dark backgrounds.   |

## Regenerating the Tauri icon matrix

```sh
pnpm tauri icon brand/cork-logo.png
```

This rewrites every file under `src-tauri/icons/`. Commit the result.
