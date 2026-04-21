// ═══════════════════════════════════════════
// Replan API Route
// POST /api/replan — Claude generates a new training plan
// Takes: reason, currentWeek, training history, current plan
// Returns: proposed new plan (not saved — user must accept)
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30s for Claude API call

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "ANTHROPIC_API_KEY not configured. Add it to your Vercel environment variables." },
      { status: 500 }
    );
  }

  try {
    const { reason, currentWeek, weeklyData, currentPlan, preferences } = await request.json();

    if (!reason || !currentWeek || !currentPlan) {
      return NextResponse.json(
        { status: "error", message: "Missing required fields: reason, currentWeek, currentPlan" },
        { status: 400 }
      );
    }

    // Build context for Claude
    const trainingHistory = (weeklyData || [])
      .filter(w => w.week <= currentWeek)
      .map(w => `Week ${w.week}: ${w.run?.toFixed(1) || 0}km run, ${w.football?.toFixed(1) || 0}km football, long run ${w.longRun?.toFixed(1) || 0}km, avg HR ${w.avgHR || "—"}, Z2% ${w.z2 ? Math.round(w.z2 * 100) + "%" : "—"}, pace ${w.avgPace || "—"}`)
      .join("\n");

    const currentPlanSummary = currentPlan
      .filter(w => w.week >= currentWeek)
      .slice(0, 24) // Don't overflow context
      .map(w => {
        const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        const sessions = days.map(d => `${d}:${w[d] || "Rest"}`).join(", ");
        return `Week ${w.week} (${w.dates}): total ${w.total}km | ${sessions} | ${w.notes || ""}`;
      })
      .join("\n");

    const prompt = `You are a marathon training coach adjusting a training plan for the Berlin Marathon on September 27, 2026.

## Athlete Profile
- First marathon
- Currently in week ${currentWeek} of 38
- Plays recreational football (soccer) during the season (through mid-June)
- Preferred rest days: Monday, Wednesday (can be flexible)
- Max HR: ~182 bpm, easy pace: 7:30-8:00/km, marathon goal pace: ~6:30-6:45/km

## Reason for Replanning
${reason}

## Training History (completed weeks)
${trainingHistory || "No data yet"}

## Current Plan (week ${currentWeek} onward)
${currentPlanSummary}

${preferences ? `## Additional Preferences\n${preferences}` : ""}

## Instructions
Generate an adjusted training plan from week ${currentWeek} through week 38 (race week).

Rules:
1. Maintain the existing plan structure: each week has mon/tue/wed/thu/fri/sat/sun sessions
2. Sessions are strings like "Rest", "8 easy", "10 (4x1km)", "14 long", "Match", "42.2 RACE"
3. Include a "detail" object for weeks with quality sessions (keys: km, type, hr, pace)
4. Follow 10% weekly volume increase rule, with ease weeks every 4th week
5. Taper last 3 weeks before race (weeks 36-38)
6. Week 38 sun MUST be "42.2 RACE"
7. If the reason is illness/injury, reduce volume 30-50% for 2 weeks then rebuild
8. Keep football/Match sessions on Fridays through week 24 (mid-June)
9. Long runs on Sundays, quality sessions on Thursdays
10. Be conservative — better to underplan than overplan
11. Detail types: "easy", "long", "tempo", "intervals", "MP intervals", "quality", "shakeout", "football", "RACE"

Respond with ONLY a valid JSON array of week objects. No markdown, no explanation. Each object must have:
{ "week": number, "dates": string, "total": number, "mon": string, "tue": string, "wed": string, "thu": string, "fri": string, "sat": string, "sun": string, "notes": string, "detail": { dayKey: { km, type, hr, pace } } }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[replan] Claude API error:", response.status, errText);
      return NextResponse.json(
        { status: "error", message: `Claude API error: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || "";

    // Parse the JSON response — Claude might wrap it in ```json blocks
    let planJson;
    try {
      // Try direct parse first
      planJson = JSON.parse(content);
    } catch {
      // Try extracting from markdown code block
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        planJson = JSON.parse(match[1].trim());
      } else {
        // Try finding the array in the response
        const arrMatch = content.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          planJson = JSON.parse(arrMatch[0]);
        } else {
          throw new Error("Could not parse plan from Claude response");
        }
      }
    }

    if (!Array.isArray(planJson) || planJson.length === 0) {
      throw new Error("Claude returned empty or invalid plan");
    }

    // Merge: keep original plan for weeks before currentWeek, use new plan for rest
    const originalWeeks = currentPlan.filter(w => w.week < currentWeek);
    const newWeeks = planJson.filter(w => w.week >= currentWeek);

    // Recompute totals from daily sessions
    const daySlots = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    for (const week of newWeeks) {
      const computed = daySlots.reduce((sum, d) => {
        const sess = week[d];
        if (!sess || sess === "Rest" || sess === "Match" || sess === "LAST MATCH" || (sess.includes && sess.includes("✈️"))) return sum;
        const m = sess.match(/^(\d+\.?\d*)/);
        return sum + (m ? parseFloat(m[1]) : 0);
      }, 0);
      if (computed > 0) week.total = Math.round(computed * 10) / 10;
    }

    const fullPlan = [...originalWeeks, ...newWeeks].sort((a, b) => a.week - b.week);

    return NextResponse.json({
      status: "success",
      proposedPlan: fullPlan,
      changedWeeks: newWeeks.map(w => w.week),
      reason,
      generatedAt: new Date().toISOString(),
    });

  } catch (e) {
    console.error("[replan] Error:", e);
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}
