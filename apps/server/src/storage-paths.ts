import { resolve } from 'path';

export function storageRoot() {
  return resolve(process.env.STORAGE_ROOT || process.env.EXPORT_STORAGE_ROOT || 'storage');
}

export function storagePath(...parts: string[]) {
  return resolve(storageRoot(), ...parts);
}
