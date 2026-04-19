// ═══════════════════════════════════════════
// WHOOP Sync API Route
// GET  /api/sync — returns sync status (also triggered by Vercel cron)
// POST /api/sync — triggers a manual sync
// Reads/writes OAuth tokens from Vercel Blob for serverless persistence
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { fetchActivities, processActivities } from "@/lib/whoop";
import { loadTokens, saveTokens } from "@/lib/token-store";

// CORS headers for cross-origin sync requests (e.g. from WHOOP tab bookmarklet)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function withCors(response) {
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

/**
 * Refresh an expired access token using WHOOP OAuth refresh_token flow.
 * Saves the new tokens to Vercel Blob.
 * Returns a fresh access token or null.
 */
async function refreshOAuthToken(refreshToken) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      console.error("[sync] OAuth refresh failed:", await res.text());
      return null;
    }

    const tokens = await res.json();
    console.log("[sync] OAuth token refreshed, expires in", tokens.expires_in, "s");

    // Persist refreshed tokens to blob
    await saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresIn: tokens.expires_in,
    });

    return tokens.access_token;
  } catch (err) {
    console.error("[sync] OAuth refresh error:", err.message);
    return null;
  }
}

// Vercel cron calls GET with ?cron=1
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const isCron = searchParams.get("cron") === "1";

  if (isCron) {
    return runSync(null);
  }

  // Regular GET: return sync status
  const hasOAuth = !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  const stored = await loadTokens();
  const hasRefresh = !!(stored?.refreshToken || process.env.WHOOP_REFRESH_TOKEN);
  const hasAccess = !!(stored?.accessToken && stored.expiresAt > Date.now());

  return withCors(NextResponse.json({
    status: "ok",
    configured: hasOAuth || hasRefresh || hasAccess,
    oauth: hasOAuth,
    hasRefreshToken: hasRefresh,
    hasAccessToken: hasAccess,
    lastSync: stored?.updatedAt || null,
  }));
}

export async function POST(request) {
  let bodyToken = null;
  try {
    const body = await request.json();
    bodyToken = body?.accessToken || null;
  } catch (e) {
    // No JSON body — that's fine
  }
  return runSync(bodyToken);
}

async function runSync(bodyToken = null) {
  let accessToken = null;

  // 1. Direct token from POST body (bookmarklet / manual paste)
  if (bodyToken) {
    console.log("[sync] Using access token from POST body");
    accessToken = bodyToken;
  }

  // 2. Stored OAuth token from Vercel Blob (if not expired)
  if (!accessToken) {
    const stored = await loadTokens();
    if (stored?.accessToken && stored.expiresAt > Date.now()) {
      console.log("[sync] Using stored OAuth access token from blob");
      accessToken = stored.accessToken;
    }
  }

  // 3. Env access token
  if (!accessToken && process.env.WHOOP_ACCESS_TOKEN) {
    console.log("[sync] Using WHOOP_ACCESS_TOKEN from env");
    accessToken = process.env.WHOOP_ACCESS_TOKEN;
  }

  // 4. OAuth refresh token (blob or env)
  if (!accessToken) {
    const stored = await loadTokens();
    const refreshToken = stored?.refreshToken || process.env.WHOOP_REFRESH_TOKEN;
    if (refreshToken) {
      console.log("[sync] Refreshing via OAuth...");
      accessToken = await refreshOAuthToken(refreshToken);
    }
  }

  if (!accessToken) {
    return withCors(NextResponse.json({
      status: "error",
      message: "No WHOOP token available. Either connect via OAuth (/api/whoop-auth), pass token in POST body, or set WHOOP_ACCESS_TOKEN env var.",
      setupUrl: "/sync",
    }, { status: 400 }));
  }

  try {
    const startDate = new Date("2026-01-01T00:00:00Z");
    const endDate = new Date();
    console.log(`[sync] Fetching activities ${startDate.toISOString()} → ${endDate.toISOString()}`);

    const { activities } = await fetchActivities(accessToken, startDate, endDate);
    console.log(`[sync] Fetched ${activities.length} activities`);

    const { weeklyData, weeklyActuals } = processActivities(activities);
    console.log(`[sync] Processed ${weeklyData.length} weeks with data`);

    return withCors(NextResponse.json({
      status: "success",
      syncedAt: new Date().toISOString(),
      activitiesCount: activities.length,
      weeksWithData: weeklyData.length,
      breakdown: {
        runs: activities.filter(a => a.type === "Run").length,
        football: activities.filter(a => a.type === "Football").length,
        spin: activities.filter(a => a.type === "Spin").length,
        other: activities.filter(a => a.type === "Other").length,
      },
      weeklyData,
      weeklyActuals,
      activities,
    }));
  } catch (error) {
    console.error("[sync] Error:", error);

    // If token expired, try OAuth refresh as fallback
    if (error.message === "TOKEN_EXPIRED" && !bodyToken) {
      const stored = await loadTokens();
      const refreshToken = stored?.refreshToken || process.env.WHOOP_REFRESH_TOKEN;
      if (refreshToken) {
        console.log("[sync] Token expired, trying OAuth refresh...");
        const newToken = await refreshOAuthToken(refreshToken);
        if (newToken) {
          return runSync(newToken); // Retry with fresh token
        }
      }
    }

    return withCors(NextResponse.json({
      status: "error",
      message: error.message,
      setupUrl: "/sync",
    }, { status: 500 }));
  }
}
