// ═══════════════════════════════════════════════════
// Storage layer for WHOOP synced data
// Uses Vercel Blob in production, local JSON file in dev
// ═══════════════════════════════════════════════════

import { put, get } from "@vercel/blob";

const BLOB_KEY = "whoop-activities.json";
const SYNC_META_KEY = "whoop-sync-meta.json";

/**
 * Check if Vercel Blob is configured
 */
function hasBlobStorage() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Read a JSON blob from Vercel Blob (private store).
 * Uses the same pattern as token-store.js (which works).
 */
async function readBlob(key) {
  const result = await get(key, { access: "private" });
  if (!result || result.statusCode === 404) return null;
  if (!result.stream) return null;
  const response = new Response(result.stream);
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

/**
 * Store activities data (Vercel Blob or in-memory fallback)
 */
export async function storeActivities(data) {
  if (hasBlobStorage()) {
    await put(BLOB_KEY, JSON.stringify(data), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    console.log("[storage] Activities stored to blob");
    return { storage: "blob" };
  }

  // Local dev: write to filesystem
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "src", "lib", "synced-activities.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return { storage: "local", path: filePath };
}

/**
 * Retrieve stored activities data
 */
export async function getActivities() {
  if (hasBlobStorage()) {
    try {
      const data = await readBlob(BLOB_KEY);
      console.log("[storage] Activities loaded from blob:", data ? "found" : "empty");
      return data;
    } catch (e) {
      console.error("[storage] Blob read error:", e.message);
      return null;
    }
  }

  // Local dev: read from filesystem
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "src", "lib", "synced-activities.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Store sync metadata (last sync time, counts, etc.)
 */
export async function storeSyncMeta(meta) {
  if (hasBlobStorage()) {
    await put(SYNC_META_KEY, JSON.stringify(meta), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    console.log("[storage] Sync meta stored to blob");
    return;
  }

  // Local dev
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "src", "lib", "sync-meta.json");
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2));
}

/**
 * Get sync metadata
 */
export async function getSyncMeta() {
  if (hasBlobStorage()) {
    try {
      const data = await readBlob(SYNC_META_KEY);
      console.log("[storage] Sync meta loaded from blob:", data ? "found" : "empty");
      return data;
    } catch (e) {
      console.error("[storage] Sync meta read error:", e.message);
      return null;
    }
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "src", "lib", "sync-meta.json");
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
