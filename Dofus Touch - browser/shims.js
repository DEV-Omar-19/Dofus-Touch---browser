(function () {
  // ── IndexedDB-backed file storage (replaces cordova.file) ─────────────────
  const IDB_NAME = 'dofemu-fs';
  const IDB_STORE = 'files';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const FileSystem = {
    async readFile(path) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(path);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async writeFile(path, data) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const req = tx.objectStore(IDB_STORE).put(data, path);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async removeFile(path) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const req = tx.objectStore(IDB_STORE).delete(path);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  };

  // ── device plugin ──────────────────────────────────────────────────────────
  window.device = {
    platform:     'Android',
    version:      '15',
    model:        'sdk_gphone64_x86_64',
    manufacturer: 'Google',
    isVirtual:    false,
    uuid:         'dofemu-browser-' + Math.random().toString(36).slice(2, 10),
    serial:       '0000000000000000',
    sdkVersion:   '35',
    available:    true,
  };

  // ── cordova object ─────────────────────────────────────────────────────────
  window.cordova = {
    platformId: 'android',
    version:    '11.0.0',

    // File paths — the game uses these as storage roots
    file: {
      dataDirectory:         'idb://data/',
      cacheDirectory:        'idb://cache/',
      tempDirectory:         'idb://temp/',
      documentsDirectory:    'idb://documents/',
      applicationDirectory:  'idb://app/',
      externalDataDirectory: 'idb://ext-data/',
    },

    // InAppBrowser shim — just open a real tab
    InAppBrowser: {
      open(url, target, options) {
        const win = window.open(url, target || '_blank');
        return {
          close: () => win && win.close(),
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }
    },

    plugins: {
      // Keyboard plugin — no-op in browser
      Keyboard: {
        hideFormAccessoryBar: () => {},
        disableScroll: () => {},
        show: () => {},
        hide: () => {},
        shrinkView: () => {},
      },

      // File plugin shim
      file: {
        resolveLocalFileSystemURL(path, success, error) {
          success && success({ fullPath: path, isFile: true, isDirectory: false,
            file(cb) { cb(new File([], path.split('/').pop())); },
            createWriter(cb) {
              cb({
                write(data) { FileSystem.writeFile(path, data).then(() => this.onwriteend && this.onwriteend()); },
                seek() {},
                truncate() {},
                onwriteend: null,
                onerror: null,
              });
            }
          });
        }
      },

      // StatusBar — no-op
      statusbar: {
        overlaysWebView: () => {},
        styleDefault: () => {},
        styleLightContent: () => {},
        hide: () => {},
        show: () => {},
        backgroundColorByHexString: () => {},
      },

      // SplashScreen — no-op
      splashscreen: {
        hide: () => {},
        show: () => {},
      },

      // Network info
      networkInformation: {
        type: 'wifi',
        CONNECTION: { WIFI: 'wifi', CELL: 'cell', NONE: 'none', UNKNOWN: 'unknown' },
      },
    },

    // exec — stub for any plugin calls not individually shimmed
    exec(success, error, service, action, args) {
      console.debug(`[cordova.exec] ${service}.${action}`, args);
      if (service === 'Device' && action === 'getDeviceInfo') {
        success && success(window.device);
        return;
      }
      if (service === 'NetworkStatus' && action === 'getConnectionInfo') {
        success && success('wifi');
        return;
      }
      // Default: no-op success
      success && success(null);
    },

    fireDocumentEvent(type, data) {
      const ev = new CustomEvent(type, { detail: data });
      document.dispatchEvent(ev);
    },
    fireWindowEvent(type, data) {
      const ev = new CustomEvent(type, { detail: data });
      window.dispatchEvent(ev);
    },
  };

  // ── navigator overrides ────────────────────────────────────────────────────
  // The game may check navigator.platform / userAgent to branch between iOS / Android
  try {
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l', configurable: true });
  } catch (_) {}

  // App scheme — the game may try to open deep links via these protocols
  window.handleOpenURL = window.handleOpenURL || function(url) {
    console.info('[dofemu-shims] handleOpenURL:', url);
  };

  // ── localStorage fallback (already exists in browser, just make sure) ──────
  window.localStorage = window.localStorage || {};

  // ── vibration ──────────────────────────────────────────────────────────────
  window.navigator.vibrate = () => {};

  // ── Touch events passthrough ───────────────────────────────────────────────
  // Most modern browsers support touch events; nothing extra needed.

  // ── fire deviceready ───────────────────────────────────────────────────────
  // Cordova fires this once plugins are loaded. We fire it immediately.
  function fireReady() {
    console.info('[dofemu-shims] Firing deviceready');
    document.dispatchEvent(new Event('deviceready'));
    // Some versions of the game listen on window too
    window.dispatchEvent(new Event('deviceready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireReady);
  } else {
    fireReady();
  }

  console.info('[dofemu-shims] Cordova environment shimmed ✓');
})();
