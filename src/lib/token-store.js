// ═══════════════════════════════════════════
// Persistent OAuth token storage via Vercel Blob
// Used by whoop-callback and sync routes
// ═══════════════════════════════════════════

import { put, get } from "@vercel/blob";

const TOKEN_BLOB_PATH = "whoop-oauth-tokens.json";

/**
 * Save OAuth tokens to Vercel Blob storage (private store).
 */
export async function saveTokens({ accessToken, refreshToken, expiresIn }) {
  const data = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };

  await put(TOKEN_BLOB_PATH, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });

  console.log("[token-store] Saved tokens to blob, expires in", expiresIn, "s");
  return data;
}

/**
 * Load OAuth tokens from Vercel Blob storage (private store).
 * Returns { accessToken, refreshToken, expiresAt, updatedAt } or null.
 */
export async function loadTokens() {
  try {
    const result = await get(TOKEN_BLOB_PATH, { access: "private" });

    if (!result || result.statusCode === 404) return null;
    if (!result.stream) return null;

    const response = new Response(result.stream);
    const text = await response.text();

    if (!text) return null;

    const data = JSON.parse(text);
    console.log("[token-store] Loaded tokens from blob, updated", data.updatedAt);
    return data;
  } catch (err) {
    console.error("[token-store] Failed to load tokens:", err.message);
    return null;
  }
}
