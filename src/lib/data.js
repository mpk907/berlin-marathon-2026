// ═══════════════════════════════════════════════════
// Berlin Marathon 2026 — Training Data
// Source: WHOOP API sync + manual entries
// Last sync: 2026-04-12
// ═══════════════════════════════════════════════════

// Real data from Max's WHOOP-synced Activity Log
export const weeklyData = [
  { week: 1, dates: "05-11 Jan", run: 0, football: 0, spin: 0, plan: 12, longRun: 0, avgHR: 0, z2: 0, avgPace: null },
  { week: 2, dates: "12-18 Jan", run: 7.6, football: 0, spin: 0, plan: 15, longRun: 4.5, avgHR: 141, z2: 0.22, avgPace: "6:56" },
  { week: 3, dates: "19-25 Jan", run: 9.2, football: 0, spin: 15.0, plan: 18, longRun: 4.0, avgHR: 139, z2: 0.16, avgPace: "7:35" },
  { week: 4, dates: "26 Jan-1 Feb", run: 30.2, football: 0, spin: 0, plan: 14, longRun: 8.1, avgHR: 138, z2: 0.37, avgPace: "7:31" },
  { week: 5, dates: "02-08 Feb", run: 15.5, football: 0, spin: 0, plan: 20, longRun: 6.2, avgHR: 138, z2: 0.55, avgPace: "7:41" },
  { week: 6, dates: "09-15 Feb", run: 1.9, football: 0, spin: 11.3, plan: 22, longRun: 1.9, avgHR: 134, z2: 0.37, avgPace: "7:41" },
  { week: 7, dates: "16-22 Feb", run: 15.3, football: 0, spin: 0, plan: 24, longRun: 6.2, avgHR: 142, z2: 0.34, avgPace: "7:36" },
  { week: 8, dates: "23 Feb-1 Mar", run: 2.6, football: 0, spin: 0, plan: 18, longRun: 2.6, avgHR: 136, z2: 0.73, avgPace: "7:32" },
  { week: 9, dates: "02-08 Mar", run: 13.3, football: 0, spin: 0, plan: 26, longRun: 8.0, avgHR: 148, z2: 0.29, avgPace: "7:29" },
  { week: 10, dates: "09-15 Mar", run: 10.4, football: 14.2, spin: 0, plan: 28, longRun: 5.7, avgHR: 144, z2: 0.58, avgPace: "7:50" },
  { week: 11, dates: "16-22 Mar", run: 10.2, football: 0, spin: 0, plan: 30, longRun: 10.2, avgHR: 149, z2: 0.22, avgPace: "8:20" },
  { week: 12, dates: "23-29 Mar", run: 19.7, football: 0, spin: 0, plan: 22, longRun: 10.0, avgHR: 139, z2: 0.68, avgPace: "8:00" },
  { week: 13, dates: "30 Mar-5 Apr", run: 17.4, football: 11.8, spin: 4.5, plan: 32, longRun: 11.8, avgHR: 143, z2: 0.69, avgPace: "8:10" },
  { week: 14, dates: "06-12 Apr", run: 13.5, football: 6.6, spin: 26.3, plan: 35, longRun: 13.5, avgHR: 140, z2: 0.93, avgPace: "7:49" },
];

// HR zones — aligned with WHOOP (% of max HR ~182)
// WHOOP uses simple % of max HR, not Karvonen
export const hrZones = {
  z1: { name: "Recovery", range: "91-109 bpm", pct: "50-60%", color: "#90CAF9", use: "Warmup, cooldown, recovery", floor: 91, ceiling: 109 },
  z2: { name: "Fat Burn", range: "109-127 bpm", pct: "60-70%", color: "#66BB6A", use: "Easy runs, long runs — most training here", floor: 109, ceiling: 127 },
  z3: { name: "Cardio", range: "127-146 bpm", pct: "70-80%", color: "#FFA726", use: "Tempo runs, marathon pace", floor: 127, ceiling: 146 },
  z4: { name: "Hard", range: "146-164 bpm", pct: "80-90%", color: "#EF5350", use: "Intervals, hill repeats", floor: 146, ceiling: 164 },
  z5: { name: "Max", range: "164-182 bpm", pct: "90-100%", color: "#AB47BC", use: "Sprints, football intensity", floor: 164, ceiling: 182 },
};

// Training plan — daily sessions for all 38 weeks
export const trainingPlan = [
  { week: 1, dates: "05-11 Jan", total: 12, mon: "Rest", tue: "4 easy", wed: "Rest", thu: "4 easy", fri: "Rest", sat: "Rest", sun: "4 easy", notes: "" },
  { week: 2, dates: "12-18 Jan", total: 15, mon: "Rest", tue: "4 easy", wed: "Rest", thu: "5 easy", fri: "Rest", sat: "Rest", sun: "6 easy", notes: "" },
  { week: 3, dates: "19-25 Jan", total: 18, mon: "Rest", tue: "5 easy", wed: "Rest", thu: "6 easy", fri: "Rest", sat: "Rest", sun: "7 easy", notes: "" },
  { week: 4, dates: "26 Jan-1 Feb", total: 14, mon: "Rest", tue: "4 easy", wed: "Rest", thu: "4 easy", fri: "Rest", sat: "Rest", sun: "6 easy", notes: "EASE WEEK" },
  { week: 5, dates: "02-08 Feb", total: 20, mon: "Rest", tue: "6 easy", wed: "Rest", thu: "6 easy", fri: "Rest", sat: "Rest", sun: "8 easy", notes: "" },
  { week: 6, dates: "09-15 Feb", total: 22, mon: "Rest", tue: "6 easy", wed: "Rest", thu: "7 easy", fri: "Rest", sat: "Rest", sun: "9 easy", notes: "" },
  { week: 7, dates: "16-22 Feb", total: 24, mon: "Rest", tue: "7 easy", wed: "Rest", thu: "7 easy", fri: "Rest", sat: "Rest", sun: "10 easy", notes: "" },
  { week: 8, dates: "23 Feb-1 Mar", total: 18, mon: "Rest", tue: "5 easy", wed: "Rest", thu: "5 easy", fri: "Rest", sat: "Rest", sun: "8 easy", notes: "EASE WEEK" },
  { week: 9, dates: "02-08 Mar", total: 26, mon: "Rest", tue: "8 easy", wed: "Rest", thu: "8 easy", fri: "Rest", sat: "Rest", sun: "10 easy", notes: "" },
  { week: 10, dates: "09-15 Mar", total: 28, mon: "Rest", tue: "8 easy", wed: "Rest", thu: "8 easy", fri: "Rest", sat: "Rest", sun: "12 long", notes: "Match Sun" },
  { week: 11, dates: "16-22 Mar", total: 30, mon: "Rest", tue: "8 easy", wed: "Rest", thu: "10 easy", fri: "Rest", sat: "Rest", sun: "12 long", notes: "" },
  { week: 12, dates: "23-29 Mar", total: 22, mon: "Rest", tue: "6 easy", wed: "Rest", thu: "6 easy", fri: "Rest", sat: "Rest", sun: "10 easy", notes: "EASE WEEK" },
  { week: 13, dates: "30 Mar-5 Apr", total: 32, mon: "Rest", tue: "9 easy", wed: "Rest", thu: "9 tempo", fri: "Rest", sat: "Rest", sun: "14 long", notes: "Match Tue" },
  { week: 14, dates: "06-12 Apr", total: 35, mon: "Rest", tue: "9 easy", wed: "Rest", thu: "10 (4x1km)", fri: "Rest", sat: "6", sun: "14 long", notes: "Quality Thu" },
  { week: 15, dates: "13-19 Apr", total: 28, mon: "✈️ Travel", tue: "8 easy", wed: "Rest", thu: "8 (3x2km MP)", fri: "✈️ Home", sat: "Rest", sun: "12 easy", notes: "BOSTON TRIP",
    detail: { tue: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:8,type:"tempo",hr:"Z3 127-146",pace:"6:20-6:40 in reps"}, sun: {km:12,type:"easy/long",hr:"Z2 109-127",pace:"7:30-8:00"}} },
  { week: 16, dates: "20-26 Apr", total: 28, mon: "Rest", tue: "8 easy", wed: "Rest", thu: "8 easy", fri: "Match", sat: "Rest", sun: "10 easy", notes: "EASE",
    detail: { tue: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, fri: {km:0,type:"football",hr:"Z3-Z5 mixed"}, sun: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}} },
  { week: 17, dates: "27 Apr-3 May", total: 38, mon: "Rest", tue: "10 easy", wed: "Rest", thu: "11 (4x2km)", fri: "Rest", sat: "Rest", sun: "17 long", notes: "Quality Thu",
    detail: { tue: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:11,type:"intervals",hr:"Z4 146-164 in reps",pace:"5:50-6:10 reps, jog recovery"}, sun: {km:17,type:"long",hr:"Z2 109-127, neg split last 3km",pace:"7:40-8:00, last 3km 7:15"}} },
  { week: 18, dates: "04-10 May", total: 40, mon: "Rest", tue: "10 easy", wed: "Rest", thu: "12 tempo", fri: "Match", sat: "Rest", sun: "18 long", notes: "Match Fri",
    detail: { tue: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:12,type:"tempo",hr:"Z3 127-146 steady",pace:"6:20-6:40"}, sun: {km:18,type:"long",hr:"Z2 109-127",pace:"7:40-8:00"}} },
  { week: 19, dates: "11-17 May", total: 42, mon: "Rest", tue: "10 easy", wed: "Rest", thu: "12 (5x1km)", fri: "Rest", sat: "Rest", sun: "20 long", notes: "First 20!",
    detail: { tue: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:12,type:"intervals",hr:"Z4 146-164 in reps",pace:"5:30-5:50 reps, 90s jog"}, sun: {km:20,type:"long",hr:"Z2 109-127",pace:"7:40-8:00, walk breaks OK"}} },
  { week: 20, dates: "18-24 May", total: 33, mon: "Rest", tue: "9 easy", wed: "Rest", thu: "Match", fri: "Rest", sat: "Rest", sun: "14 easy", notes: "EASE",
    detail: { tue: {km:9,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, sun: {km:14,type:"long easy",hr:"Z2 109-127",pace:"7:45-8:15"}} },
  { week: 21, dates: "25-31 May", total: 44, mon: "Rest", tue: "11 easy", wed: "Rest", thu: "13 easy", fri: "Match", sat: "Rest", sun: "20 long", notes: "Match Fri",
    detail: { tue: {km:11,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00 (pre-match)"}, sun: {km:20,type:"long",hr:"Z2, last 5km@MP",pace:"7:40 then 6:30 last 5km"}} },
  { week: 22, dates: "01-07 Jun", total: 45, mon: "Rest", tue: "11 easy", wed: "Rest", thu: "13 (3x3km)", fri: "Match", sat: "Rest", sun: "20 long", notes: "Tempo Thu",
    detail: { tue: {km:11,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:13,type:"tempo",hr:"Z3 127-146",pace:"6:20-6:40"}, sun: {km:20,type:"long",hr:"Z2 steady",pace:"7:40-8:00"}} },
  { week: 23, dates: "08-14 Jun", total: 46, mon: "Rest", tue: "12 easy", wed: "Rest", thu: "14 quality", fri: "Rest", sat: "Rest", sun: "20 long", notes: "No match",
    detail: { tue: {km:12,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:14,type:"quality",hr:"Z3-Z4 mixed",pace:"tempo blocks 6:20 + recovery"}, sun: {km:20,type:"long",hr:"Z2, last 8km@MP",pace:"7:40 then 6:30 last 8km"}} },
  { week: 24, dates: "15-21 Jun", total: 35, mon: "Rest", tue: "10 easy", wed: "Rest", thu: "10 easy", fri: "LAST MATCH", sat: "Rest", sun: "15 easy", notes: "EASE",
    detail: { tue: {km:10,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, thu: {km:10,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, sun: {km:15,type:"long easy",hr:"Z2 109-127",pace:"7:45-8:15"}} },
  { week: 25, dates: "22-28 Jun", total: 48, mon: "Rest", tue: "12 easy", wed: "8 easy", thu: "14 (6x1km)", fri: "Rest", sat: "Rest", sun: "22 long", notes: "Peak — no football!",
    detail: { tue: {km:12,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:14,type:"intervals",hr:"Z4 146-164",pace:"5:30-5:50 reps, 90s jog"}, sun: {km:22,type:"long",hr:"Z2 first 16, MP last 6",pace:"7:40 then 6:30"}} },
  { week: 26, dates: "29 Jun-5 Jul", total: 50, mon: "Rest", tue: "13 easy", wed: "8 easy", thu: "14 tempo", fri: "Rest", sat: "Rest", sun: "24 long", notes: "Big volume",
    detail: { tue: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:14,type:"tempo",hr:"Z3 127-146 steady",pace:"6:20-6:40"}, sun: {km:24,type:"long",hr:"Z2 steady",pace:"7:30-7:50"}} },
  { week: 27, dates: "06-12 Jul", total: 52, mon: "Rest", tue: "13 easy", wed: "8 easy", thu: "15 (4x3km)", fri: "Rest", sat: "Rest", sun: "24 long", notes: "Quality + distance",
    detail: { tue: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:15,type:"tempo",hr:"Z3 127-146",pace:"4x3km@6:20, 2km warm/cool"}, sun: {km:24,type:"long",hr:"Z2 first 18, MP last 6",pace:"7:40 then 6:30"}} },
  { week: 28, dates: "13-19 Jul", total: 40, mon: "Rest", tue: "10 easy", wed: "Rest", thu: "10 easy", fri: "Rest", sat: "Rest", sun: "18 long", notes: "EASE",
    detail: { tue: {km:10,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, thu: {km:10,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, sun: {km:18,type:"long easy",hr:"Z2 109-127",pace:"7:45-8:15"}} },
  { week: 29, dates: "20-26 Jul", total: 52, mon: "Rest", tue: "13 easy", wed: "8 easy", thu: "15 MP reps", fri: "Rest", sat: "Rest", sun: "24 long", notes: "Back to peak",
    detail: { tue: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:15,type:"MP intervals",hr:"Z3 127-146",pace:"4x3km@6:20-6:40, 2min jog"}, sun: {km:24,type:"long",hr:"Z2 steady",pace:"7:30-7:50"}} },
  { week: 30, dates: "27 Jul-2 Aug", total: 55, mon: "Rest", tue: "14 easy", wed: "8 easy", thu: "15 (5x2km)", fri: "Rest", sat: "Rest", sun: "27 long", notes: "HIGHEST VOLUME",
    detail: { tue: {km:14,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:15,type:"tempo",hr:"Z3 127-146",pace:"5x2km@6:20, 90s jog"}, sun: {km:27,type:"long — race rehearsal",hr:"Z2 first 20, MP last 7",pace:"7:40 then 6:30, practice nutrition"}} },
  { week: 31, dates: "03-09 Aug", total: 55, mon: "Rest", tue: "14 easy", wed: "8 easy", thu: "16 quality", fri: "Rest", sat: "Rest", sun: "25 long", notes: "PEAK WEEK",
    detail: { tue: {km:14,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:16,type:"quality",hr:"Z3-Z4 mixed",pace:"varied"}, sun: {km:25,type:"long",hr:"Z2 steady",pace:"7:30-7:50"}} },
  { week: 32, dates: "10-16 Aug", total: 42, mon: "Rest", tue: "11 easy", wed: "Rest", thu: "11 easy", fri: "Rest", sat: "Rest", sun: "20 easy", notes: "EASE",
    detail: { tue: {km:11,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, thu: {km:11,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, sun: {km:20,type:"long easy",hr:"Z2 109-127",pace:"7:45-8:15"}} },
  { week: 33, dates: "17-23 Aug", total: 52, mon: "Rest", tue: "13 easy", wed: "8 easy", thu: "14 MP 10km", fri: "Rest", sat: "Rest", sun: "25 long", notes: "Race-specific",
    detail: { tue: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:14,type:"MP continuous",hr:"Z3 127-146 (10km@MP)",pace:"6:30 steady for 10km block"}, sun: {km:25,type:"long",hr:"Z2 steady",pace:"7:30-7:50"}} },
  { week: 34, dates: "24-30 Aug", total: 50, mon: "Rest", tue: "13 easy", wed: "8 easy", thu: "14 tempo", fri: "Rest", sat: "Rest", sun: "28 long", notes: "DRESS REHEARSAL!",
    detail: { tue: {km:13,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, wed: {km:8,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:14,type:"tempo",hr:"Z3 127-146",pace:"6:20-6:40"}, sun: {km:28,type:"long — dress rehearsal",hr:"Z2 start, MP last 10",pace:"7:40 then 6:30, race kit + nutrition"}} },
  { week: 35, dates: "31 Aug-6 Sep", total: 40, mon: "5 easy", tue: "10 easy", wed: "Rest", thu: "10 easy tempo", fri: "Rest", sat: "Rest", sun: "15 easy", notes: "TAPER 1",
    detail: { mon: {km:5,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, tue: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:30-8:00"}, thu: {km:10,type:"easy tempo",hr:"Z2-Z3",pace:"7:30 + 4x100m strides"}, sun: {km:15,type:"easy",hr:"Z2 109-127",pace:"7:40-8:00"}} },
  { week: 36, dates: "07-13 Sep", total: 30, mon: "Rest", tue: "8 easy", wed: "Rest", thu: "8 + strides", fri: "Rest", sat: "Rest", sun: "10 easy", notes: "TAPER 2",
    detail: { tue: {km:8,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}, thu: {km:8,type:"easy + strides",hr:"Z2 + 4x100m@Z4",pace:"8:00 + strides"}, sun: {km:10,type:"easy",hr:"Z2 109-127",pace:"7:45-8:15"}} },
  { week: 37, dates: "14-20 Sep", total: 20, mon: "Rest", tue: "5 easy", wed: "Rest", thu: "5 + strides", fri: "Rest", sat: "4 shakeout", sun: "6 easy", notes: "TAPER 3",
    detail: { tue: {km:5,type:"easy",hr:"Z1 < 109",pace:"8:30+"}, thu: {km:5,type:"easy + strides",hr:"Z1-Z2, 4x80m strides",pace:"8:30 + strides"}, sat: {km:4,type:"shakeout",hr:"Z1 < 109",pace:"8:00 gentle"}, sun: {km:6,type:"easy",hr:"Z1-Z2 < 127",pace:"8:00+"}} },
  { week: 38, dates: "21-28 Sep", total: 42.2, mon: "Rest", tue: "4 shakeout", wed: "Rest", thu: "3 easy", fri: "Rest", sat: "Rest", sun: "42.2 RACE", notes: "BERLIN",
    detail: { tue: {km:4,type:"shakeout",hr:"Z1 < 109",pace:"8:00 gentle"}, thu: {km:3,type:"easy",hr:"Z1 < 109",pace:"8:30+ very easy"}, sun: {km:42.2,type:"RACE",hr:"Z2-Z3: start 6:40, hold 6:30",pace:"Start conservative, negative split"}} },
];

// Auto-fix: recompute week totals from daily sessions to ensure consistency
function parseSessionKm(session) {
  if (!session || session === "Rest" || session.includes("✈️") || session === "Match" || session === "LAST MATCH") return 0;
  const match = session.match(/^(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}
const daySlots = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
for (const week of trainingPlan) {
  const computed = daySlots.reduce((sum, d) => sum + parseSessionKm(week[d]), 0);
  if (computed > 0) week.total = Math.round(computed * 10) / 10;
}

// Actuals per day for completed weeks (from Activity Log)
export const weeklyActuals = {
  2:  { sat: "🏃4.5", sun: "🏃3.1" },
  3:  { wed: "🏃3.5", fri: "🏃4.0", sat: "🚴15.0\n158min", sun: "🏃1.7" },
  4:  { mon: "🏃4.3", tue: "🏃4.2", thu: "🏃5.0", fri: "🏃5.9", sat: "🏃2.7", sun: "🏃8.1" },
  5:  { thu: "🏃3.9", sat: "🏃6.2", sun: "🏃5.4" },
  6:  { wed: "🏃1.9", fri: "🚴6.8" },
  7:  { mon: "🏃4.5", fri: "🏃4.7", sat: "🏃6.2" },
  8:  { sat: "28min", sun: "🏃2.6" },
  9:  { thu: "🏃5.3", sun: "🏃8.0" },
  10: { tue: "🏃4.8", fri: "🏃5.7", sun: "⚽14.2" },
  11: { tue: "🏃10.2" },
  12: { mon: "🏃4.0", thu: "🏃5.7", sun: "🏃10.0" },
  13: { mon: "🚴2.7", tue: "⚽11.8", fri: "🏃5.6", sat: "🏃11.8" },
  14: { mon: "🚴7.0", wed: "⚽6.6", sat: "🚴4.5", sun: "🏃13.5\n🚴4.3" },
};
