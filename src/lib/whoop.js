// ═══════════════════════════════════════════════════
// WHOOP API Client for Berlin Marathon Dashboard
// Ported from whoop_sync.py — handles token refresh,
// paginated activity fetch, zone/HR/distance processing
// ═══════════════════════════════════════════════════

const COGNITO_URL = "https://cognito-idp.us-west-2.amazonaws.com/";
const API_BASE = "https://api.prod.whoop.com";
const CLIENT_ID = "37365lrcda1js3fapqfe2n40eh"; // WHOOP web app client ID

// v2_activity type string → our tracker Type
const TYPE_MAP = {
  "running": "Run", "trail-running": "Run", "treadmill-running": "Run",
  "soccer": "Football", "football": "Football", "futsal": "Football",
  "cycling": "Spin", "spinning": "Spin", "spin": "Spin",
  "mountain-biking": "Spin", "indoor-cycling": "Spin",
};

// sport_id fallback mapping
const SPORT_ID_MAP = {
  0: "Run", 33: "Run", 63: "Run",
  1: "Spin", 57: "Spin", 97: "Spin",
  30: "Football",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Refresh WHOOP access token using Cognito refresh_token grant.
 * Returns new access token string.
 */
export async function refreshAccessToken(refreshToken) {
  const resp = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  const newToken = data.AuthenticationResult?.AccessToken;
  if (!newToken) throw new Error("No AccessToken in refresh response");
  return newToken;
}

/**
 * Parse WHOOP's PostgreSQL range format for timestamps.
 * e.g. "['2026-04-12T14:13:30.670Z','2026-04-12T14:41:59.630Z')"
 */
function parseDuring(duringStr) {
  const matches = (duringStr || "").match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/g);
  if (matches && matches.length >= 2) {
    return { start: new Date(matches[0]), end: new Date(matches[1]) };
  } else if (matches && matches.length === 1) {
    return { start: new Date(matches[0]), end: null };
  }
  return { start: null, end: null };
}

/**
 * Fetch all activities from WHOOP API, paginating in 14-day chunks.
 * Automatically refreshes token on 401 if refreshToken is provided.
 */
export async function fetchActivities(accessToken, startDate, endDate, refreshToken = null) {
  const activities = [];
  let token = accessToken;
  let chunkStart = new Date(startDate);
  const end = new Date(endDate);
  let tokenRefreshed = false;

  while (chunkStart < end) {
    const chunkEnd = new Date(Math.min(
      chunkStart.getTime() + 14 * 86400000,
      end.getTime()
    ));

    const params = new URLSearchParams({
      apiVersion: "7",
      startTime: chunkStart.toISOString(),
      endTime: chunkEnd.toISOString(),
    });

    let resp = await fetch(
      `${API_BASE}/core-details-bff/v0/cycles/details?${params}`,
      { headers: { Authorization: `bearer ${token}` } }
    );

    // Auto-refresh on 401
    if (resp.status === 401 && !tokenRefreshed && refreshToken) {
      token = await refreshAccessToken(refreshToken);
      tokenRefreshed = true;
      resp = await fetch(
        `${API_BASE}/core-details-bff/v0/cycles/details?${params}`,
        { headers: { Authorization: `bearer ${token}` } }
      );
    }

    if (resp.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }

    if (!resp.ok) {
      console.warn(`WHOOP API error ${resp.status} for chunk ${chunkStart.toISOString()}`);
      chunkStart = new Date(chunkEnd.getTime() + 86400000);
      continue;
    }

    const data = await resp.json();
    const records = data.records || [];

    for (const record of records) {
      const workouts = record.workouts || [];
      const v2Activities = record.v2_activities || [];
      const recovery = record.recovery || {};

      // Build activity_id → v2_activity lookup
      const v2Lookup = {};
      for (const v2 of v2Activities) {
        v2Lookup[v2.id] = v2;
      }

      for (const w of workouts) {
        const v2 = v2Lookup[w.activity_id] || {};
        const v2Type = v2.type || "";

        // Skip sleep/nap
        if (v2Type === "sleep" || v2Type === "nap") continue;

        // Determine activity type
        const activityType = TYPE_MAP[v2Type] || SPORT_ID_MAP[w.sport_id] || "Other";

        // Parse timestamps
        const { start, end: endTs } = parseDuring(w.during || "");
        if (!start) continue;

        // Duration in minutes
        const durationMin = endTs
          ? Math.round((endTs - start) / 60000 * 10) / 10
          : 0;

        // Distance from GPS data
        const gps = w.gps_data || {};
        const distanceKm = Math.round((gps.distance_meters || 0) / 1000 * 100) / 100;

        // Pace (min/km) for runs with GPS
        let pace = "";
        if (activityType === "Run" && distanceKm > 0.5 && durationMin > 0) {
          const paceVal = durationMin / distanceKm;
          const paceMin = Math.floor(paceVal);
          const paceSec = Math.floor((paceVal - paceMin) * 60);
          pace = `${paceMin}:${String(paceSec).padStart(2, "0")}`;
        }

        // Heart rate
        const avgHr = w.average_heart_rate || null;
        const maxHr = w.max_heart_rate || null;

        // Zone percentages from zone_durations (6 zones in seconds)
        // WHOOP zones: [0-50%, 50-60%, 60-70%, 70-80%, 80-90%, 90-100%]
        // Our zones: Z1=0-60%, Z2=60-70%, Z3=70-80%, Z4=80-90%, Z5=90-100%
        const zones = w.zone_durations || [0, 0, 0, 0, 0, 0];
        const totalZoneSec = zones.reduce((a, b) => a + b, 0);
        let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0;
        if (totalZoneSec > 0) {
          z1 = Math.round((zones[0] + zones[1]) / totalZoneSec * 100) / 100;
          z2 = Math.round(zones[2] / totalZoneSec * 100) / 100;
          z3 = Math.round(zones[3] / totalZoneSec * 100) / 100;
          z4 = Math.round(zones[4] / totalZoneSec * 100) / 100;
          z5 = Math.round(zones[5] / totalZoneSec * 100) / 100;
        }

        // Calories (kJ → kcal)
        const kj = w.kilojoules || 0;
        const calories = kj ? Math.round(kj / 4.184) : null;

        activities.push({
          date: start.toISOString(),
          day: DAY_NAMES[start.getUTCDay() === 0 ? 6 : start.getUTCDay() - 1],
          type: activityType,
          translatedType: v2.translated_type || v2Type,
          distance: distanceKm,
          duration: durationMin,
          pace,
          avgHr,
          maxHr,
          z1, z2, z3, z4, z5,
          calories,
          restingHr: recovery.resting_heart_rate || null,
          recoveryScore: recovery.recovery_score || null,
        });
      }
    }

    chunkStart = new Date(chunkEnd.getTime() + 86400000);
  }

  activities.sort((a, b) => new Date(a.date) - new Date(b.date));
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
    // Football equiv: 0.11 km/min (from project spec)
    const footballEquiv = football.reduce((s, a) => s + a.duration * 0.11, 0);
    // Spin: use distance if available, else ~0.25 km/min equiv (~15 km/h indoor cycling)
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

    // Average pace from runs with pace data
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

    // Week date range string
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
      plan: 0, // merged with training plan on the client side
      longRun: Math.round(longRun * 10) / 10,
      avgHR,
      z2: avgZ2,
      avgPace: avgPaceStr,
    });

    // Build daily actuals for Training Plan view
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
