# QR Forge

A single-file, browser-based QR code designer by [TheBooleanJulian](https://github.com/TheBooleanJulian). Open `index.html` — no build step, no backend.

## Features

The Design panel is split into collapsible sections (open/closed state is remembered):

- **Destination** — URL with validation
- **Branding** — custom centre icon (upload any image), icon size, padded or clean-square clearance, invert
- **QR appearance** — dot styles (square / rounded / dots), corner styles (square / rounded / dot), separate finder-centre style, foreground/background colours, optional two-colour gradient with angle
- **Canvas** — QR size, padding, background radius, transparent background (PNG keeps its alpha channel)
- **Label** — optional text under the code with font (Chakra Petch / IBM Plex Sans / JetBrains Mono / system), size, alignment and colour
- **Advanced** — error correction L / M / Q / H, quiet zone, and a live scan check (contrast, icon coverage vs error correction, quiet zone, module size, plus a decode test in browsers with `BarcodeDetector`)

Also: export PNG or copy to clipboard, and a Library tab to save named QR designs and log scans against them (stored in your browser's localStorage, per device). Designs saved before a setting existed load with that setting's default.

The UI follows the Julian Unified UI design system (dark default, light mode via the header toggle, follows `prefers-color-scheme` first).

## Usage

Open `index.html` in a browser, or serve the folder with any static host.

Fonts (Chakra Petch, IBM Plex Sans, JetBrains Mono via Google Fonts) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (cdnjs) load from CDNs, so an internet connection is needed.

## License

MIT — see [LICENSE](LICENSE).
