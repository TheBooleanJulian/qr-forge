# QR Forge

A single-file, browser-based QR code designer by [TheBooleanJulian](https://github.com/TheBooleanJulian). Open `index.html` — no build step, no backend.

## Features

- Custom centre icon (upload any image), adjustable size, padded or clean-square backing, optional invert
- Dot styles (square / rounded / dots) and corner styles (square / rounded / dot)
- Foreground/background colours, QR size, padding, background radius
- Optional text label under the code
- Error correction levels L / M / Q / H
- Export PNG or copy to clipboard
- Library tab: save named QR designs and log scans against them (stored in your browser's localStorage, per device)

## Usage

Open `index.html` in a browser, or serve the folder with any static host.

Fonts (Google Fonts) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (cdnjs) load from CDNs, so an internet connection is needed.

## License

MIT — see [LICENSE](LICENSE).
