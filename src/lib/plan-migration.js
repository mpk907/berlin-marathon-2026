// ═══════════════════════════════════════════
// Plan migration
// Compares the user's loaded trainingPlan against the latest defaults
// (staticTrainingPlan) to detect sessions whose pace prescriptions are
// from a previous tuning. Used to surface a "your saved plan has older
// paces — refresh?" banner without nuking custom volume edits.
// ═══════════════════════════════════════════

// Substrings that mark a pace prescription as belonging to the pre-fix
// (overly aggressive) plan. If a session's saved pace contains any of
// these, we treat it as obsolete and offer to migrate to the current
// default pace for that day.
const OBSOLETE_PACE_FRAGMENTS = [
  "6:20-6:40",
  "5:30-5:50",
  "4x3km@6:20",
  "5x2km@6:20",
  "6:30 steady for 10km block",
  "tempo blocks 6:20",
  "Z2-Z3: start 6:40, hold 6:30",
  "7:40 then 6:30",
];

// Days of week, used for adjacency walking
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// A session string counts as "quality" (high-stress, hard) if it contains
// tempo work, intervals, MP work, or a long run. Easy / Rest / Match /
// Travel are NOT quality.
function isQualitySession(session) {
  if (typeof session !== "string") return false;
  if (session === "Rest" || session === "Match" || session === "LAST MATCH") return false;
  if (session.includes("✈️")) return false;
  return /tempo|long|MP|quality|\(\d+x\d/i.test(session);
}

function isMatchSession(session) {
  return session === "Match" || session === "LAST MATCH";
}

function isObsoletePace(pace) {
  if (typeof pace !== "string") return false;
  return OBSOLETE_PACE_FRAGMENTS.some(frag => pace.includes(frag));
}

/**
 * Returns the list of sessions in `savedPlan` whose pace string contains an
 * obsolete fragment AND differs from the default. Each entry is
 * { week, day, oldPace, newPace }.
 */
export function findObsoletePaces(savedPlan, defaultPlan) {
  const out = [];
  if (!Array.isArray(savedPlan) || !Array.isArray(defaultPlan)) return out;
  const defaultByWeek = new Map(defaultPlan.map(w => [w.week, w]));
  for (const sw of savedPlan) {
    const dw = defaultByWeek.get(sw.week);
    if (!dw?.detail || !sw.detail) continue;
    for (const day of Object.keys(sw.detail)) {
      const sd = sw.detail[day];
      const dd = dw.detail[day];
      if (!sd || !dd) continue;
      if (!isObsoletePace(sd.pace)) continue;
      if (sd.pace === dd.pace) continue;
      out.push({ week: sw.week, day, oldPace: sd.pace, newPace: dd.pace });
    }
  }
  return out;
}

/**
 * Detects weeks where a Match day has a Quality session adjacent (day before
 * or after) — this is a hard coaching rule violation: match = Z3-Z5 quality
 * stress, can't stack with another quality without 48h+ recovery.
 *
 * Returns [{ week, matchDay, conflict: { day, session } }] for each violation.
 */
export function findMatchAdjacencyIssues(savedPlan) {
  const issues = [];
  if (!Array.isArray(savedPlan)) return issues;
  for (const w of savedPlan) {
    for (let i = 0; i < 7; i++) {
      if (!isMatchSession(w[DAYS[i]])) continue;
      const before = i > 0 ? { day: DAYS[i - 1], session: w[DAYS[i - 1]] } : null;
      const after = i < 6 ? { day: DAYS[i + 1], session: w[DAYS[i + 1]] } : null;
      const beforeBad = before && before.session !== "Rest";
      const afterBad = after && after.session !== "Rest";
      if (beforeBad || afterBad) {
        issues.push({
          week: w.week,
          matchDay: DAYS[i],
          conflicts: [
            ...(beforeBad ? [before] : []),
            ...(afterBad ? [after] : []),
          ],
        });
      }
    }
  }
  return issues;
}

/**
 * For weeks flagged with match-adjacency issues, replace the entire week's
 * sessions + detail with the current default. This is the safest fix —
 * trying to surgically swap days could leave the week internally
 * inconsistent (e.g., shifted tempo creating a different conflict).
 */
export function migrateMatchAdjacency(savedPlan, defaultPlan) {
  if (!Array.isArray(savedPlan) || !Array.isArray(defaultPlan)) return savedPlan;
  const issues = findMatchAdjacencyIssues(savedPlan);
  if (issues.length === 0) return savedPlan;
  const affectedWeeks = new Set(issues.map(i => i.week));
  const defaultByWeek = new Map(defaultPlan.map(w => [w.week, w]));
  return savedPlan.map(sw => {
    if (!affectedWeeks.has(sw.week)) return sw;
    const dw = defaultByWeek.get(sw.week);
    return dw ? { ...dw } : sw;
  });
}

/**
 * Returns a copy of `savedPlan` with obsolete pace fields replaced by the
 * defaults. Preserves everything else (km, type, hr, session string,
 * notes, total) so any user-applied Coach Note patches stay intact.
 */
export function migrateObsoletePaces(savedPlan, defaultPlan) {
  if (!Array.isArray(savedPlan) || !Array.isArray(defaultPlan)) return savedPlan;
  const defaultByWeek = new Map(defaultPlan.map(w => [w.week, w]));
  return savedPlan.map(sw => {
    const dw = defaultByWeek.get(sw.week);
    if (!dw?.detail || !sw.detail) return sw;
    let touched = false;
    const newDetail = { ...sw.detail };
    for (const day of Object.keys(sw.detail)) {
      const sd = sw.detail[day];
      const dd = dw.detail[day];
      if (!sd || !dd) continue;
      if (!isObsoletePace(sd.pace)) continue;
      if (sd.pace === dd.pace) continue;
      newDetail[day] = { ...sd, pace: dd.pace };
      touched = true;
    }
    return touched ? { ...sw, detail: newDetail } : sw;
  });
}
