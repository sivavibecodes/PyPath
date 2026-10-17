import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import { buildEngineHtml } from '../runtime/engineHtml';
import { PYODIDE_FILES, PYODIDE_VERSION } from './pyodideManifest.generated';

export type EngineSource =
  | { kind: 'bundled'; indexUri: string; dirUri: string }
  | { kind: 'cdn'; html: string; baseUrl: string };

const ROOT = `${FileSystem.documentDirectory}pyodide/`;
const CDN_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Fingerprint of the bundled file set; changes whenever the manifest changes. */
function manifestFingerprint(): string {
  return `${PYODIDE_VERSION}|${PYODIDE_FILES.map((f) => f.name).sort().join(',')}`;
}

async function readMarker(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? await FileSystem.readAsStringAsync(uri) : null;
  } catch {
    return null;
  }
}

async function copyBundledFiles(dirUri: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  for (const file of PYODIDE_FILES) {
    const asset = Asset.fromModule(file.module);
    await asset.downloadAsync(); // dev: from Metro; release: from the app bundle / APK raw resources
    if (!asset.localUri) throw new Error(`Asset ${file.name} has no local URI`);
    const target = dirUri + file.name;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: asset.localUri, to: target });
  }
}

async function pruneOldVersions(keep: string): Promise<void> {
  try {
    const entries = await FileSystem.readDirectoryAsync(ROOT);
    await Promise.all(
      entries.filter((e) => e !== keep).map((e) => FileSystem.deleteAsync(ROOT + e, { idempotent: true })),
    );
  } catch {
    /* first install */
  }
}

let inflight: Promise<EngineSource> | null = null;

/**
 * Ensures Pyodide is installed in the app's document directory and returns how
 * the engine WebView should be loaded.
 *
 * First launch: copies ~12 MB of bundled assets (≈1–2 s) and writes a marker.
 * Subsequent launches: verifies the marker and rewrites index.html (cheap) so a
 * runner update shipped in a new app version takes effect immediately.
 * Any failure degrades gracefully to the CDN (online-only) engine.
 */
export function preparePyodide(): Promise<EngineSource> {
  inflight ??= (async (): Promise<EngineSource> => {
    if (PYODIDE_FILES.length === 0 || !FileSystem.documentDirectory) {
      return cdnSource();
    }
    try {
      const dirUri = `${ROOT}${PYODIDE_VERSION}/`;
      const markerUri = `${dirUri}.installed`;
      const fingerprint = manifestFingerprint();

      if ((await readMarker(markerUri)) !== fingerprint) {
        await FileSystem.deleteAsync(dirUri, { idempotent: true });
        await copyBundledFiles(dirUri);
        await FileSystem.writeAsStringAsync(markerUri, fingerprint);
        void pruneOldVersions(PYODIDE_VERSION);
      }

      const indexUri = `${dirUri}index.html`;
      await FileSystem.writeAsStringAsync(indexUri, buildEngineHtml({ indexURL: dirUri, local: true }));
      return { kind: 'bundled', indexUri, dirUri };
    } catch (e) {
      console.warn('[PyPath] Bundled Pyodide unavailable, falling back to CDN:', e);
      return cdnSource();
    }
  })().catch((e) => {
    inflight = null; // allow retry
    throw e;
  });
  return inflight;
}

function cdnSource(): EngineSource {
  return { kind: 'cdn', html: buildEngineHtml({ indexURL: CDN_INDEX, local: false }), baseUrl: 'https://localhost/' };
}

/** For a "Repair engine" action in Settings. */
export async function resetPyodideInstall(): Promise<void> {
  inflight = null;
  await FileSystem.deleteAsync(ROOT, { idempotent: true });
}
