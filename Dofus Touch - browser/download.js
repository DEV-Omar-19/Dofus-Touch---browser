#!/usr/bin/env node
/**
 * Downloads all Dofus Touch game files from Ankama's CDN into ./game/
 * Run this once (or again to update), then start the server.
 */

const fs   = require('fs')
const path = require('path')
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args))

const ORIGIN   = 'https://dt-proxy-production-login.ankama-games.com/'
const GAME_DIR = path.join(__dirname, 'game')
const UA       = 'DofEmu Updater'

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function fetchBinary(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = await res.arrayBuffer()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, Buffer.from(buf))
}

async function main() {
  fs.mkdirSync(path.join(GAME_DIR, 'build'), { recursive: true })

  // ── Write index.html (from DofEmu's game-base) ───────────────────────────
  console.log('Writing index.html...')
  fs.writeFileSync(path.join(GAME_DIR, 'index.html'), INDEX_HTML)

  // ── Write stub fixes ──────────────────────────────────────────────────────
  if (!fs.existsSync(path.join(GAME_DIR, 'fixes.js')))
    fs.writeFileSync(path.join(GAME_DIR, 'fixes.js'), '/* fixes */\n')
  if (!fs.existsSync(path.join(GAME_DIR, 'fixes.css')))
    fs.writeFileSync(path.join(GAME_DIR, 'fixes.css'), '/* fixes */\n')
  if (!fs.existsSync(path.join(GAME_DIR, 'keymaster2.js')))
    fs.writeFileSync(path.join(GAME_DIR, 'keymaster2.js'), '/* keymaster */\n')

  // ── Download game manifest ────────────────────────────────────────────────
  console.log('Fetching manifest.json...')
  const manifest = await fetchJSON(ORIGIN + 'manifest.json')

  const files = Object.values(manifest.files || {})
  console.log(`Found ${files.length} game files to download`)

  let done = 0
  for (const entry of files) {
    const url      = ORIGIN + entry.filename
    const destPath = path.join(GAME_DIR, entry.filename)
    const pct      = Math.round((done / files.length) * 100)

    if (fs.existsSync(destPath)) {
      process.stdout.write(`\r[${pct}%] skipping ${entry.filename} (already exists)    `)
      done++
      continue
    }

    process.stdout.write(`\r[${pct}%] ${entry.filename}    `)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    // JS/CSS/JSON as text to allow regex patching later; everything else binary
    const isText = /\.(js|css|json|html)$/.test(entry.filename)
    if (isText) {
      const text = await fetchText(url)
      fs.writeFileSync(destPath, text, 'utf-8')
    } else {
      await fetchBinary(url, destPath)
    }
    done++
  }

  // ── Download asset map ────────────────────────────────────────────────────
  console.log('\nFetching assetMap.json...')
  const assetMap = await fetchJSON(ORIGIN + 'assetMap.json')
  const assets   = Object.values(assetMap.files || {})
  console.log(`Found ${assets.length} asset files`)

  done = 0
  for (const entry of assets) {
    const url      = ORIGIN + entry.filename
    const destPath = path.join(GAME_DIR, entry.filename)
    const pct      = Math.round((done / assets.length) * 100)

    if (fs.existsSync(destPath)) {
      done++
      continue
    }

    process.stdout.write(`\r[${pct}%] ${entry.filename}    `)
    await fetchBinary(url, destPath)
    done++
  }

  console.log('\n\nDone! Run: node server.js')
}

// ── Exact index.html from DofEmu's game-base, with Cordova shims baked in ──
const INDEX_HTML = `<!DOCTYPE HTML>
<html lang="fr">
  <head>
    <script>
      // ── DofEmu browser extra shims ────────────────────────────────────────
      window.device = {
        platform: 'Android', version: '15', model: 'sdk_gphone64_x86_64',
        manufacturer: 'Google', isVirtual: false, available: true,
        uuid: 'dofemu-' + Math.random().toString(36).slice(2, 10),
        serial: '0000000000000000', sdkVersion: '35',
      };
      // ─────────────────────────────────────────────────────────────────────

      window.ontouchstart = function(e) {};
      window.buildVersion = window.top.buildVersion || '';
      window.appVersion   = window.top.appVersion   || '';
      window.appInfo = { version: window.appVersion };
      window._ = {
        appVersion:   window.appVersion,
        buildVersion: window.buildVersion,
        client: 'android'
      };
      window.indexedDB   = window.indexedDB   || {};
      window.IDBDatabase    = {};
      window.IDBTransaction = {};
      window.IDBCursor      = {};
      window.IDBKeyRange    = {};

      var _deepLinkCallbacks = [];
      window.IonicDeeplink = {
        onDeepLink: function(cb) { _deepLinkCallbacks.push(cb); }
      };
      window.cordova = {
        platformId: 'android',
        InAppBrowser: {
          open: function(url, target) { window.open(url, '_system'); return null; }
        },
        plugins: {
          browsertab: {
            isAvailable: function(cb) { cb(true); },
            openUrl: function(url, success) { window.open(url, '_system'); if (success) success(); },
            close: function() {}
          },
          isemulator: { assess: function(fct) { fct(false); } },
          Keyboard: {
            close: function() {}, disableScroll: function() {},
            show: function() {}, hideKeyboardAccessoryBar: function() {}
          },
          notification:    { local: false },
          pushNotification: {
            onDeviceReady: function() {}, setUserId: function() {}, registerDevice: function() {}
          }
        }
      };
      window.$appSchemeLinkCalled = function(payload) {
        if (!payload) return;
        var qs = payload.indexOf('?') !== -1 ? payload.split('?')[1] : payload;
        for (var i = 0; i < _deepLinkCallbacks.length; i++) {
          _deepLinkCallbacks[i]({ queryString: qs });
        }
      };
      window.initDofus = function(cb) {
        var head = document.getElementsByTagName('head')[0];
        var s = document.createElement('script');
        s.addEventListener('load', function() {
          var f = document.createElement('script');
          f.src = 'fixes.js'; head.appendChild(f); cb();
        });
        s.src = 'build/script.js'; head.appendChild(s);
      };
    </script>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="build/styles-native.css" />
    <link rel="stylesheet" href="fixes.css" />
  </head>
  <body></body>
  <script src="keymaster2.js"></script>
  <script>
    // Fire deviceready — triggers the game's bootstrap listener
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        document.dispatchEvent(new Event('deviceready'));
        // Also call initDofus directly in case the game listens for it
        if (typeof window.initDofus === 'function') {
          window.initDofus(function() {});
        }
      }, 100);
    });
  </script>
</html>`

main().catch(err => { console.error('\nError:', err.message); process.exit(1) })
