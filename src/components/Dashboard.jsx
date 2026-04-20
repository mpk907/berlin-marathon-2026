"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from "recharts";
import {
  weeklyData as staticWeeklyData,
  hrZones as staticHrZones,
  trainingPlan as staticTrainingPlan,
  weeklyActuals as staticWeeklyActuals,
} from "@/lib/data";

const KPI = ({ label, value, sub, color = "text-slate-800" }) => (
  <div className="bg-white rounded-xl p-3 sm:p-5 shadow-sm border border-slate-100">
    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-xl sm:text-3xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
  </div>
);

const StatusBadge = ({ pct }) => {
  if (pct >= 85) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">On Track</span>;
  if (pct >= 50) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Close</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Off Track</span>;
};

const DayCell = ({ planned, actual, isPast, isFuture, detail }) => {
  if (isFuture) {
    const hasSession = planned && planned !== "Rest" && !planned.includes("✈️");
    return (
      <div className={`text-xs py-1 px-1 rounded ${hasSession ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-300"}`}>
        <div>{planned || "Rest"}</div>
        {detail && (
          <div className="mt-0.5 text-slate-400 font-normal" style={{ fontSize: "10px" }}>
            {detail.hr && <div>{detail.hr}</div>}
            {detail.pace && <div>{detail.pace}</div>}
          </div>
        )}
      </div>
    );
  }
  if (isPast && actual) {
    return (
      <div className="text-xs py-1 px-1 rounded bg-emerald-50 text-emerald-700 font-medium whitespace-pre-line">
        {actual}
      </div>
    );
  }
  if (isPast) {
    return <div className="text-xs py-1 px-1 text-slate-300">—</div>;
  }
  return <div className="text-xs py-1 px-1 text-slate-300">—</div>;
};

// HR Zone reference card component (uses static import — zones are constant)
const ZoneCard = () => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
    <h4 className="text-sm font-semibold text-slate-700 mb-3">HR Zone Reference (WHOOP)</h4>
    <div className="space-y-2">
      {Object.values(staticHrZones).map(z => (
        <div key={z.name} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }}></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-slate-700">{z.name}</span>
              <span className="text-xs text-slate-500">{z.range}</span>
              <span className="text-xs text-slate-400">({z.pct})</span>
            </div>
            <div className="text-xs text-slate-400">{z.use}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
      Max HR: ~182 bpm · Resting: ~55 bpm · Easy run target: Z2 (127-146)
    </div>
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [planView, setPlanView] = useState("upcoming");
  const [expandedWeek, setExpandedWeek] = useState(null);

  // ═══ LIVE DATA: fetch from API, fall back to static ═══
  const [weeklyData, setWeeklyData] = useState(staticWeeklyData);
  const [trainingPlan, setTrainingPlan] = useState(staticTrainingPlan);
  const [weeklyActuals, setWeeklyActuals] = useState(staticWeeklyActuals);
  const [hrZones, setHrZones] = useState(staticHrZones);
  const [dataSource, setDataSource] = useState("static");
  const [syncedAt, setSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenValue, setTokenValue] = useState("");

  // ═══ Dynamic current week from today's date ═══
  const currentWeek = useMemo(() => {
    const week1Start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const now = new Date();
    const diffDays = Math.floor((now - week1Start) / 86400000);
    return Math.max(1, Math.min(38, Math.floor(diffDays / 7) + 1));
  }, []);

  useEffect(() => {
    fetch("/api/activities")
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(data => {
        if (data && data.weeklyData && data.weeklyData.length > 0) {
          setWeeklyData(data.weeklyData);
          setDataSource(data.source || "api");
          setSyncedAt(data.syncedAt);
        }
        if (data && data.weeklyActuals) setWeeklyActuals(data.weeklyActuals);
        if (data && data.trainingPlan) setTrainingPlan(data.trainingPlan);
        if (data && data.hrZones) setHrZones(data.hrZones);
      })
      .catch((err) => { console.warn("Activities API fallback to static:", err.message); }); // Static fallback is already loaded
  }, []);

  const triggerSync = useCallback(async (token) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token || undefined }),
      });
      const result = await res.json();
      if (result.status === "success") {
        // Sync returned live data — use it directly
        if (result.weeklyData?.length > 0) {
          const { trainingPlan: plan } = await import("@/lib/data");
          const planMap = {};
          for (const p of plan) planMap[p.week] = p.total;
          const merged = result.weeklyData.map(w => ({ ...w, plan: planMap[w.week] || 0 }));
          setWeeklyData(merged);
          setWeeklyActuals(result.weeklyActuals || staticWeeklyActuals);
          setDataSource("whoop");
          setSyncedAt(result.syncedAt);
        }
        setSyncError(null);
        setShowTokenInput(false);
        setTokenValue("");
      } else if (result.status === "error") {
        setSyncError(result.message || "Sync failed — check WHOOP token");
      }
    } catch (e) {
      console.error("Sync failed:", e);
      setSyncError("Could not reach sync API");
    }
    setSyncing(false);
  }, []);

  const maxActualWeek = useMemo(() => weeklyData.length > 0 ? Math.max(...weeklyData.map(w => w.week)) : 0, [weeklyData]);
  const futureWeeks = useMemo(() => trainingPlan.filter(w => w.week > maxActualWeek).map(w => ({ week: w.week, plan: w.total })), [trainingPlan, maxActualWeek]);

  const stats = useMemo(() => {
    const completed = weeklyData;
    const totalRun = completed.reduce((s, w) => s + (w.run || 0), 0);
    const totalFB = completed.reduce((s, w) => s + (w.football || 0), 0);
    const totalSpin = completed.reduce((s, w) => s + (w.spin || 0), 0);
    const totalAll = totalRun + totalFB + totalSpin;
    const totalPlan = completed.reduce((s, w) => s + (w.plan || 0), 0);
    const longRuns = completed.map(w => w.longRun).filter(x => x > 0);
    const longestRun = Math.max(...longRuns, 0);
    // Find the most recent week with actual activity (skip zero-data weeks)
    const lastWeek = [...completed].reverse().find(w => (w.run || 0) + (w.football || 0) + (w.spin || 0) > 0) || completed[completed.length - 1];
    const lastWeekKm = lastWeek ? (lastWeek.run || 0) + (lastWeek.football || 0) + (lastWeek.spin || 0) : 0;

    // Dynamic weeks to race
    const raceDate = new Date(2026, 8, 28); // Sep 28 2026
    const now = new Date();
    const weeksToRace = Math.max(0, Math.ceil((raceDate - now) / (7 * 86400000)));

    const consistency = completed.filter(w => (w.run || 0) + (w.football || 0) + (w.spin || 0) > 5).length;

    const fmt = (m) => `${Math.floor(m/60)}:${String(Math.round(m%60)).padStart(2,"0")}`;
    const lastPace = lastWeek?.avgPace || null;

    // ═══ DYNAMIC MARATHON PROJECTION ═══
    // Parse pace strings ("7:31") into decimal minutes
    const parsePace = (p) => { if (!p) return null; const [m, s] = p.split(":").map(Number); return m + s / 60; };

    // Collect all weeks with valid pace data, sorted by week
    const paceWeeks = completed
      .filter(w => w.avgPace && (w.run || 0) > 3) // need meaningful run volume
      .map(w => ({ week: w.week, pace: parsePace(w.avgPace), longRun: w.longRun || 0, run: w.run || 0, z2: w.z2 || 0 }))
      .sort((a, b) => a.week - b.week);

    let projConservativeMin, projTargetMin, projOptimisticMin;
    let projMethod = "insufficient";
    let projPaceKm = null; // projected race pace per km
    let projTrend = null; // pace improvement per week (negative = getting faster)
    let adherencePct = totalPlan > 0 ? Math.round(totalAll / totalPlan * 100) : 0;

    if (paceWeeks.length >= 3) {
      projMethod = "dynamic";

      // 1. Weighted linear regression on pace (recent weeks count more)
      // Weight = week number (higher = more recent = more weight)
      const n = paceWeeks.length;
      let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;
      for (const pw of paceWeeks) {
        const weight = pw.week; // more recent = higher weight
        sumW += weight;
        sumWX += weight * pw.week;
        sumWY += weight * pw.pace;
        sumWXX += weight * pw.week * pw.week;
        sumWXY += weight * pw.week * pw.pace;
      }
      const denom = sumW * sumWXX - sumWX * sumWX;
      const slope = denom !== 0 ? (sumW * sumWXY - sumWX * sumWY) / denom : 0;
      const intercept = denom !== 0 ? (sumWY * sumWXX - sumWX * sumWXY) / denom : paceWeeks[n - 1].pace;
      projTrend = slope; // negative = improving

      // Race week is ~38
      const raceWeek = 38;
      // Projected pace at race week (extrapolate trend, but cap improvement)
      const maxImprovement = 0.04; // max 4 sec/km improvement per week
      const cappedSlope = slope < -maxImprovement ? -maxImprovement : slope;
      const trendPace = intercept + cappedSlope * raceWeek;

      // 2. Current pace (weighted avg of last 4 weeks with data)
      const recentWeeks = paceWeeks.slice(-4);
      const recentPaceSum = recentWeeks.reduce((s, w) => s + w.pace * w.run, 0);
      const recentRunSum = recentWeeks.reduce((s, w) => s + w.run, 0);
      const currentPace = recentRunSum > 0 ? recentPaceSum / recentRunSum : paceWeeks[n - 1].pace;

      // 3. Riegel's formula: use longest run to estimate marathon capability
      // T_marathon = T_reference × (42.195 / D_reference)^1.06
      // If longest run is 13.5km at 7:49/km pace → reference time = 13.5 * 7.82 min
      const longestRunWeek = paceWeeks.reduce((best, w) => w.longRun > (best?.longRun || 0) ? w : best, null);
      let riegelPace = currentPace * 1.08; // fallback: add 8% for marathon distance
      if (longestRunWeek && longestRunWeek.longRun >= 8) {
        const refDist = longestRunWeek.longRun;
        const refPace = longestRunWeek.pace;
        const refTime = refDist * refPace;
        const marathonTime = refTime * Math.pow(42.195 / refDist, 1.06);
        riegelPace = marathonTime / 42.195;
      }

      // 4. Adherence adjustment: if training compliance is high, trust optimistic end more
      const adherenceFactor = Math.min(1, adherencePct / 100); // 0 to 1

      // 5. Build three scenarios
      // Conservative: current easy pace + distance fatigue factor (no further improvement assumed)
      // Easy runs are typically 60-90s slower than marathon pace, but we use Riegel as floor
      const conservativePace = Math.max(riegelPace, currentPace * 1.05);

      // Target: trend extrapolation + Riegel blend, weighted by adherence
      // More adherence → trust the trend more; less → stay closer to conservative
      const trendWeight = 0.3 + 0.3 * adherenceFactor; // 0.3 to 0.6
      const targetPace = trendPace * trendWeight + riegelPace * (1 - trendWeight);

      // Optimistic: if trend holds AND training ramps up well
      // Assume pace improves at current trend, longest run reaches 30+ km
      const optimisticPace = Math.min(targetPace * 0.96, trendPace * 0.98);

      // Sanity bounds: no slower than 9:00/km, no faster than 5:00/km
      const clamp = (p) => Math.max(5, Math.min(9, p));

      projConservativeMin = clamp(conservativePace) * 42.195;
      projTargetMin = clamp(targetPace) * 42.195;
      projOptimisticMin = clamp(optimisticPace) * 42.195;
      projPaceKm = clamp(targetPace);

      // Ensure ordering: optimistic < target < conservative
      if (projOptimisticMin > projTargetMin) projOptimisticMin = projTargetMin * 0.97;
      if (projTargetMin > projConservativeMin) projTargetMin = projConservativeMin * 0.95;
    } else {
      // Not enough data — use reasonable defaults based on whatever we have
      const fallbackPace = paceWeeks.length > 0 ? parsePace(paceWeeks[paceWeeks.length - 1].pace) : 8.0;
      projConservativeMin = (fallbackPace * 1.10) * 42.195;
      projTargetMin = (fallbackPace * 1.02) * 42.195;
      projOptimisticMin = (fallbackPace * 0.95) * 42.195;
    }

    // Format pace per km for display
    const fmtPace = (p) => { const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${String(s).padStart(2, "0")}`; };
    const projTargetPace = projPaceKm ? fmtPace(projPaceKm) : null;
    const projConservativePace = fmtPace(projConservativeMin / 42.195);
    const projOptimisticPace = fmtPace(projOptimisticMin / 42.195);

    return {
      totalRun, totalFB, totalSpin, totalAll, totalPlan, longestRun, lastWeekKm, lastWeekPlan: lastWeek?.plan || 0, lastPace, weeksToRace, consistency,
      projConservative: fmt(projConservativeMin),
      projTarget: fmt(projTargetMin),
      projOptimistic: fmt(projOptimisticMin),
      projConservativePace, projTargetPace, projOptimisticPace,
      projMethod, projTrend, adherencePct,
      completed: completed.length,
    };
  }, [weeklyData]);

  const chartData = useMemo(() => {
    // Combine actual weeks + future plan-only weeks for the plan line
    const actualWeeks = weeklyData.map(w => ({
      ...w,
      actual: (w.run || 0) + (w.football || 0) + (w.spin || 0),
    }));
    const maxWeek = actualWeeks.length > 0 ? Math.max(...actualWeeks.map(w => w.week)) : 0;
    const futurePlanWeeks = trainingPlan
      .filter(w => w.week > maxWeek)
      .map(w => ({ week: w.week, dates: w.dates, run: 0, football: 0, spin: 0, plan: w.total, longRun: 0, avgHR: 0, z2: 0, avgPace: null, actual: 0 }));
    return [...actualWeeks, ...futurePlanWeeks];
  }, [weeklyData, trainingPlan]);

  // Pace progression — convert "7:41" strings to decimal minutes for charting
  const paceData = useMemo(() => {
    const toMin = (s) => { if (!s) return null; const parts = s.split(":").map(Number); if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null; return parts[0] + parts[1] / 60; };
    return weeklyData
      .filter(w => w.avgPace)
      .map(w => ({
        week: w.week,
        dates: w.dates,
        pace: toMin(w.avgPace),
        paceLabel: w.avgPace,
      }));
  }, [weeklyData]);

  const longRunProjection = useMemo(() => {
    // Extract planned long run km from training plan Sunday sessions
    const planMap = {};
    for (const wp of trainingPlan) {
      // Use detail.sun.km if available, else parse Sunday session string
      if (wp.detail?.sun?.km) {
        planMap[wp.week] = wp.detail.sun.km;
      } else if (wp.sun && wp.sun !== "Rest") {
        const m = wp.sun.match(/^(\d+\.?\d*)/);
        if (m) planMap[wp.week] = parseFloat(m[1]);
      }
    }
    // Build actual long run map from weekly data
    const actualMap = {};
    for (const w of weeklyData) {
      if (w.longRun && w.longRun > 0) actualMap[w.week] = w.longRun;
    }
    // Combine into dataset for all 38 weeks
    const data = [];
    for (let wk = 1; wk <= 38; wk++) {
      const plan = planMap[wk] || null;
      const actual = actualMap[wk] || null;
      if (plan || actual) {
        data.push({ week: wk, plan, actual });
      }
    }
    return data;
  }, [weeklyData, trainingPlan]);

  // Zone 2 trend — include ALL weeks with data (not just z2 > 0)
  const z2TrendData = useMemo(() => {
    return weeklyData.filter(w => w.avgHR > 0).map(w => ({
      week: w.week,
      dates: w.dates,
      z2: w.z2,
      z2pct: Math.round(w.z2 * 100),
    }));
  }, [weeklyData]);

  // ═══ NEXT TRAINING — find the next non-rest session from today ═══
  const nextTraining = useMemo(() => {
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun

    // Week 15 starts Mon Apr 13. Compute week offset from there.
    const week15Start = new Date(2026, 3, 13); // Apr 13
    const daysSinceW15 = Math.floor((now - week15Start) / 86400000);
    const weekOffset = Math.floor(daysSinceW15 / 7);
    const currentWeekNum = 15 + weekOffset;

    // Scan from today forward across this week and next
    for (let offset = 0; offset < 14; offset++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + offset);
      const dow = checkDate.getDay();
      const dayKey = dayKeys[dow];
      const dayName = dayNames[dow];

      const daysFromW15Start = Math.floor((checkDate - week15Start) / 86400000);
      const wk = 15 + Math.floor(daysFromW15Start / 7);
      const weekPlan = trainingPlan.find(w => w.week === wk);
      if (!weekPlan) continue;

      const session = weekPlan[dayKey];
      if (!session || session === "Rest" || session.includes("✈️")) continue;

      const detail = weekPlan.detail?.[dayKey] || null;

      // Relative label
      let when;
      if (offset === 0) when = "Today";
      else if (offset === 1) when = "Tomorrow";
      else when = dayName;

      // Format the date
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const dateStr = `${checkDate.getDate()} ${months[checkDate.getMonth()]}`;

      return { when, dateStr, dayName, session, detail, week: wk, weekNotes: weekPlan.notes };
    }
    return null;
  }, [trainingPlan]);

  const filteredPlan = useMemo(() => {
    if (planView === "upcoming") return trainingPlan.filter(w => w.week >= currentWeek - 1 && w.week <= currentWeek + 5);
    if (planView === "past") return trainingPlan.filter(w => w.week <= currentWeek);
    return trainingPlan;
  }, [planView, currentWeek, trainingPlan]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "plan", label: "Training Plan" },
    { id: "weekly", label: "Weekly Detail" },
    { id: "longrun", label: "Long Run" },
    { id: "hr", label: "Heart Rate" },
  ];

  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Berlin Marathon 2026</h1>
            <p className="text-slate-400 text-sm mt-1">28 September 2026 · {stats.weeksToRace} weeks to go</p>
          </div>
          <div className="sm:text-right">
            <div className="text-sm text-slate-400 mb-1">Projected finish</div>
            <div className="flex items-baseline gap-3">
              <div className="text-sm text-slate-500">{stats.projOptimistic}</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{stats.projTarget}</div>
              <div className="text-sm text-slate-500">{stats.projConservative}</div>
            </div>
            <div className="text-slate-500 text-xs mt-0.5">optimistic · target · conservative</div>
          </div>
        </div>
        {/* Sync status bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dataSource.startsWith("whoop") ? "bg-emerald-400" : "bg-amber-400"}`}></div>
            <span className="text-xs text-slate-400">
              {dataSource.startsWith("whoop")
                ? `WHOOP synced ${syncedAt ? new Date(syncedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}`
                : "Static data — sync WHOOP to go live"}
            </span>
          </div>
          <button
            onClick={() => setShowTokenInput(!showTokenInput)}
            disabled={syncing}
            className="text-xs px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync WHOOP"}
          </button>
        </div>
        {showTokenInput && (
          <div className="mt-2 px-3 py-3 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">
              Paste your WHOOP access token, or use the <a href="/sync" className="text-blue-400 underline">one-click sync page</a> for easier syncing.
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="flex-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-600 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => triggerSync(tokenValue)}
                disabled={syncing || !tokenValue.trim()}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {syncing ? "Syncing..." : "Sync"}
              </button>
            </div>
          </div>
        )}
        {syncError && (
          <div className="mt-2 px-3 py-2 bg-red-900/40 border border-red-700/50 rounded-lg text-xs text-red-300">
            {syncError}
          </div>
        )}
      </div>

      {/* ═══ NEXT TRAINING — hero card ═══ */}
      {nextTraining && (
        <div className="px-4 sm:px-8 -mt-3 mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-6 shadow-lg text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <span className="text-xs sm:text-sm font-medium text-blue-200 uppercase tracking-wider">Next Training</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{nextTraining.when}</span>
                  <span className="text-blue-200 text-xs sm:text-sm">{nextTraining.dateStr}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">{nextTraining.session}</div>
                {nextTraining.weekNotes && (
                  <div className="text-blue-200 text-sm">Week {nextTraining.week} · {nextTraining.weekNotes}</div>
                )}
              </div>

              {/* Detail cards */}
              {nextTraining.detail && (
                <div className="flex gap-4 sm:gap-4 sm:ml-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/20">
                  {nextTraining.detail.km > 0 && (
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-bold">{nextTraining.detail.km}</div>
                      <div className="text-blue-200 text-xs">km</div>
                    </div>
                  )}
                  <div className="w-px bg-white/20"></div>
                  {nextTraining.detail.hr && (
                    <div className="text-center min-w-0">
                      <div className="text-base sm:text-lg font-bold flex items-center gap-1 whitespace-nowrap">
                        <span className="text-red-300">♥</span> {nextTraining.detail.hr}
                      </div>
                      <div className="text-blue-200 text-xs">HR zone</div>
                    </div>
                  )}
                  <div className="w-px bg-white/20"></div>
                  {nextTraining.detail.pace && (
                    <div className="text-center min-w-0">
                      <div className="text-base sm:text-lg font-bold flex items-center gap-1 whitespace-nowrap">
                        <span className="text-yellow-300">⏱</span> {nextTraining.detail.pace}
                      </div>
                      <div className="text-blue-200 text-xs">pace target</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Session type badge */}
            {nextTraining.detail?.type && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  nextTraining.detail.type === "easy" || nextTraining.detail.type === "easy/long" ? "bg-green-400/30 text-green-100" :
                  nextTraining.detail.type === "long" || nextTraining.detail.type === "long easy" ? "bg-blue-400/30 text-blue-100" :
                  nextTraining.detail.type === "tempo" ? "bg-orange-400/30 text-orange-100" :
                  nextTraining.detail.type === "intervals" || nextTraining.detail.type === "MP intervals" ? "bg-red-400/30 text-red-100" :
                  nextTraining.detail.type === "football" ? "bg-orange-400/30 text-orange-100" :
                  nextTraining.detail.type === "RACE" ? "bg-yellow-400/30 text-yellow-100" :
                  "bg-white/20 text-white"
                }`}>{nextTraining.detail.type.toUpperCase()}</span>
                {nextTraining.detail.type === "easy" && <span className="text-blue-200 text-xs">Keep it conversational. If you can't talk, slow down.</span>}
                {nextTraining.detail.type === "tempo" && <span className="text-blue-200 text-xs">Comfortably hard. You can speak in short sentences.</span>}
                {(nextTraining.detail.type === "intervals" || nextTraining.detail.type === "MP intervals") && <span className="text-blue-200 text-xs">Hard in reps, easy in recovery. Full rest between sets.</span>}
                {(nextTraining.detail.type === "long" || nextTraining.detail.type === "long easy" || nextTraining.detail.type === "easy/long") && <span className="text-blue-200 text-xs">Start easy, stay patient. Negative split the last third.</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <KPI label="Total Volume" value={`${stats.totalAll.toFixed(0)} km`} sub={`🏃${stats.totalRun.toFixed(0)} ⚽${stats.totalFB.toFixed(0)} 🚴${stats.totalSpin.toFixed(0)}`} />
          <KPI label="Last Week" value={`${stats.lastWeekKm.toFixed(1)} km`} sub={`Plan: ${stats.lastWeekPlan} km`} color={stats.lastWeekKm >= stats.lastWeekPlan * 0.8 ? "text-emerald-600" : "text-amber-600"} />
          <KPI label="Longest Run" value={`${stats.longestRun.toFixed(1)} km`} sub="Target: 32 km by Week 31" color={stats.longestRun >= 20 ? "text-emerald-600" : "text-amber-600"} />
          <KPI label="Consistency" value={`${stats.completed > 0 ? Math.round(stats.consistency / stats.completed * 100) : 0}%`} sub={`${stats.consistency}/${stats.completed} weeks > 5km`} color={stats.completed > 0 && stats.consistency / stats.completed >= 0.8 ? "text-emerald-600" : "text-amber-600"} />
          <KPI label="Last Pace" value={stats.lastPace || "—"} sub="min/km · target race: 6:45" color="text-purple-600" />
          <KPI label="Plan Adherence" value={`${stats.totalPlan > 0 ? Math.round(stats.totalAll / stats.totalPlan * 100) : 0}%`} sub={`${stats.totalAll.toFixed(0)} / ${stats.totalPlan} km`} color={stats.totalPlan > 0 && stats.totalAll / stats.totalPlan >= 0.7 ? "text-emerald-600" : "text-red-600"} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-8 mt-6 overflow-x-auto -mx-4 sm:mx-0">
        <div className="flex gap-1 bg-slate-200 rounded-lg p-1 w-max sm:w-fit mx-4 sm:mx-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition whitespace-nowrap ${activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 mt-4 pb-8">

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Weekly Volume vs Plan</h3>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val, name) => [val ? `${Number(val).toFixed(1)} km` : "—", name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="run" stackId="a" fill="#2196F3" name="Running" />
                  <Bar dataKey="football" stackId="a" fill="#FF6D00" name="Football" />
                  <Bar dataKey="spin" stackId="a" fill="#66BB6A" name="Cycling" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="plan" stroke="#E53935" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Plan" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pace Progression */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Pace Progression</h3>
                <p className="text-xs text-slate-400 mb-4">Avg run pace per week (lower = faster). Race target: 6:45/km.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={paceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[6, 9]} reversed tickFormatter={v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`} />
                    <Tooltip formatter={(val) => [`${Math.floor(val)}:${String(Math.round((val % 1) * 60)).padStart(2, "0")} /km`]} />
                    <Area type="monotone" dataKey="pace" fill="#F3E5F5" stroke="#7B1FA2" strokeWidth={2.5} dot={{ r: 4, fill: "#7B1FA2" }} name="Avg Pace" />
                    {/* Race target line at 6:45 = 6.75 */}
                    <Line type="monotone" dataKey={() => 6.75} stroke="#AB47BC" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Race Target 6:45" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Long Run Trajectory */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Long Run Trajectory</h3>
                <p className="text-xs text-slate-400 mb-4">Building to 32 km by Week 31.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={longRunProjection}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 36]} />
                    <Tooltip formatter={(val) => val ? [`${Number(val).toFixed(1)} km`] : "—"} />
                    <Line type="monotone" dataKey="actual" stroke="#1565C0" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" connectNulls={false} />
                    <Line type="monotone" dataKey="plan" stroke="#90CAF9" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Plan" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Zone 2 Trend */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Zone 2 % Trend</h3>
                <p className="text-xs text-slate-400 mb-4">Target: 70%+ of run time in Z2.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={z2TrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <Tooltip formatter={(val) => [`${val}%`, "Z2 %"]} />
                    <Area type="monotone" dataKey="z2pct" fill="#E8F5E9" stroke="#43A047" strokeWidth={2.5} dot={{ r: 4, fill: "#43A047" }} name="Z2 %" />
                    <Line type="monotone" dataKey={() => 70} stroke="#66BB6A" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Target 70%" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Projection callout */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">
                Marathon Projection
                {stats.projMethod === "dynamic" && <span className="ml-2 text-xs font-normal text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Live</span>}
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.projOptimistic}</div>
                  <div className="text-xs text-blue-400">Optimistic</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projOptimisticPace}/km</div>
                </div>
                <div className="text-center border-x border-blue-200 px-4">
                  <div className="text-2xl font-bold text-blue-800">{stats.projTarget}</div>
                  <div className="text-xs text-blue-600 font-medium">Target</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projTargetPace || "—"}/km</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.projConservative}</div>
                  <div className="text-xs text-blue-400">Conservative</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projConservativePace}/km</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                {stats.projMethod === "dynamic" ? (
                  <>
                    <div>
                      Based on {stats.completed} weeks of data · Longest run: {stats.longestRun.toFixed(1)} km · Plan adherence: {stats.adherencePct}%
                      {stats.projTrend !== null && (
                        <span className={stats.projTrend < 0 ? " text-emerald-600" : " text-amber-600"}>
                          {" "}· Pace trend: {stats.projTrend < 0 ? "improving" : "slowing"} ~{Math.abs(stats.projTrend * 60).toFixed(0)}s/km per week
                        </span>
                      )}
                    </div>
                    <div className={stats.adherencePct >= 80 ? "text-emerald-700" : stats.adherencePct >= 60 ? "text-amber-700" : "text-red-700"}>
                      {stats.adherencePct >= 80
                        ? "Strong compliance — projections are reliable. Keep building toward peak weeks."
                        : stats.adherencePct >= 60
                        ? "Moderate compliance — target is achievable if consistency improves over the next training blocks."
                        : `Low compliance (${stats.adherencePct}%) — projections carry more uncertainty. Focus on building consistent weekly volume.`}
                    </div>
                  </>
                ) : (
                  <div className="text-amber-700">Not enough run data yet for dynamic projection. Keep logging runs — projections activate after 3+ weeks of data.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TRAINING PLAN ═══ */}
        {activeTab === "plan" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Training Plan — Week by Week</h3>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                {[["upcoming", "Next 6 Weeks"], ["past", "Completed"], ["all", "All 38"]].map(([id, label]) => (
                  <button key={id} onClick={() => setPlanView(id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${planView === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Plan table — takes 3 cols */}
              <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-3 text-left font-medium text-slate-500 w-12">Wk</th>
                      <th className="px-3 py-3 text-left font-medium text-slate-500 w-28">Dates</th>
                      <th className="px-3 py-3 text-center font-medium text-slate-500 w-14">km</th>
                      {dayLabels.map(d => (
                        <th key={d} className="px-2 py-3 text-center font-medium text-slate-500 w-28">{d}</th>
                      ))}
                      <th className="px-3 py-3 text-left font-medium text-slate-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlan.map(w => {
                      const isPastWeek = w.week < currentWeek;
                      const isCurrent = w.week === currentWeek;
                      const isFutureWeek = w.week > currentWeek;
                      const actuals = weeklyActuals[w.week] || {};
                      const weekData = weeklyData.find(wd => wd.week === w.week);
                      const actualTotal = weekData ? (weekData.run || 0) + (weekData.football || 0) + (weekData.spin || 0) : null;
                      const pct = (isPastWeek || isCurrent) && weekData && w.total > 0 ? Math.round((actualTotal || 0) / w.total * 100) : null;
                      const isExpanded = expandedWeek === w.week;
                      const detail = w.detail || {};

                      // For current week: compute which day-of-week today is
                      // days array = ["mon","tue","wed","thu","fri","sat","sun"]
                      // JS getDay(): 0=Sun,1=Mon..6=Sat → remap to our index
                      const todayDayIdx = isCurrent ? ((new Date().getDay() + 6) % 7) : -1;

                      return (
                        <React.Fragment key={w.week}>
                          <tr
                            className={`border-b border-slate-50 cursor-pointer ${isCurrent ? "bg-blue-50" : isPastWeek ? "bg-white" : w.notes?.includes("EASE") ? "bg-amber-50/30" : w.notes?.includes("TAPER") ? "bg-green-50/30" : w.notes?.includes("PEAK") ? "bg-red-50/30" : "bg-white"} hover:bg-slate-50`}
                            onClick={() => setExpandedWeek(isExpanded ? null : w.week)}>
                            <td className={`px-3 py-2 font-bold ${isCurrent ? "text-blue-700" : "text-slate-700"}`}>
                              {w.week}
                              {isCurrent && <span className="ml-1 text-xs text-blue-500">←</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{w.dates}</td>
                            <td className="px-3 py-2 text-center">
                              {(isPastWeek || isCurrent) && actualTotal !== null ? (
                                <div>
                                  <div className={`font-bold ${pct >= 85 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                    {actualTotal.toFixed(0)}
                                  </div>
                                  <div className="text-slate-400 text-xs line-through">{w.total}</div>
                                </div>
                              ) : (
                                <div className="font-bold text-slate-700">{w.total}</div>
                              )}
                            </td>
                            {days.map((d, dayIdx) => {
                              // Per-day past/future: past weeks are all past, future weeks all future
                              // Current week: days up to today are past, days after today are future
                              let dayIsPast, dayIsFuture;
                              if (isPastWeek) {
                                dayIsPast = true; dayIsFuture = false;
                              } else if (isFutureWeek) {
                                dayIsPast = false; dayIsFuture = true;
                              } else {
                                // Current week — compare day index
                                dayIsPast = dayIdx <= todayDayIdx;
                                dayIsFuture = dayIdx > todayDayIdx;
                              }
                              return (
                                <td key={d} className="px-2 py-2 text-center">
                                  <DayCell
                                    planned={w[d]}
                                    actual={actuals[d]}
                                    isPast={dayIsPast}
                                    isFuture={dayIsFuture}
                                    detail={dayIsFuture ? detail[d] : null}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {w.notes && <span className="text-xs text-slate-500">{w.notes}</span>}
                                {(isPastWeek || isCurrent) && pct !== null && <StatusBadge pct={pct} />}
                                {w.detail && <span className="text-xs text-blue-400">{isExpanded ? "▼" : "▶"}</span>}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded detail row showing HR/pace guidance */}
                          {isExpanded && w.detail && (
                            <tr className="bg-slate-50">
                              <td colSpan={11} className="px-6 py-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {Object.entries(w.detail).map(([day, d]) => (
                                    <div key={day} className="bg-white rounded-lg p-3 border border-slate-200">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-sm text-slate-700 capitalize">{day}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          d.type === "easy" ? "bg-green-100 text-green-700" :
                                          d.type === "long" || d.type === "long easy" ? "bg-blue-100 text-blue-700" :
                                          d.type === "tempo" ? "bg-orange-100 text-orange-700" :
                                          d.type === "intervals" || d.type === "MP intervals" ? "bg-red-100 text-red-700" :
                                          d.type === "quality" || d.type === "MP continuous" ? "bg-purple-100 text-purple-700" :
                                          d.type === "shakeout" || d.type === "recovery" ? "bg-gray-100 text-gray-600" :
                                          d.type === "football" ? "bg-orange-100 text-orange-700" :
                                          d.type === "RACE" ? "bg-yellow-100 text-yellow-800 font-bold" :
                                          "bg-slate-100 text-slate-600"
                                        }`}>{d.type}</span>
                                      </div>
                                      {d.km > 0 && <div className="text-lg font-bold text-slate-800">{d.km} km</div>}
                                      {d.hr && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <span className="text-xs text-red-400">♥</span>
                                          <span className="text-xs text-slate-600">{d.hr}</span>
                                        </div>
                                      )}
                                      {d.pace && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className="text-xs text-blue-400">⏱</span>
                                          <span className="text-xs text-slate-600">{d.pace}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* HR Zone reference card — 1 col */}
              <div className="lg:col-span-1">
                <ZoneCard />
                <div className="mt-4 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Pace Guide</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-green-600 font-medium">Easy / Long Run</span><span className="text-slate-600">7:30-8:00 /km</span></div>
                    <div className="flex justify-between"><span className="text-green-600 font-medium">Recovery</span><span className="text-slate-600">8:00+ /km</span></div>
                    <div className="flex justify-between"><span className="text-orange-600 font-medium">Tempo / MP</span><span className="text-slate-600">6:20-6:45 /km</span></div>
                    <div className="flex justify-between"><span className="text-red-600 font-medium">Intervals</span><span className="text-slate-600">5:30-6:10 /km</span></div>
                    <div className="flex justify-between"><span className="text-purple-600 font-medium">Race Day Goal</span><span className="text-slate-600">~6:45 /km</span></div>
                  </div>
                  <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-700">
                    Click any future week row to see per-session HR and pace targets
                  </div>
                </div>
              </div>
            </div>

            {/* Plan legend */}
            <div className="flex items-center gap-6 text-xs text-slate-400 px-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></div> Planned
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></div> Completed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></div> Ease Week
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div> Peak
              </div>
              <div>🏃 Run · ⚽ Football · 🚴 Cycling · MP = Marathon Pace</div>
            </div>
          </div>
        )}

        {/* ═══ WEEKLY DETAIL ═══ */}
        {activeTab === "weekly" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Week</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Dates</th>
                  <th className="px-4 py-3 text-right font-medium text-blue-500">🏃 Run</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-500">⚽ Football</th>
                  <th className="px-4 py-3 text-right font-medium text-green-500">🚴 Cycling</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Plan</th>
                  <th className="px-4 py-3 text-right font-medium text-indigo-500">Long Run</th>
                  <th className="px-4 py-3 text-right font-medium text-purple-500">Avg Pace</th>
                  <th className="px-4 py-3 text-right font-medium text-pink-500">Avg HR</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-500">Z2 %</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map(w => {
                  const total = (w.run || 0) + (w.football || 0) + (w.spin || 0);
                  const pct = w.plan > 0 ? Math.round(total / w.plan * 100) : 0;
                  return (
                    <tr key={w.week} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{w.week}</td>
                      <td className="px-4 py-3 text-slate-500">{w.dates}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-medium">{w.run > 0 ? w.run.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-medium">{w.football > 0 ? w.football.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{w.spin > 0 ? w.spin.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{total.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{w.plan}</td>
                      <td className="px-4 py-3 text-right text-indigo-600">{w.longRun > 0 ? w.longRun.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-medium">{w.avgPace || "—"}</td>
                      <td className="px-4 py-3 text-right text-pink-600">{w.avgHR > 0 ? w.avgHR : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {w.z2 > 0 ? (
                          <span className={`font-medium ${w.z2 >= 0.7 ? "text-emerald-600" : w.z2 >= 0.4 ? "text-amber-600" : "text-red-500"}`}>
                            {Math.round(w.z2 * 100)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ LONG RUN ═══ */}
        {activeTab === "longrun" && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Long Run Progression — Plan vs Actual</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={longRunProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: "Week", position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 45]} unit=" km" />
                <Tooltip formatter={(val, name) => [`${val} km`, name]} />
                <Legend />
                <Bar dataKey="actual" fill="#1565C0" name="Actual Long Run" radius={[3, 3, 0, 0]} barSize={14} />
                <Line type="monotone" dataKey="plan" stroke="#90CAF9" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 3, fill: "#90CAF9" }} name="Plan" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ═══ HEART RATE ═══ */}
        {activeTab === "hr" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Avg HR chart — 2 cols */}
              <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Average Heart Rate (Runs)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData.filter(d => d.avgHR > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[120, 160]} />
                    <Tooltip formatter={(val) => [`${val} bpm`]} />
                    {/* Z2 band (WHOOP: 127-146 bpm) */}
                    <Area type="monotone" dataKey={() => 146} fill="#E8F5E9" stroke="none" name="Z2 ceiling" />
                    <Area type="monotone" dataKey={() => 127} fill="#ffffff" stroke="none" />
                    <Line type="monotone" dataKey="avgHR" stroke="#E91E63" strokeWidth={2.5} dot={{ r: 4 }} name="Avg HR" />
                    <Line type="monotone" dataKey={() => 146} stroke="#66BB6A" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z2 ceiling (146)" />
                    <Line type="monotone" dataKey={() => 127} stroke="#90CAF9" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z2 floor (127)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Zone card — 1 col */}
              <ZoneCard />
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Zone 2 % Trend</h3>
              <p className="text-xs text-slate-400 mb-4">Percentage of run time in WHOOP Z2 (HR 127-146). Target: 70%+ for marathon base building.</p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={z2TrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip formatter={(val) => [`${val}%`, "Z2 %"]} />
                  {/* Target band */}
                  <Area type="monotone" dataKey={() => 100} fill="#E8F5E9" stroke="none" />
                  <Area type="monotone" dataKey={() => 70} fill="#ffffff" stroke="none" />
                  <Line type="monotone" dataKey="z2pct" stroke="#43A047" strokeWidth={2.5} dot={{ r: 5, fill: "#43A047" }} name="Z2 %" connectNulls />
                  <Line type="monotone" dataKey={() => 70} stroke="#66BB6A" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target 70%" />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-3 text-xs text-slate-500">
                Weeks 8 (73%), 12 (68%), 13 (69%), 14 (93%) show your best Z2 discipline. Weeks 3 (16%), 9 (29%), 11 (22%) had too much time in Z3+. Keep targeting 70%+ for all easy runs.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
