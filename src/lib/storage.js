// ═══════════════════════════════════════════════════
// Storage layer for WHOOP synced data
// Uses Vercel Blob in production, local JSON file in dev
// ═══════════════════════════════════════════════════

const BLOB_KEY = "whoop-activities.json";
const SYNC_META_KEY = "whoop-sync-meta.json";

/**
 * Check if Vercel Blob is configured
 */
function hasBlobStorage() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Store activities data (Vercel Blob or in-memory fallback)
 */
export async function storeActivities(data) {
  if (hasBlobStorage()) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, JSON.stringify(data), {
      addRandomSuffix: false,
    });
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
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: BLOB_KEY.replace(".json", "") });
      const blob = blobs.find(b => b.pathname === BLOB_KEY);
      if (!blob) return null;
      // Use downloadUrl for private stores, fallback to url for public
      const fetchUrl = blob.downloadUrl || blob.url;
      const resp = await fetch(fetchUrl);
      return await resp.json();
    } catch (e) {
      console.error("Blob read error:", e);
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
    const { put } = await import("@vercel/blob");
    await put(SYNC_META_KEY, JSON.stringify(meta), {
      addRandomSuffix: false,
    });
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
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: SYNC_META_KEY.replace(".json", "") });
      const blob = blobs.find(b => b.pathname === SYNC_META_KEY);
      if (!blob) return null;
      const fetchUrl = blob.downloadUrl || blob.url;
      const resp = await fetch(fetchUrl);
      return await resp.json();
    } catch {
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
