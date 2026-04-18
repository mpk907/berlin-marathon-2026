// ═══════════════════════════════════════════
// Persistent OAuth token storage via Vercel Blob
// Used by whoop-callback and sync routes
// ═══════════════════════════════════════════

import { put, list } from "@vercel/blob";

const TOKEN_BLOB_PATH = "whoop-oauth-tokens.json";

/**
 * Save OAuth tokens to Vercel Blob storage.
 */
export async function saveTokens({ accessToken, refreshToken, expiresIn }) {
  const data = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };

  await put(TOKEN_BLOB_PATH, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
  });

  console.log("[token-store] Saved tokens to blob, expires in", expiresIn, "s");
  return data;
}

/**
 * Load OAuth tokens from Vercel Blob storage.
 * Returns { accessToken, refreshToken, expiresAt, updatedAt } or null.
 */
export async function loadTokens() {
  try {
    const { blobs } = await list({ prefix: TOKEN_BLOB_PATH });
    if (!blobs || blobs.length === 0) return null;

    const res = await fetch(blobs[0].url);
    if (!res.ok) return null;

    const data = await res.json();
    console.log("[token-store] Loaded tokens from blob, updated", data.updatedAt);
    return data;
  } catch (err) {
    console.error("[token-store] Failed to load tokens:", err.message);
    return null;
  }
}
