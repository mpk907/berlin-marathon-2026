// ═══════════════════════════════════════════
// Activities API Route
// GET /api/activities — returns synced weekly data + actuals
// Reads from Vercel Blob (persisted by /api/sync), falls back to static data
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { getActivities, getSyncMeta } from "@/lib/storage";
import { syncedWeeklyData, syncedWeeklyActuals, syncMeta } from "@/lib/synced-data";
import { weeklyData as staticWeeklyData, weeklyActuals as staticWeeklyActuals, trainingPlan, hrZones } from "@/lib/data";

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
 * Includes plan target for every week, not just weeks with actuals.
 */
function mergeWithPlan(weeklyData, plan) {
  const planMap = {};
  for (const p of plan) {
    planMap[p.week] = p.total;
  }

  return weeklyData.map(w => ({
    ...w,
    plan: planMap[w.week] || 0,
  }));
}
