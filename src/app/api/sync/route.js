// ═══════════════════════════════════════════
// WHOOP Sync API Route
// GET  /api/sync — returns last sync status (also triggered by Vercel cron)
// POST /api/sync — triggers a manual sync
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { refreshAccessToken, fetchActivities, processActivities } from "@/lib/whoop";
import { storeActivities, storeSyncMeta, getSyncMeta } from "@/lib/storage";

// Vercel cron calls GET, so we sync on both GET and POST
// But only sync on GET if ?cron=1 is present (from vercel.json)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const isCron = searchParams.get("cron") === "1";

  if (isCron) {
    return runSync();
  }

  // Regular GET: return sync status
  const meta = await getSyncMeta();
  return NextResponse.json({
    status: "ok",
    lastSync: meta?.lastSync || null,
    activitiesCount: meta?.activitiesCount || 0,
    weeksWithData: meta?.weeksWithData || 0,
    storage: process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local",
    configured: !!(process.env.WHOOP_REFRESH_TOKEN || process.env.WHOOP_ACCESS_TOKEN),
  });
}

export async function POST() {
  return runSync();
}

async function runSync() {
  const refreshToken = process.env.WHOOP_REFRESH_TOKEN;
  const envAccessToken = process.env.WHOOP_ACCESS_TOKEN;

  if (!refreshToken && !envAccessToken) {
    return NextResponse.json({
      status: "error",
      message: "WHOOP_ACCESS_TOKEN or WHOOP_REFRESH_TOKEN not set. Add in Vercel → Settings → Environment Variables.",
    }, { status: 400 });
  }

  try {
    // 1. Get access token — try direct token first, then refresh
    let accessToken;
    if (envAccessToken) {
      console.log("[sync] Using WHOOP_ACCESS_TOKEN from env...");
      accessToken = envAccessToken;
    } else {
      console.log("[sync] Refreshing WHOOP access token...");
      accessToken = await refreshAccessToken(refreshToken);
      console.log("[sync] Token refreshed successfully");
    }

    // 2. Fetch activities (from Jan 1 2026 to now)
    const startDate = new Date("2026-01-01T00:00:00Z");
    const endDate = new Date();
    console.log(`[sync] Fetching activities ${startDate.toISOString()} → ${endDate.toISOString()}`);

    const { activities } = await fetchActivities(accessToken, startDate, endDate, refreshToken);
    console.log(`[sync] Fetched ${activities.length} activities`);

    // 3. Process into weekly summaries
    const { weeklyData, weeklyActuals } = processActivities(activities);
    console.log(`[sync] Processed ${weeklyData.length} weeks with data`);

    // 4. Store everything
    const stored = await storeActivities({
      activities,
      weeklyData,
      weeklyActuals,
      syncedAt: new Date().toISOString(),
    });

    // 5. Store sync metadata
    const meta = {
      lastSync: new Date().toISOString(),
      activitiesCount: activities.length,
      weeksWithData: weeklyData.length,
      storage: stored.storage,
      breakdown: {
        runs: activities.filter(a => a.type === "Run").length,
        football: activities.filter(a => a.type === "Football").length,
        spin: activities.filter(a => a.type === "Spin").length,
        other: activities.filter(a => a.type === "Other").length,
      },
    };
    await storeSyncMeta(meta);

    return NextResponse.json({
      status: "success",
      ...meta,
      sample: activities.slice(-3).map(a => ({
        date: a.date,
        type: a.type,
        distance: a.distance,
        pace: a.pace,
        avgHr: a.avgHr,
      })),
    });
  } catch (error) {
    console.error("[sync] Error:", error);

    if (error.message === "TOKEN_EXPIRED") {
      return NextResponse.json({
        status: "error",
        message: "WHOOP token expired and refresh failed. Update WHOOP_REFRESH_TOKEN in env vars.",
        help: "Open app.whoop.com → F12 → Application → Cookies → copy cognito refresh token",
      }, { status: 401 });
    }

    return NextResponse.json({
      status: "error",
      message: error.message,
    }, { status: 500 });
  }
}
