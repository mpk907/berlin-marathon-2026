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
