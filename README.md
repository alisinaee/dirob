# Dirob

Dirob is a Chrome side-panel extension for comparing Digikala and Torob prices while browsing listing and product pages.

## Features

- Side-panel comparison between Digikala and Torob
- Listing and detail page support
- Guide numbers on the page and in the panel
- Element select mode
- Sync-with-view mode
- List and grid layouts
- Minimal compact view
- Local development logs via `run-dirob-helper`

## Development

### Install In Chrome (Manual)

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode` (top-right).
3. Click `Load unpacked`.
4. Select this project folder (the folder that contains `manifest.json`).
5. Open the extension details and pin/open the side panel from the toolbar if needed.
6. For code changes, click `Reload` on the extension card in `chrome://extensions`.

### Logger Setup (Recommended)

One-time auto-start setup:

```bash
./run-dirob-helper --install-autostart
```

Check status:

```bash
./run-dirob-helper --status
```

Foreground/manual mode:

```bash
./run-dirob-helper
```

After setup, open Digikala or Torob pages and use the Dirob side panel.

## License

MIT

## Creator

- GitHub: [alisinaee](https://github.com/alisinaee)
- LinkedIn: [alisinaee](https://www.linkedin.com/in/alisinaee)
