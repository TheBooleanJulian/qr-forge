# QR Forge

**Create. Customise. Connect.**

A browser-based QR code designer by [TheBooleanJulian](https://github.com/TheBooleanJulian). No account, no backend, no build step.

**Live:** https://qr-forge.thebooleanjulian.dev

## Features

### Editor
The Design panel is split into collapsible sections (open/closed state is remembered). A preset menu and a Reset button sit above them.

- **Destination**: URL with validation
- **Branding**: centre icon (upload any image), icon size, padded or clean-square clearance, invert
- **QR appearance**: dot style, corner style, separate finder-centre style, optional finder colours, solid / linear / radial fill with up to four colour stops
- **Canvas**: size, padding, background radius, transparent background
- **Label**: text under the code, font, size, alignment, colour
- **Frame**: SCAN ME, SCAN HERE, VISIT WEBSITE, VIEW PORTFOLIO or custom text, with frame colour, text colour, typography, radius and padding. The code keeps its own quiet zone inside the frame.
- **Advanced**: error correction L / M / Q / H, quiet zone, structure protection, scan check

The preview has zoom, fit, 100%, grid / dark / light / paper backgrounds, a checkerboard toggle for transparency, and a size readout.

### Presets
Minimal black, Corporate, Rounded modern, Brand accent, Inverted dark, Photography portfolio. A preset sets several appearance properties at once; change anything afterwards and the menu returns to Custom. Reset restores every design default but keeps your URL.

### Scan check
Validation runs on the **rendered image** (logo, colours, gradient, frame and all), not on the QR data:

1. The final render is decoded with [jsQR](https://github.com/cozmo/jsQR), plus the browser's `BarcodeDetector` where it exists.
2. The decoded text is compared with the destination.
3. Status: **Valid** (decoded, matches, no design warnings), **Warning** (decoded, but something may hurt reliability) or **Failed** (not decoded, or different content).

Design checks add contrast (weakest gradient stop and finder colours included), inverted codes, icon coverage against error correction, icon overlap with finder, timing and alignment patterns, quiet zone and module size. Contrast, error correction, icon size and quiet zone each have a one-click fix. **Protect structure** keeps the icon clear of the finder patterns and draws timing and alignment patterns as solid modules.

### Export
One dialog for all formats, with a file name of the form `qr-forge_[design-name]_[timestamp]`.

- **PNG**: standard, 2×, 4× or custom width; transparent background; label or frame on/off
- **SVG**: real vector paths (modules merged into a few `<path>` elements), gradients as SVG gradients. Label text stays live text, so convert it to outlines if the font may be missing.
- **PDF**: vector QR with gradient shadings, A4 / A5 / A6 / Letter or fit-to-QR, QR width and margin in mm. Label text uses Helvetica; non-Latin characters become `?`.

### Library
Saved designs live in your browser's localStorage (per device). Each has a name, thumbnail, URL, created and modified dates and the full design. Search, sort (modified / created / name / scans), filter (logo, gradient, frame, transparent), list or grid view, edit, export, duplicate, rename, delete (with confirmation), JSON download, and a manual scan counter.

**Project files** (`.qrforge.json`) hold one design: content, design settings, preset, logo (embedded, max 256 px PNG) and a `schema` version. Import validates everything: it rejects unknown or newer schemas, caps size, clamps every value, and drops logos that are not small raster images.

### Batch
Upload a CSV, choose the destination column (and an optional name column), see each row's status (empty, invalid, duplicate), then generate. Download one by one or as a ZIP, as PNG or SVG. It uses the design currently set in the Editor. Limit: 1000 rows.

### Print
Lay out the current design at true size and export a vector PDF. Layouts: business card, A4 flyer, sticker, product label, table display, poster, or custom page size. Set margin, QR size and position, headline and supporting text with positions, and repeat the layout across × down on one page.

## Usage

Use the live site, open `index.html` in a browser, or serve the folder with any static host.

Fonts (Chakra Petch, IBM Plex Sans, JetBrains Mono via Google Fonts) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (cdnjs) load from CDNs. [jsQR](https://github.com/cozmo/jsQR) 1.4.0 (jsDelivr) loads the first time the scan check runs. Without network access the editor still draws, but fonts fall back and the decode check shows as unavailable.

## Architecture

Plain scripts, no bundler. Each file owns one job:

| File | Job |
|---|---|
| `js/core.js` | Settings schema, defaults, presets, colour maths, sanitising, project files |
| `js/scene.js` | Settings + QR matrix → a list of shapes ("scene"). All styling lives here. |
| `js/draw.js` | Scene → canvas; image helpers |
| `js/svg.js`, `js/pdf.js` | Scene → SVG / PDF (hand-written writers, no libraries) |
| `js/validate.js` | Design checks, one-click fixes, decoding the rendered image |
| `js/export.js`, `js/zip.js`, `js/csv.js` | File names and downloads, ZIP writer, CSV parser and batch row checks |
| `js/library.js` | Library storage behind an async `QF.store` interface |
| `js/print.js` | Print layout maths and PDF |
| `js/app.js` | Wires the page to the modules above |

Because canvas, SVG and PDF all draw the same scene, a style change is made once and shows up in every output.

### Future modules (not built)
These are deliberately out of scope. Static QR codes cannot change destination after printing, and there are no analytics.

- **Dynamic QR codes** (redirect URLs, editable destinations): project files already carry `content.type`, so a `redirect` type can be added without changing the schema's shape.
- **Analytics**: the manual "+1" counter is a local note, not measurement.
- **Cloud sync and accounts**: implement the `QF.store` interface (`list`, `get`, `put`, `remove`) against a remote backend. The UI only talks to that interface. IndexedDB can replace localStorage the same way.

## Tests

No installs needed.

```
node --test tests/unit.test.js        # pure logic: schema, scene, SVG, PDF structure, ZIP, CSV, validation, library, print
```

Browser tests run in any Chromium browser. In headless mode:

```
msedge --headless --allow-file-access-from-files --virtual-time-budget=300000 --dump-dom tests/decode.html
msedge --headless --allow-file-access-from-files --virtual-time-budget=300000 --dump-dom tests/pdf.html
msedge --headless --allow-file-access-from-files --virtual-time-budget=300000 --dump-dom tests/smoke.html
```

Each prints a PASS/FAIL list and a `RESULT:` line inside `<pre id="out">`.

- `decode.html`: renders 50+ cases (black on white, custom and inverted colours, rounded / dots, finder colours, every error-correction level, centre logos, gradients, transparent, frames, quiet zone, sizes, every preset with and without a logo, PNG exports from 200 to 3040 px, and SVG output) and decodes each with **two independent decoders**, jsQR and ZXing. It also checks that the validator agrees with the decoders.
- `pdf.html`: builds PDFs, renders them with pdf.js and decodes the rendered page; checks page sizes to the millimetre.
- `smoke.html`: drives the real page: presets, library, search, import/export, exports, batch, print.

The test pages load jsQR, ZXing and pdf.js from CDNs; none are app dependencies.

## Deployment

Hosted on Cloudflare Workers (static assets) at `qr-forge.thebooleanjulian.dev`. [wrangler.jsonc](wrangler.jsonc) serves the repo root; [.assetsignore](.assetsignore) keeps non-site files (tests, README, config) out of the upload. Deploy with `npx wrangler deploy`. To roll back the custom domain, remove `routes` and redeploy.

## License

MIT — see [LICENSE](LICENSE).
