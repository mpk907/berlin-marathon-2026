// ═══════════════════════════════════════════
// Activities API Route
// GET /api/activities — returns synced weekly data + actuals
// Falls back to static data.js if no synced data exists
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { getActivities } from "@/lib/storage";
import { weeklyData as staticWeeklyData, weeklyActuals as staticWeeklyActuals, trainingPlan, hrZones } from "@/lib/data";

export async function GET() {
  // Try to load synced data from storage
  const synced = await getActivities();

  if (synced && synced.weeklyData && synced.weeklyData.length > 0) {
    // Merge synced weeklyData with training plan targets
    const mergedWeekly = mergeWithPlan(synced.weeklyData, trainingPlan);

    return NextResponse.json({
      source: "whoop",
      syncedAt: synced.syncedAt,
      weeklyData: mergedWeekly,
      weeklyActuals: synced.weeklyActuals,
      trainingPlan,
      hrZones,
      activitiesCount: synced.activities?.length || 0,
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
 * Merge synced weekly data with plan targets from trainingPlan
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
