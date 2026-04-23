// ═══════════════════════════════════════════
// Race Projection
// Estimates marathon finish time from actual runs.
//
// Primary signal: Z2 pace (aerobic base). When you can hold pace X at
// Z2 HR, a well-trained aerobic runner typically races ~30 s/km faster.
// Fallback: all-run average pace with a wider 45 s/km buffer.
// ═══════════════════════════════════════════

const MARATHON_KM = 42.195;
const Z2_HR_MIN = 125;
const Z2_HR_MAX = 150;
const MIN_RUN_KM = 3;
const RACE_PACE_ADJ_Z2 = 30;      // seconds/km faster than Z2 pace
const RACE_PACE_ADJ_GENERAL = 45; // seconds/km faster than mixed-effort avg

export function paceStrToSec(pace) {
  if (!pace || typeof pace !== "string") return null;
  const parts = pace.split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

export function secToPaceStr(sec) {
  if (!sec || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function secToTimeStr(sec) {
  if (!sec || !Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec - h * 3600) / 60);
  const s = Math.round(sec - h * 3600 - m * 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function aggregateRuns(runs) {
  const withPace = runs.filter(r => r.pace && r.distance >= MIN_RUN_KM);
  if (withPace.length === 0) return null;

  const z2 = withPace.filter(r => r.avgHr && r.avgHr >= Z2_HR_MIN && r.avgHr <= Z2_HR_MAX);
  const source = z2.length > 0 ? z2 : withPace;

  let totalKm = 0;
  let totalPaceSec = 0;
  let hrSum = 0;
  let hrCount = 0;
  for (const r of source) {
    const paceSec = paceStrToSec(r.pace);
    if (paceSec === null) continue;
    totalKm += r.distance;
    totalPaceSec += paceSec * r.distance;
    if (r.avgHr) { hrSum += r.avgHr; hrCount++; }
  }
  if (totalKm === 0) return null;

  const avgPaceSec = totalPaceSec / totalKm;
  const adjustment = z2.length > 0 ? RACE_PACE_ADJ_Z2 : RACE_PACE_ADJ_GENERAL;
  const racePaceSec = avgPaceSec - adjustment;
  const marathonSec = racePaceSec * MARATHON_KM;

  return {
    avgPaceSec,
    racePaceSec,
    marathonSec,
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    basedOnRuns: source.length,
    basedOnKm: Math.round(totalKm * 10) / 10,
    method: z2.length > 0 ? "z2-pace" : "avg-pace",
  };
}

function collectRunsInRange(dailyActualDetails, fromWeek, toWeek) {
  const runs = [];
  for (let wk = fromWeek; wk <= toWeek; wk++) {
    const weekDays = dailyActualDetails[wk];
    if (!weekDays) continue;
    for (const sessions of Object.values(weekDays)) {
      for (const s of sessions) {
        if (s.type === "Run") runs.push(s);
      }
    }
  }
  return runs;
}

/**
 * Current projection: 4-week rolling window ending at currentWeek.
 * Falls back to weeklyData.avgPace when per-session details aren't synced yet.
 */
export function computeCurrentProjection(dailyActualDetails, weeklyData, currentWeek) {
  const structured = collectRunsInRange(dailyActualDetails || {}, Math.max(1, currentWeek - 3), currentWeek);
  const detailed = aggregateRuns(structured);
  if (detailed && detailed.basedOnKm >= 8) return detailed;

  // Fallback: use weekly avg pace weighted by run km
  const recent = (weeklyData || [])
    .filter(w => w.week >= currentWeek - 3 && w.week <= currentWeek && w.avgPace && w.run > 0);
  if (recent.length === 0) return detailed; // may be null

  let totalKm = 0;
  let totalSec = 0;
  let hrSum = 0, hrCount = 0;
  for (const w of recent) {
    const paceSec = paceStrToSec(w.avgPace);
    if (paceSec === null) continue;
    totalKm += w.run;
    totalSec += paceSec * w.run;
    if (w.avgHR) { hrSum += w.avgHR; hrCount++; }
  }
  if (totalKm === 0) return detailed;

  const avgPaceSec = totalSec / totalKm;
  const racePaceSec = avgPaceSec - RACE_PACE_ADJ_GENERAL;
  return {
    avgPaceSec,
    racePaceSec,
    marathonSec: racePaceSec * MARATHON_KM,
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    basedOnRuns: recent.length,
    basedOnKm: Math.round(totalKm * 10) / 10,
    method: "weekly-avg",
  };
}

/**
 * Per-week trend using a 3-week rolling window for smoothing.
 * Returns [{ week, marathonSec, racePaceSec, method }] for every week with enough data.
 */
export function computeProjectionTrend(dailyActualDetails, weeklyData, maxWeek) {
  const trend = [];
  for (let wk = 1; wk <= maxWeek; wk++) {
    const from = Math.max(1, wk - 2);
    const structured = collectRunsInRange(dailyActualDetails || {}, from, wk);
    let result = aggregateRuns(structured);
    if (!result || result.basedOnKm < 5) {
      // Fallback to weekly avg pace in the window
      const window = (weeklyData || []).filter(w => w.week >= from && w.week <= wk && w.avgPace && w.run > 0);
      if (window.length > 0) {
        let totalKm = 0, totalSec = 0;
        for (const w of window) {
          const p = paceStrToSec(w.avgPace);
          if (p === null) continue;
          totalKm += w.run;
          totalSec += p * w.run;
        }
        if (totalKm >= 5) {
          const avg = totalSec / totalKm;
          const race = avg - RACE_PACE_ADJ_GENERAL;
          result = {
            avgPaceSec: avg,
            racePaceSec: race,
            marathonSec: race * MARATHON_KM,
            basedOnKm: totalKm,
            method: "weekly-avg",
          };
        }
      }
    }
    trend.push({
      week: wk,
      marathonSec: result?.marathonSec || null,
      racePaceSec: result?.racePaceSec || null,
      marathonMin: result?.marathonSec ? Math.round(result.marathonSec / 60) : null,
      method: result?.method || null,
    });
  }
  return trend;
}

export const TARGET_PACE_SEC = 6 * 60 + 45; // 6:45/km plan goal
export const TARGET_MARATHON_SEC = TARGET_PACE_SEC * MARATHON_KM;
