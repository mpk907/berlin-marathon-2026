// ═══════════════════════════════════════════
// Training Plan API Route
// GET  /api/plan — returns custom plan (blob) or static default
// PUT  /api/plan — saves an edited plan to blob
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { getPlan, storePlan } from "@/lib/storage";
import { trainingPlan as staticPlan } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  // Try custom plan from blob first
  try {
    const custom = await getPlan();
    if (custom?.plan && custom.plan.length > 0) {
      return NextResponse.json({
        source: "custom",
        updatedAt: custom.updatedAt || null,
        reason: custom.reason || null,
        plan: custom.plan,
      });
    }
  } catch (e) {
    console.warn("[plan] Blob read failed, falling back to static:", e.message);
  }

  // Fall back to static plan
  return NextResponse.json({
    source: "default",
    updatedAt: null,
    reason: null,
    plan: staticPlan,
  });
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { plan, reason } = body;

    if (!plan || !Array.isArray(plan) || plan.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Plan must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate plan structure (basic sanity check)
    const daySlots = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    for (const week of plan) {
      if (!week.week || typeof week.week !== "number") {
        return NextResponse.json(
          { status: "error", message: `Invalid week entry: missing week number` },
          { status: 400 }
        );
      }
      // Ensure day slots exist
      for (const day of daySlots) {
        if (week[day] === undefined) week[day] = "Rest";
      }
    }

    await storePlan(plan, { reason: reason || "manual edit" });

    return NextResponse.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      weeksUpdated: plan.length,
    });
  } catch (e) {
    console.error("[plan] PUT error:", e);
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}
