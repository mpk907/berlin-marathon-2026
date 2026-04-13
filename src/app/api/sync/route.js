// ═══════════════════════════════════════════
// WHOOP Sync API Route
// POST /api/sync — triggers a manual sync
// GET /api/sync — returns last sync status
//
// Phase 2: Replace this with real WHOOP OAuth + database writes
// For now: returns the static data from lib/data.js
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";
import { weeklyData } from "@/lib/data";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    lastSync: "2026-04-12T22:00:00Z",
    activitiesCount: 52,
    weeksTracked: 14,
    message: "Static data — connect WHOOP OAuth to enable live sync",
  });
}

export async function POST() {
  // Phase 2: This will:
  // 1. Use WHOOP OAuth refresh token from env vars
  // 2. Fetch new activities from WHOOP API
  // 3. Process HR zones, calculate distances for GPS-less runs
  // 4. Write to Turso/Supabase database
  // 5. Return updated weekly summary

  return NextResponse.json({
    status: "not_implemented",
    message: "WHOOP sync not yet connected. Set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN env vars.",
    weeklyData: weeklyData,
  });
}
