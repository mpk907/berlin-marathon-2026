// ═══════════════════════════════════════════════════
// WHOOP Developer API v1 Client
// Uses OAuth2 tokens (not Cognito) for Berlin Marathon Dashboard
// Endpoints: /developer/v1/activity/workout, /developer/v1/cycle
// ═══════════════════════════════════════════════════

const API_BASE = "https://api.prod.whoop.com/developer/v1";

// sport_id → our tracker Type
const SPORT_ID_MAP = {
  0: "Run", 1: "Spin", 16: "Run", // running, cycling, outdoor run
  33: "Run", 63: "Run",            // track running, trail running
  57: "Spin", 97: "Spin",          // indoor cycling
  30: "Football",                   // soccer
  44: "Other", 48: "Other",        // functional fitness, HIIT
  71: "Other",                      // strength training
  "-1": "Other",                     // unspecified
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Fetch all workouts from WHOOP Developer API v1.
 * Paginates using nextToken.
 */
export async function fetchActivities(accessToken, startDate, endDate) {
  const activities = [];
  const token = accessToken;

  // Fetch workouts
  let nextToken = null;
  let pageCount = 0;
  const MAX_PAGES = 50; // safety valve

  do {
    const params = new URLSearchParams({
      start: new Date(startDate).toISOString(),
      end: new Date(endDate).toISOString(),
      limit: "25",
    });
    if (nextToken) params.set("nextToken", nextToken);

    const resp = await fetch(`${API_BASE}/activity/workout/collection?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[whoop] API error ${resp.status}: ${errText}`);
      break;
    }

    const data = await resp.json();
    const records = data.records || [];
    console.log(`[whoop] Page ${pageCount + 1}: ${records.length} workouts`);

    for (const w of records) {
      if (!w.start || !w.end) continue;
      if (w.score_state !== "SCORED") continue;

      const score = w.score || {};
      const start = new Date(w.start);
      const end = new Date(w.end);

      // Duration in minutes
      const durationMin = Math.round((end - start) / 60000 * 10) / 10;

      // Activity type from sport_id
      const activityType = SPORT_ID_MAP[w.sport_id] ?? "Other";

      // Distance
      const distanceKm = Math.round((score.distance_meter || 0) / 1000 * 100) / 100;

      // Pace (min/km) for runs with distance
      let pace = "";
      if (activityType === "Run" && distanceKm > 0.5 && durationMin > 0) {
        const paceVal = durationMin / distanceKm;
        const paceMin = Math.floor(paceVal);
        const paceSec = Math.floor((paceVal - paceMin) * 60);
        pace = `${paceMin}:${String(paceSec).padStart(2, "0")}`;
      }

      // Heart rate
      const avgHr = score.average_heart_rate || null;
      const maxHr = score.max_heart_rate || null;

      // Zone percentages from zone_duration (milliseconds)
      // WHOOP zones: zone_zero through zone_five
      // Our mapping: Z1=zone_zero+zone_one, Z2=zone_two, Z3=zone_three, Z4=zone_four, Z5=zone_five
      const zd = score.zone_duration || {};
      const zones = [
        zd.zone_zero_milli || 0,
        zd.zone_one_milli || 0,
        zd.zone_two_milli || 0,
        zd.zone_three_milli || 0,
        zd.zone_four_milli || 0,
        zd.zone_five_milli || 0,
      ];
      const totalZone = zones.reduce((a, b) => a + b, 0);
      let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0;
      if (totalZone > 0) {
        z1 = Math.round((zones[0] + zones[1]) / totalZone * 100) / 100;
        z2 = Math.round(zones[2] / totalZone * 100) / 100;
        z3 = Math.round(zones[3] / totalZone * 100) / 100;
        z4 = Math.round(zones[4] / totalZone * 100) / 100;
        z5 = Math.round(zones[5] / totalZone * 100) / 100;
      }

      // Calories (kJ → kcal)
      const kj = score.kilojoule || 0;
      const calories = kj ? Math.round(kj / 4.184) : null;

      activities.push({
        date: start.toISOString(),
        day: DAY_NAMES[start.getUTCDay() === 0 ? 6 : start.getUTCDay() - 1],
        type: activityType,
        translatedType: `sport_id_${w.sport_id}`,
        distance: distanceKm,
        duration: durationMin,
        pace,
        avgHr,
        maxHr,
        z1, z2, z3, z4, z5,
        calories,
        strain: score.strain || null,
        restingHr: null,       // populated from cycle data below
        recoveryScore: null,   // populated from cycle data below
      });
    }

    nextToken = data.next_token || null;
    pageCount++;
  } while (nextToken && pageCount < MAX_PAGES);

  // Fetch cycles for recovery data (resting HR, recovery score)
  try {
    let cycleNext = null;
    let cyclePage = 0;
    const recoveryByDate = {};

    do {
      const params = new URLSearchParams({
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
        limit: "25",
      });
      if (cycleNext) params.set("nextToken", cycleNext);

      const resp = await fetch(`${API_BASE}/cycle/collection?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) break;

      const data = await resp.json();
      for (const c of (data.records || [])) {
        if (!c.start) continue;
        const dateKey = c.start.slice(0, 10); // YYYY-MM-DD
        const recovery = c.score?.recovery || {};
        recoveryByDate[dateKey] = {
          restingHr: recovery.resting_heart_rate || null,
          recoveryScore: recovery.recovery_score || null,
        };
      }

      cycleNext = data.next_token || null;
      cyclePage++;
    } while (cycleNext && cyclePage < MAX_PAGES);

    // Merge recovery data into activities
    for (const act of activities) {
      const dateKey = act.date.slice(0, 10);
      const rec = recoveryByDate[dateKey];
      if (rec) {
        act.restingHr = rec.restingHr;
        act.recoveryScore = rec.recoveryScore;
      }
    }

    console.log(`[whoop] Loaded recovery data for ${Object.keys(recoveryByDate).length} days`);
  } catch (err) {
    console.warn("[whoop] Failed to fetch cycle/recovery data:", err.message);
    // Non-fatal — workouts still usable without recovery data
  }

  activities.sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log(`[whoop] Total: ${activities.length} activities`);
  return { activities, accessToken: token };
}

/**
 * Process raw activities into weekly summaries for the dashboard.
 * Returns { weeklyData, weeklyActuals } matching data.js format.
 */
export function processActivities(activities) {
  const WEEK1_START = new Date("2026-01-05T00:00:00Z");

  // Group activities by training week (Week 1 starts Jan 5)
  const weeks = {};
  for (const act of activities) {
    const actDate = new Date(act.date);
    const diffDays = Math.floor((actDate - WEEK1_START) / 86400000);
    if (diffDays < 0) continue;
    const weekNum = Math.floor(diffDays / 7) + 1;
    if (weekNum > 38) continue;
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(act);
  }

  // Estimate distances for GPS-less runs using avg pace from GPS runs
  const gpsPaces = activities
    .filter(a => a.type === "Run" && a.distance > 0.5 && a.duration > 5)
    .map(a => a.duration / a.distance);
  const avgPace = gpsPaces.length > 0
    ? gpsPaces.reduce((a, b) => a + b, 0) / gpsPaces.length
    : 8.0;

  for (const act of activities) {
    if (act.type === "Run" && act.distance <= 0.5 && act.duration > 5) {
      act.distance = Math.round(act.duration / avgPace * 100) / 100;
      act.estimated = true;
      const pm = Math.floor(avgPace);
      const ps = Math.floor((avgPace % 1) * 60);
      act.pace = `${pm}:${String(ps).padStart(2, "0")}`;
    }
  }

  // Build weekly summaries
  const weeklyData = [];
  const weeklyActuals = {};
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  for (let wk = 1; wk <= 38; wk++) {
    const acts = weeks[wk] || [];
    if (acts.length === 0) continue;

    const runs = acts.filter(a => a.type === "Run");
    const football = acts.filter(a => a.type === "Football");
    const spin = acts.filter(a => a.type === "Spin");

    const runKm = runs.reduce((s, a) => s + a.distance, 0);
    const footballEquiv = football.reduce((s, a) => s + a.duration * 0.11, 0);
    const spinKm = spin.reduce((s, a) => s + (a.distance > 0 ? a.distance : a.duration * 0.25), 0);

    const longRun = runs.length > 0
      ? Math.max(...runs.map(a => a.distance))
      : 0;

    const hrValues = acts.filter(a => a.avgHr).map(a => a.avgHr);
    const avgHR = hrValues.length > 0
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : 0;

    const z2Values = runs.filter(a => a.z2 > 0).map(a => a.z2);
    const avgZ2 = z2Values.length > 0
      ? Math.round(z2Values.reduce((a, b) => a + b, 0) / z2Values.length * 100) / 100
      : 0;

    const paceRuns = runs.filter(a => a.pace && a.distance > 0.5);
    let avgPaceStr = null;
    if (paceRuns.length > 0) {
      const paceVals = paceRuns.map(a => {
        const [m, s] = a.pace.split(":").map(Number);
        return m + s / 60;
      });
      const avg = paceVals.reduce((a, b) => a + b, 0) / paceVals.length;
      let pm = Math.floor(avg);
      let ps = Math.round((avg - pm) * 60);
      if (ps >= 60) { pm++; ps = 0; }
      avgPaceStr = `${pm}:${String(ps).padStart(2, "0")}`;
    }

    const wkStart = new Date(WEEK1_START.getTime() + (wk - 1) * 7 * 86400000);
    const wkEnd = new Date(wkStart.getTime() + 6 * 86400000);
    const fmtDate = (d) => {
      const day = String(d.getUTCDate()).padStart(2, "0");
      const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      return `${day} ${mon}`;
    };
    const dateStr = `${fmtDate(wkStart)}-${fmtDate(wkEnd)}`;

    weeklyData.push({
      week: wk,
      dates: dateStr,
      run: Math.round(runKm * 10) / 10,
      football: Math.round(footballEquiv * 10) / 10,
      spin: Math.round(spinKm * 10) / 10,
      plan: 0,
      longRun: Math.round(longRun * 10) / 10,
      avgHR,
      z2: avgZ2,
      avgPace: avgPaceStr,
    });

    const dayMap = {};
    for (const act of acts) {
      const dow = dayKeys[new Date(act.date).getUTCDay()];
      if (!dayMap[dow]) dayMap[dow] = [];
      const emoji = act.type === "Run" ? "🏃" : act.type === "Football" ? "⚽" : act.type === "Spin" ? "🚴" : "💪";
      if (act.distance > 0.5) {
        dayMap[dow].push(`${emoji}${act.distance.toFixed(1)}`);
      } else {
        dayMap[dow].push(`${emoji}${Math.round(act.duration)}min`);
      }
    }
    const dayActuals = {};
    for (const [dow, items] of Object.entries(dayMap)) {
      dayActuals[dow] = items.join("\n");
    }
    weeklyActuals[wk] = dayActuals;
  }

  return { weeklyData, weeklyActuals };
}
