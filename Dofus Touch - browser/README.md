# dofemu-browser

Run Dofus Touch in any desktop browser via a local proxy + Cordova shims.

## How it works

Dofus Touch is built with Apache Cordova — it's a web app that expects a
Cordova-style mobile environment (deviceready event, file plugin, device info,
etc.). A plain browser doesn't provide those, so the game hangs on boot.

This server:
1. Proxies the official Dofus Touch CDN through `localhost:3000`
2. Injects `shims.js` into every HTML response — this fakes the Cordova
   environment so the game boots normally
3. Strips CSP headers that would otherwise block the injected shims

## Setup

```bash
npm install
node download.js
node server.js
```

Then open **http://localhost:3000** in your browser.

## Notes

- Log in with your normal Ankama account — the game connects to Ankama's
  servers just like the official app does.
- Multi-account: open multiple tabs, each with its own session (browsers
  isolate cookies per tab by default; for truly separate sessions use
  different browser profiles).
- If the game shows a blank screen, open DevTools → Console and look for
  errors. The most common issue is the CDN URL changing — update `GAME_ORIGIN`
  in `server.js` to match.
- This is an unofficial client, not affiliated with or approved by Ankama.
  Use at your own risk.

## File storage

The `cordova.file` plugin normally writes to the device filesystem. The shims
replace it with **IndexedDB** so cached game assets persist between sessions
in the browser.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page, no errors | Check `GAME_ORIGIN` in `server.js` |
| `deviceready` never fires | Open console — shims should log `Cordova environment shimmed ✓` |
| Login redirect broken | Ankama may use a redirect URL that doesn't pass through the proxy — check the Network tab |
| Assets 404 | The game may request assets from a different subdomain; add a second proxy for it |
