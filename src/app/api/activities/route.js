// ═══════════════════════════════════════════
// Activities API Route
// GET /api/activities — returns synced weekly data + actuals
// Uses synced-data.js (from WHOOP sync) or falls back to static data.js
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { syncedWeeklyData, syncedWeeklyActuals, syncMeta } from "@/lib/synced-data";
import { weeklyData as staticWeeklyData, weeklyActuals as staticWeeklyActuals, trainingPlan, hrZones } from "@/lib/data";

export async function GET() {
  // Use synced WHOOP data if available
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

  // Fall back to static data
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
