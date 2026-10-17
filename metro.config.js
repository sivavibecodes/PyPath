// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Pyodide runtime files (wasm, stdlib zip, wheels, loader JS) are vendored as
// opaque `.bin` assets by scripts/fetch-pyodide.mjs. Renaming them avoids two
// problems: Metro would try to *compile* pyodide.js as app source, and Android
// raw-resource names collide when files differ only by extension
// (pyodide.asm.js vs pyodide.asm.wasm -> "pyodideasm").
for (const ext of ['bin', 'wav']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}

module.exports = config;
