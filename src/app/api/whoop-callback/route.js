// ═══════════════════════════════════════════
// WHOOP OAuth — Step 2: Handle callback, exchange code for tokens
// GET /api/whoop-callback?code=XXX → exchanges for access + refresh tokens
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { fetchActivities, processActivities } from "@/lib/whoop";

// Simple in-memory token store (persists across requests in the same serverless instance)
// For production, use Vercel KV or a database. This works for low-traffic personal apps.
let storedTokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  updatedAt: null,
};

// Export for use by sync route
export function getStoredTokens() {
  return storedTokens;
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/sync?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sync?error=no_code`);
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = `${origin}/api/whoop-callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/sync?error=missing_credentials`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[whoop-callback] Token exchange failed:", errText);
      return NextResponse.redirect(`${origin}/sync?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    console.log("[whoop-callback] Got tokens, access expires in", tokens.expires_in, "seconds");

    // Store tokens in memory
    storedTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      updatedAt: new Date().toISOString(),
    };

    // Immediately sync with the new token
    try {
      const startDate = new Date("2026-01-01T00:00:00Z");
      const endDate = new Date();
      const { activities } = await fetchActivities(tokens.access_token, startDate, endDate);
      const { weeklyData, weeklyActuals } = processActivities(activities);

      return NextResponse.redirect(
        `${origin}/sync?success=true&activities=${activities.length}&weeks=${weeklyData.length}`
      );
    } catch (syncErr) {
      console.error("[whoop-callback] Sync after auth failed:", syncErr.message);
      // Auth worked even if sync failed — still redirect with partial success
      return NextResponse.redirect(`${origin}/sync?success=auth_only&error=${encodeURIComponent(syncErr.message)}`);
    }
  } catch (err) {
    console.error("[whoop-callback] Error:", err);
    return NextResponse.redirect(`${origin}/sync?error=${encodeURIComponent(err.message)}`);
  }
}
