# Manager icons

Every manager's badge — the colour tile and dark monogram the site uses as its
identity unit — exported as a standalone file you can hand to a group chat, a
slide, or an avatar upload.

Sixteen managers, four files each:

| File | Use |
| --- | --- |
| `<id>.svg` | scalable, Barlow Condensed embedded, ~5 KB |
| `<id>-1024.png` | print, big slides |
| `<id>-512.png` | avatars, chat icons |
| `<id>-128.png` | list rows, favicons |

PNGs have transparent corners, so the tile keeps its rounded shape on any
background.

## Regenerating

```
npm run icons        # or: node scripts/manager_icons.mjs
```

The script reads names from `public/data/managers.json` and colours from
`src/lib/identity.ts`, so a new manager or a recoloured badge only has to be
changed in one place. It writes nothing back to `public/data`. Rasterising
needs a Chrome or Chromium on the machine (set `CHROME_PATH` if it is
somewhere unusual) and one call to Google Fonts for the display face.
