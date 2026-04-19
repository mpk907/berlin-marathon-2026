// ═══════════════════════════════════════════
// Activities API Route
// GET /api/activities — returns synced weekly data + actuals
// Reads from Vercel Blob (persisted by /api/sync), falls back to static data
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { getActivities, getSyncMeta } from "@/lib/storage";
import { syncedWeeklyData, syncedWeeklyActuals, syncMeta } from "@/lib/synced-data";
import { weeklyData as staticWeeklyData, weeklyActuals as staticWeeklyActuals, trainingPlan, hrZones } from "@/lib/data";

// Prevent Vercel edge caching — this route reads from blob which changes on every sync
export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Try Vercel Blob (persisted by sync route)
  try {
    const blobData = await getActivities();
    const blobMeta = await getSyncMeta();

    if (blobData?.weeklyData && blobData.weeklyData.length > 0) {
      const mergedWeekly = mergeWithPlan(blobData.weeklyData, trainingPlan);
      console.log(`[activities] Serving ${blobData.weeklyData.length} weeks from blob, synced ${blobMeta?.syncedAt}`);

      return NextResponse.json({
        source: "whoop-blob",
        syncedAt: blobMeta?.syncedAt || null,
        weeklyData: mergedWeekly,
        weeklyActuals: blobData.weeklyActuals || {},
        trainingPlan,
        hrZones,
        activitiesCount: blobMeta?.activitiesCount || blobData.activities?.length || 0,
      });
    }
  } catch (e) {
    console.warn("[activities] Blob read failed, trying static:", e.message);
  }

  // 2. Fall back to static synced-data.js
  if (syncedWeeklyData && syncedWeeklyData.length > 0) {
    const mergedWeekly = mergeWithPlan(syncedWeeklyData, trainingPlan);

    return NextResponse.json({
      source: "whoop",
      syncedAt: syncMeta.syncedAt,
      weeklyData: mergedWeekly,
      weeklyActuals: syncedWeeklyActuals,
      trainingPlan,
      hrZones,
      activitiesCount: syncMeta.activitiesCount,
    });
  }

  // 3. Fall back to static data
  return NextResponse.json({
    source: "static",
    syncedAt: null,
    weeklyData: staticWeeklyData,
    weeklyActuals: staticWeeklyActuals,
    trainingPlan,
    hrZones,
    activitiesCount: 0,
  });
}

/**
 * Merge synced weekly data with plan targets from trainingPlan.
 * Returns a COMPLETE timeline from week 1 through the current week,
 * filling in zeros for weeks without WHOOP data.
 * This ensures the dashboard always shows data up to today.
 */
function mergeWithPlan(weeklyData, plan) {
  // Compute current week number
  const WEEK1_START = new Date("2026-01-05T00:00:00Z");
  const now = new Date();
  const diffDays = Math.floor((now - WEEK1_START) / 86400000);
  const currentWeek = Math.max(1, Math.min(38, Math.floor(diffDays / 7) + 1));

  // Build lookup maps
  const planMap = {};
  const planDatesMap = {};
  for (const p of plan) {
    planMap[p.week] = p.total;
    planDatesMap[p.week] = p.dates;
  }

  const dataMap = {};
  for (const w of weeklyData) {
    dataMap[w.week] = w;
  }

  // Build complete timeline from week 1 through current week
  const result = [];
  for (let wk = 1; wk <= currentWeek; wk++) {
    if (dataMap[wk]) {
      // Week has WHOOP data — use it, add plan target
      result.push({ ...dataMap[wk], plan: planMap[wk] || 0 });
    } else {
      // No WHOOP data for this week — create empty entry with plan target
      const wkStart = new Date(WEEK1_START.getTime() + (wk - 1) * 7 * 86400000);
      const wkEnd = new Date(wkStart.getTime() + 6 * 86400000);
      const fmtDate = (d) => {
        const day = String(d.getUTCDate()).padStart(2, "0");
        const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return `${day} ${mon}`;
      };
      result.push({
        week: wk,
        dates: planDatesMap[wk] || `${fmtDate(wkStart)}-${fmtDate(wkEnd)}`,
        run: 0, football: 0, spin: 0,
        plan: planMap[wk] || 0,
        longRun: 0, avgHR: 0, z2: 0, avgPace: null,
      });
    }
  }

  return result;
}
