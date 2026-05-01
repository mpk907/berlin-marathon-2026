// ═══════════════════════════════════════════
// Coach Insights
// Generates adaptive, evidence-based coaching prompts from actuals.
//
// Core philosophy: progressive overload from ACHIEVED, not from PLANNED.
//   - Long run grows by ~10 % from the longest actual, not the plan target.
//   - Quality sessions advance ONE variable per cycle (reps, rep distance,
//     or pace), never two at once.
//   - Adherence < 70 % over 4 weeks → rebuild mode, one quality + one long
//     per week, instead of trying to "catch up".
// ═══════════════════════════════════════════

import { paceStrToSec, secToPaceStr } from "./projection.js";

const LONG_RUN_PROGRESSION = 1.10; // max +10 % vs longest actual
const ADHERENCE_LOOKBACK = 4;
const ADHERENCE_REBUILD_THRESHOLD = 0.70;
const QUALITY_HR_THRESHOLD = 150; // avgHr above this = quality session
const MIN_KM_FOR_QUALITY = 4;

function parsePlannedKm(session) {
  if (!session || session === "Rest" || session.includes("✈️")) return 0;
  const m = session.match(/^(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : 0;
}

function findQualityActuals(dailyActualDetails) {
  const list = [];
  for (const [wkStr, days] of Object.entries(dailyActualDetails || {})) {
    const wk = parseInt(wkStr, 10);
    for (const [day, sessions] of Object.entries(days || {})) {
      for (const s of sessions) {
        if (s.type !== "Run") continue;
        if (!s.avgHr || s.avgHr < QUALITY_HR_THRESHOLD) continue;
        if (s.distance < MIN_KM_FOR_QUALITY) continue;
        list.push({ week: wk, day, distance: s.distance, pace: s.pace, avgHr: s.avgHr });
      }
    }
  }
  return list.sort((a, b) => b.week - a.week);
}

function longRunInsight(weeklyData, trainingPlan, currentWeek) {
  const longestEver = Math.max(0, ...weeklyData.map(w => w.longRun || 0));
  const thisWeek = trainingPlan.find(w => w.week === currentWeek);
  if (!thisWeek) return null;
  const plannedKm = parsePlannedKm(thisWeek.sun);
  if (plannedKm === 0) return null;

  const recommended = Math.round(Math.min(plannedKm, longestEver * LONG_RUN_PROGRESSION) * 10) / 10;

  if (longestEver === 0) {
    return {
      icon: "🛣️",
      severity: "info",
      title: "Long run this week",
      body: `Plan: ${plannedKm} km. Aim for the planned distance — keep the pace conversational (Z2).`,
    };
  }

  // Plan within 15 % of achievable safe progression → on track
  if (plannedKm <= longestEver * 1.15) {
    return {
      icon: "🛣️",
      severity: "good",
      title: "Long run target on track",
      body: `Plan: ${plannedKm} km. Within +${Math.round((plannedKm / longestEver - 1) * 100)} % of your longest (${longestEver.toFixed(1)} km). Keep it Z2; negative-split the last third.`,
    };
  }

  // Build a patch that swaps Sunday for the +10% target while preserving the
  // long-run intent (HR + pace guidance). The marathon distance the user is
  // training for doesn't change — only this single Sunday's volume.
  const recommendedRounded = Math.round(recommended); // whole-km for cleaner UI
  const baseDetail = thisWeek.detail?.sun;
  const newSunDetail = {
    km: recommendedRounded,
    type: baseDetail?.type || "long",
    hr: baseDetail?.hr || "Z2 127-146",
    pace: baseDetail?.pace || "7:30-8:00",
  };
  return {
    icon: "🛣️",
    severity: "warn",
    title: "Long run plan looks aggressive",
    body: `Plan: ${plannedKm} km, but your longest is ${longestEver.toFixed(1)} km — a +${Math.round((plannedKm / longestEver - 1) * 100)} % jump. Aim for ~${recommendedRounded} km this Sunday (+10 % vs longest). Marathon distance doesn't move — this single week's target does.`,
    patch: {
      label: `Sunday long run: ${plannedKm} km → ${recommendedRounded} km`,
      weekNum: currentWeek,
      changes: [
        {
          day: "sun",
          session: `${recommendedRounded} long`,
          detail: newSunDetail,
        },
      ],
    },
  };
}

function qualityInsight(dailyActualDetails, trainingPlan, currentWeek) {
  const recentQualities = findQualityActuals(dailyActualDetails).slice(0, 3);
  const lastQuality = recentQualities[0] || null;

  // Find the next quality session in the plan (this week or next)
  const upcomingQuality = [];
  for (let wk = currentWeek; wk <= currentWeek + 1; wk++) {
    const w = trainingPlan.find(p => p.week === wk);
    if (!w?.detail) continue;
    for (const [day, d] of Object.entries(w.detail)) {
      if (["tempo", "intervals", "MP intervals", "MP continuous", "quality"].includes(d.type)) {
        upcomingQuality.push({ week: wk, day, type: d.type, km: d.km, pace: d.pace });
      }
    }
  }
  const nextQuality = upcomingQuality[0] || null;

  if (!lastQuality && !nextQuality) return null;

  if (!lastQuality && nextQuality) {
    return {
      icon: "💪",
      severity: "info",
      title: "First quality session ahead",
      body: `Plan W${nextQuality.week} ${nextQuality.day}: ${nextQuality.km} km ${nextQuality.type}. If this is your first hard run, scale back: try half the volume (≈${Math.round(nextQuality.km / 2)} km of work) and build from there. Don't chase the prescribed pace on day one.`,
    };
  }

  if (lastQuality && nextQuality) {
    const lastKm = lastQuality.distance;
    const nextKm = nextQuality.km;
    const ratio = nextKm / Math.max(lastKm, 1);
    if (ratio > 1.4) {
      // Recommend +25% volume progression. Match the planned session's
      // structure (warmup + work + cooldown) but shrink the work block.
      const progressed = Math.round(lastKm * 1.25 * 10) / 10;
      const wkPlan = trainingPlan.find(p => p.week === nextQuality.week);
      const sessionStr = wkPlan?.[nextQuality.day] || "";
      const totalKm = parsePlannedKm(sessionStr); // includes WU+CD
      // Parse "X (NxYkm)" — preserve the rep count, shrink the rep distance
      // so the user advances ONE variable (rep distance) toward the plan target.
      const repMatch = sessionStr.match(/\((\d+)x(\d+\.?\d*)km\)/);
      let newSessionStr, newTotal;
      if (repMatch) {
        const plannedReps = parseInt(repMatch[1], 10);
        const plannedRepKm = parseFloat(repMatch[2]);
        const plannedWorkKm = plannedReps * plannedRepKm;
        const wuCd = Math.max(0, totalKm - plannedWorkKm);
        // Round new rep distance to nearest 0.25 km for clean session strings
        const newRepKm = Math.max(0.5, Math.round(progressed / plannedReps * 4) / 4);
        const newWork = plannedReps * newRepKm;
        newTotal = Math.round((newWork + wuCd) * 10) / 10;
        newSessionStr = `${newTotal} (${plannedReps}x${newRepKm}km)`;
      } else {
        // Tempo / continuous quality without a rep pattern — scale total km directly
        const wuCd = Math.max(0, totalKm - nextKm); // assume planned km == work km here
        newTotal = Math.round((progressed + wuCd) * 10) / 10;
        newSessionStr = `${newTotal} ${nextQuality.type}`;
      }
      const baseDetail = wkPlan?.detail?.[nextQuality.day] || {};
      const newDetail = { ...baseDetail, km: newTotal };
      return {
        icon: "💪",
        severity: "warn",
        title: "Quality progression too steep",
        body: `Last quality: ${lastKm.toFixed(1)} km @ ${lastQuality.pace || "—"}/km, avg HR ${lastQuality.avgHr}. Plan W${nextQuality.week} ${nextQuality.day}: ${nextKm} km ${nextQuality.type} — a +${Math.round((ratio - 1) * 100)} % jump. Try ${progressed} km of work next time (+25 %). Marathon-pace target stays the same; just one variable progresses per cycle.`,
        patch: {
          label: `${nextQuality.day} W${nextQuality.week}: ${nextKm} km → ${newTotal} km`,
          weekNum: nextQuality.week,
          changes: [
            {
              day: nextQuality.day,
              session: newSessionStr,
              detail: newDetail,
            },
          ],
        },
      };
    }
    return {
      icon: "💪",
      severity: "good",
      title: "Quality progression looks healthy",
      body: `Last quality: ${lastKm.toFixed(1)} km @ ${lastQuality.pace || "—"}/km (HR ${lastQuality.avgHr}). Plan ${nextQuality.day}: ${nextKm} km ${nextQuality.type}. Sustainable jump.`,
    };
  }

  if (lastQuality && !nextQuality) {
    return {
      icon: "💪",
      severity: "info",
      title: "Recent quality logged",
      body: `Last quality: ${lastQuality.distance.toFixed(1)} km @ ${lastQuality.pace || "—"}/km (HR ${lastQuality.avgHr}). No quality session in the next two weeks — easy week or end of build.`,
    };
  }

  return null;
}

function adherenceInsight(weeklyData, trainingPlan, currentWeek) {
  const fromWeek = Math.max(1, currentWeek - ADHERENCE_LOOKBACK);
  const window = weeklyData.filter(w => w.week >= fromWeek && w.week < currentWeek);
  if (window.length === 0) return null;

  const totalActual = window.reduce((s, w) => s + (w.run || 0) + (w.football || 0) + (w.spin || 0), 0);
  const totalPlanned = window.reduce((s, w) => {
    const p = trainingPlan.find(x => x.week === w.week);
    return s + (p?.total || 0);
  }, 0);
  if (totalPlanned === 0) return null;

  const pct = Math.min(150, Math.round((totalActual / totalPlanned) * 100));

  if (pct >= 90) {
    return {
      icon: "✅",
      severity: "good",
      title: `Adherence ${pct} % over ${window.length} weeks`,
      body: `Hitting plan volume consistently. The projection is built on this — keep the discipline of easy days easy.`,
    };
  }
  if (pct >= 70) {
    return {
      icon: "✅",
      severity: "info",
      title: `Adherence ${pct} % over ${window.length} weeks`,
      body: `Solid base. Three more steady weeks > one perfect week. Don't try to make up missed volume in a single push.`,
    };
  }
  return {
    icon: "⚠️",
    severity: "warn",
    title: `Adherence ${pct} % — consider rebuild mode`,
    body: `Below ${Math.round(ADHERENCE_REBUILD_THRESHOLD * 100)} % over the last ${window.length} weeks. Drop to one quality + one long run per week and rebuild. Cumulative consistency beats heroic catch-up weeks.`,
  };
}

function aerobicBaseInsight(weeklyData) {
  // Compare avg pace in last 4 vs prior 4 weeks (filter out weeks with 0 km)
  const withPace = weeklyData.filter(w => w.avgPace && (w.run || 0) > 3);
  if (withPace.length < 4) return null;

  const recent = withPace.slice(-4);
  const prior = withPace.slice(-8, -4);
  const recentSec = recent.reduce((s, w) => s + paceStrToSec(w.avgPace) * w.run, 0) /
                    recent.reduce((s, w) => s + w.run, 0);
  if (prior.length === 0) {
    return {
      icon: "🔋",
      severity: "info",
      title: "Aerobic base building",
      body: `Recent run pace ${secToPaceStr(Math.round(recentSec))}/km. Stay disciplined on easy days — Z2 mileage is what makes the marathon feel sustainable.`,
    };
  }
  const priorSec = prior.reduce((s, w) => s + paceStrToSec(w.avgPace) * w.run, 0) /
                   prior.reduce((s, w) => s + w.run, 0);
  const delta = priorSec - recentSec; // positive = got faster

  if (delta > 5) {
    return {
      icon: "🔋",
      severity: "good",
      title: `Aerobic base improving (${Math.round(delta)} s/km faster)`,
      body: `Avg run pace dropped from ${secToPaceStr(Math.round(priorSec))} to ${secToPaceStr(Math.round(recentSec))}/km at similar effort. Keep easy days easy — don't sabotage gains by pushing recovery runs.`,
    };
  }
  if (delta < -15) {
    return {
      icon: "🔋",
      severity: "warn",
      title: `Average pace slowing meaningfully (${Math.round(-delta)} s/km)`,
      body: `A 15+ s/km drop in 4 weeks isn't just longer long runs — watch for accumulated fatigue. Check sleep, HR drift on easy days, and protect easy-day intensity.`,
    };
  }
  if (delta < -5) {
    return {
      icon: "🔋",
      severity: "info",
      title: `Average pace ${Math.round(-delta)} s/km slower`,
      body: `Mostly explained by longer long runs (longer = slower in Z2). Not concerning unless easy-day pace is also drifting. Check Aerobic Fitness card above for the cleaner signal.`,
    };
  }
  return {
    icon: "🔋",
    severity: "info",
    title: "Aerobic base steady",
    body: `Pace stable at ${secToPaceStr(Math.round(recentSec))}/km. Stable is fine in a build phase — fitness sometimes plateaus before another step up.`,
  };
}

/**
 * Returns up to 4 ranked insights, most actionable first (warnings before goods).
 */
export function computeCoachInsights({ weeklyData, dailyActualDetails, trainingPlan, currentWeek, raceWeek }) {
  if (currentWeek > raceWeek) {
    return [{
      icon: "🎉",
      severity: "good",
      title: "Recovery phase",
      body: "Race is in the rear-view. Focus is on rest, easy movement, and sleep. The base built over 38 weeks doesn't disappear in a week.",
    }];
  }

  const insights = [
    longRunInsight(weeklyData, trainingPlan, currentWeek),
    qualityInsight(dailyActualDetails, trainingPlan, currentWeek),
    adherenceInsight(weeklyData, trainingPlan, currentWeek),
    aerobicBaseInsight(weeklyData),
  ].filter(Boolean);

  // Sort: warnings first, then info, then good
  const order = { warn: 0, info: 1, good: 2 };
  insights.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return insights;
}
