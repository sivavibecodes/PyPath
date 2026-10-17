import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Single encrypted-at-rest-capable MMKV instance for app state. */
export const storage = new MMKV({ id: 'pypath-v1' });

/** zustand `persist` adapter — MMKV is synchronous, so hydration is instant on cold start. */
export const mmkvStateStorage: StateStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

/** Supabase auth session storage (same instance, namespaced keys). */
export const supabaseAuthStorage = {
  getItem: (key: string) => storage.getString(`sb:${key}`) ?? null,
  setItem: (key: string, value: string) => storage.set(`sb:${key}`, value),
  removeItem: (key: string) => storage.delete(`sb:${key}`),
};
