/**
 * OPFS / Grounded Memory System
 * Handles MEM_SAVE and MEM_LOAD patterns to ensure local, persistent data.
 */

// Simple wrapper for user preferences (MEM_SAVE / MEM_LOAD)
export const savePreference = async (key: string, value: any) => {
  localStorage.setItem(`mem_${key}`, JSON.stringify(value));
  console.log(`[MEM_SAVE] Saved preference: ${key}`);
};

export const loadPreference = async (key: string) => {
  const item = localStorage.getItem(`mem_${key}`);
  console.log(`[MEM_LOAD] Loaded preference: ${key}`);
  return item ? JSON.parse(item) : null;
};

// OPFS (Origin Private File System) wrapper for persistent files (CSVs, Excels, PDFs)
export const getPersistentDirectory = async () => {
    try {
        const dir = await navigator.storage.getDirectory();
        return dir;
    } catch (e) {
        console.error("OPFS not supported or available", e);
        return null;
    }
}

export const saveFileToOPFS = async (fileName: string, content: string | Blob) => {
    const dir = await getPersistentDirectory();
    if (!dir) return;

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    // Note: createWritable is part of the File System Access API
    // Need to cast to any for strict TS, but it works in modern browsers
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
    console.log(`[OPFS_SAVE] Saved file locally to OPFS: ${fileName}`);
}
