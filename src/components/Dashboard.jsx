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

const DayCell = ({ planned, actual, isFuture, detail }) => {
  // Always prioritize actuals — if an activity was recorded, show it regardless of past/future
  if (actual) {
    return (
      <div className="text-xs py-1 px-1 rounded bg-emerald-50 text-emerald-700 font-medium whitespace-pre-line">
        {actual}
      </div>
    );
  }
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
  const [planSource, setPlanSource] = useState("default");
  const [planUpdatedAt, setPlanUpdatedAt] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [undoState, setUndoState] = useState(null); // { plan, timeout } for undo toast
  const [selectedSession, setSelectedSession] = useState(null); // { weekNum, day } — tap-to-swap on mobile

  // ═══ REPLAN STATE ═══
  const [showReplan, setShowReplan] = useState(false);
  const [replanReason, setReplanReason] = useState("");
  const [replanCustom, setReplanCustom] = useState("");
  const [replanning, setReplanning] = useState(false);
  const [replanError, setReplanError] = useState(null);
  const [proposedPlan, setProposedPlan] = useState(null); // { plan, changedWeeks }
  const [showReplanDiff, setShowReplanDiff] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ═══ Dynamic current week from today's date ═══
  const currentWeek = useMemo(() => {
    const week1Start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const now = new Date();
    const diffDays = Math.floor((now - week1Start) / 86400000);
    return Math.max(1, Math.min(38, Math.floor(diffDays / 7) + 1));
  }, []);

  useEffect(() => {
    // Load cached data first (fast)
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
        if (data && data.planSource) setPlanSource(data.planSource);
        if (data && data.planUpdatedAt) setPlanUpdatedAt(data.planUpdatedAt);
        if (data && data.hrZones) setHrZones(data.hrZones);

        // Auto-sync if data is stale (older than 6 hours)
        const lastSync = data?.syncedAt ? new Date(data.syncedAt) : null;
        const staleMs = 6 * 60 * 60 * 1000; // 6 hours
        if (!lastSync || (Date.now() - lastSync.getTime()) > staleMs) {
          console.log("[dashboard] Data stale, triggering background sync...");
          fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then(r => r.json())
            .then(result => {
              if (result.status === "success" && result.weeklyData?.length > 0) {
                const planMap = {};
                for (const p of (data?.trainingPlan || trainingPlan)) planMap[p.week] = p.total;
                const merged = result.weeklyData.map(w => ({ ...w, plan: planMap[w.week] || 0 }));
                setWeeklyData(merged);
                setWeeklyActuals(result.weeklyActuals || {});
                setDataSource("whoop");
                setSyncedAt(result.syncedAt);
                console.log(`[dashboard] Background sync complete: ${result.activitiesCount} activities`);
              }
            })
            .catch(err => console.warn("[dashboard] Background sync failed:", err.message));
        }
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

  // ═══ SAVE PLAN: persist edits to blob ═══
  const savePlan = useCallback(async (newPlan, reason = "manual edit") => {
    setTrainingPlan(newPlan); // optimistic update
    setPlanSource("custom");
    setPlanUpdatedAt(new Date().toISOString());
    try {
      const res = await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan, reason }),
      });
      const result = await res.json();
      if (result.status !== "success") {
        console.error("[plan] Save failed:", result.message);
      }
    } catch (e) {
      console.error("[plan] Save error:", e);
    }
  }, []);

  // ═══ SWAP SESSIONS: move a session to a different day within the same week ═══
  const swapSessions = useCallback((weekNum, fromDay, toDay) => {
    const oldPlan = [...trainingPlan];
    const newPlan = trainingPlan.map(w => {
      if (w.week !== weekNum) return w;
      const updated = { ...w };
      // Swap the day values
      const fromSession = updated[fromDay];
      const toSession = updated[toDay];
      updated[fromDay] = toSession || "Rest";
      updated[toDay] = fromSession || "Rest";
      // Swap detail entries too
      if (updated.detail) {
        const newDetail = { ...updated.detail };
        const fromDetail = newDetail[fromDay];
        const toDetail = newDetail[toDay];
        delete newDetail[fromDay];
        delete newDetail[toDay];
        if (fromDetail) newDetail[toDay] = fromDetail;
        if (toDetail) newDetail[fromDay] = toDetail;
        updated.detail = newDetail;
      }
      return updated;
    });

    // Show undo toast
    if (undoState?.timeout) clearTimeout(undoState.timeout);
    const timeout = setTimeout(() => setUndoState(null), 6000);
    setUndoState({ plan: oldPlan, timeout, fromDay, toDay, weekNum });

    savePlan(newPlan, `swap ${fromDay}↔${toDay} in week ${weekNum}`);
  }, [trainingPlan, savePlan, undoState]);

  const undoSwap = useCallback(() => {
    if (!undoState) return;
    clearTimeout(undoState.timeout);
    savePlan(undoState.plan, "undo swap");
    setUndoState(null);
  }, [undoState, savePlan]);

  // ═══ REPLAN: generate new plan via Claude API ═══
  const generateReplan = useCallback(async () => {
    const reasons = {
      "missed-1": "I missed about 1 week of training and need to get back on track.",
      "missed-2": "I missed 2 or more weeks of training (illness/travel/life). Need a conservative rebuild.",
      "injury": "I'm returning from a minor injury. I need a cautious ramp-up with reduced volume for 2-3 weeks.",
      "feeling-strong": "I'm feeling strong and ahead of schedule. I'd like to increase intensity slightly.",
      "race-date": "The race date changed or I want to adjust my peak timing.",
      "custom": replanCustom,
    };
    const reasonText = reasons[replanReason] || replanReason;
    if (!reasonText) return;

    setReplanning(true);
    setReplanError(null);
    try {
      const res = await fetch("/api/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonText,
          currentWeek,
          weeklyData,
          currentPlan: trainingPlan,
        }),
      });
      const result = await res.json();
      if (result.status === "success") {
        setProposedPlan({
          plan: result.proposedPlan,
          changedWeeks: result.changedWeeks,
          reason: result.reason,
        });
        setShowReplanDiff(true);
        setShowReplan(false);
      } else {
        setReplanError(result.message || "Failed to generate new plan");
      }
    } catch (e) {
      setReplanError("Could not reach replan API: " + e.message);
    }
    setReplanning(false);
  }, [replanReason, replanCustom, currentWeek, weeklyData, trainingPlan]);

  const acceptReplan = useCallback(() => {
    if (!proposedPlan) return;
    savePlan(proposedPlan.plan, `replan: ${proposedPlan.reason}`);
    setProposedPlan(null);
    setShowReplanDiff(false);
    setReplanReason("");
    setReplanCustom("");
  }, [proposedPlan, savePlan]);

  const rejectReplan = useCallback(() => {
    setProposedPlan(null);
    setShowReplanDiff(false);
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
    //
    // Gamification philosophy: Start conservative. Earn faster times.
    //
    // The projection is deliberately cautious — it rewards PROVEN training,
    // not assumed future compliance. Every good week of training nudges the
    // numbers down. This creates a motivating feedback loop: train well →
    // see your projection improve → train more.
    //
    // How it works:
    // 1. Start from a conservative baseline (current easy pace → marathon estimate)
    // 2. Apply EARNED credits: each completed week of training earns improvement
    //    proportional to its quality (volume, Z2 discipline, long run progression)
    // 3. Apply a modest FUTURE credit for remaining weeks — but heavily discounted
    //    until proven by actual training
    // 4. As more weeks complete with good data, the future discount shrinks and
    //    projections naturally improve

    const parsePace = (p) => { if (!p) return null; const [m, s] = p.split(":").map(Number); return m + s / 60; };

    const paceWeeks = completed
      .filter(w => w.avgPace && (w.run || 0) > 3)
      .map(w => ({ week: w.week, pace: parsePace(w.avgPace), longRun: w.longRun || 0, run: w.run || 0, z2: w.z2 || 0, plan: w.plan || 0 }))
      .sort((a, b) => a.week - b.week);

    let projConservativeMin, projTargetMin, projOptimisticMin;
    let projMethod = "insufficient";
    let projConservativePaceKm, projTargetPaceKm, projOptimisticPaceKm;
    let adherencePct = totalPlan > 0 ? Math.round(totalAll / totalPlan * 100) : 0;
    let projTrend = null; // "improving", "stable", or "declining"
    let projTrendDetail = null;
    let earnedMinutes = 0; // total earned improvement in minutes (for display)

    if (paceWeeks.length >= 3) {
      projMethod = "dynamic";

      // ── Step 1: Current fitness baseline ──
      const recentWeeks = paceWeeks.slice(-4);
      const recentPaceSum = recentWeeks.reduce((s, w) => s + w.pace * w.run, 0);
      const recentRunSum = recentWeeks.reduce((s, w) => s + w.run, 0);
      const currentEasyPace = recentRunSum > 0 ? recentPaceSum / recentRunSum : paceWeeks[paceWeeks.length - 1].pace;

      // Conservative baseline: easy pace - only 45s (not 60-75s) for marathon estimate
      // This keeps the starting point deliberately high — improvement is earned
      const baselineMarathonPace = currentEasyPace - 0.75; // conservative conversion

      // ── Step 2: EARNED improvement from completed training ──
      // Each completed week earns credit based on quality signals:
      // - Did they hit volume? (run km vs plan)
      // - Z2 discipline? (higher = better aerobic base)
      // - Long run progression? (key marathon predictor)
      // Max credit per week: ~4s/km (0.067 min/km)
      const maxCreditPerWeek = 0.067;

      let totalEarnedCredit = 0;
      for (const pw of paceWeeks) {
        let weekCredit = 0;
        // Volume score: what % of plan did they hit? (capped at 1.0)
        const volScore = pw.plan > 0 ? Math.min(1.0, pw.run / pw.plan) : 0.5;
        weekCredit += volScore * 0.4; // 40% weight on volume

        // Z2 score: higher z2% = better base building
        const z2Score = Math.min(1.0, pw.z2 / 0.7); // 70% z2 = perfect score
        weekCredit += z2Score * 0.3; // 30% weight on Z2

        // Long run score: did they do a meaningful long run?
        const longRunScore = Math.min(1.0, pw.longRun / 15); // 15km+ = full credit
        weekCredit += longRunScore * 0.3; // 30% weight on long run

        totalEarnedCredit += weekCredit * maxCreditPerWeek;
      }
      earnedMinutes = totalEarnedCredit * 42.195; // total earned in finish time

      // ── Step 3: FUTURE improvement (discounted) ──
      // Remaining weeks get improvement credit too, but heavily discounted.
      // The discount shrinks as proven training weeks accumulate.
      // Week 5 of 38: only 15% trust in future. Week 25 of 38: 55% trust.
      const currentWeekNum = Math.max(...paceWeeks.map(w => w.week));
      const weeksRemaining = Math.max(0, 38 - currentWeekNum);
      const trainingProgress = currentWeekNum / 38; // 0 to 1
      const futureTrust = 0.1 + trainingProgress * 0.5; // 10% early → 60% late

      // Future credit per week is modest: 2.5s/km base (0.042 min/km)
      const futureCreditPerWeek = 0.042;

      // ── Step 4: Three scenarios ──
      // Conservative: earned only + minimal future trust
      const conservativeFuture = weeksRemaining * futureCreditPerWeek * futureTrust * 0.5;
      const conservativePace = baselineMarathonPace - totalEarnedCredit - conservativeFuture + 0.12; // +7s fade

      // Target: earned + moderate future trust (assumes compliance improves to ~75%)
      const targetFuture = weeksRemaining * futureCreditPerWeek * futureTrust * 0.85;
      const targetPace = baselineMarathonPace - totalEarnedCredit - targetFuture;

      // Optimistic: earned + good future trust (assumes 90%+ compliance going forward)
      const optimisticFuture = weeksRemaining * futureCreditPerWeek * futureTrust * 1.2;
      const optimisticPace = baselineMarathonPace - totalEarnedCredit - optimisticFuture - 0.08; // bonus for taper effect

      // ── Step 5: Sanity bounds + ordering ──
      const clamp = (p) => Math.max(5.0, Math.min(8.5, p));
      projOptimisticPaceKm = clamp(optimisticPace);
      projTargetPaceKm = clamp(targetPace);
      projConservativePaceKm = clamp(conservativePace);

      // Enforce optimistic < target < conservative (faster → slower)
      if (projTargetPaceKm <= projOptimisticPaceKm) projTargetPaceKm = projOptimisticPaceKm + 0.08;
      if (projConservativePaceKm <= projTargetPaceKm) projConservativePaceKm = projTargetPaceKm + 0.12;

      projOptimisticMin = projOptimisticPaceKm * 42.195;
      projTargetMin = projTargetPaceKm * 42.195;
      projConservativeMin = projConservativePaceKm * 42.195;

      // ── Step 6: Week-over-week trend ──
      // Recompute target projection WITHOUT the latest week to get last week's number
      // Delta = previous target - current target (positive = improved)
      let projDeltaMin = 0; // minutes improved vs previous week (positive = faster)
      if (paceWeeks.length >= 4) {
        const prevWeeks = paceWeeks.slice(0, -1);
        const prevRecent = prevWeeks.slice(-4);
        const prevPaceSum = prevRecent.reduce((s, w) => s + w.pace * w.run, 0);
        const prevRunSum = prevRecent.reduce((s, w) => s + w.run, 0);
        const prevEasyPace = prevRunSum > 0 ? prevPaceSum / prevRunSum : prevWeeks[prevWeeks.length - 1].pace;
        const prevBaseline = prevEasyPace - 0.75;
        let prevEarned = 0;
        for (const pw of prevWeeks) {
          let wc = 0;
          wc += Math.min(1, pw.plan > 0 ? pw.run / pw.plan : 0.5) * 0.4;
          wc += Math.min(1, pw.z2 / 0.7) * 0.3;
          wc += Math.min(1, pw.longRun / 15) * 0.3;
          prevEarned += wc * maxCreditPerWeek;
        }
        const prevWeekNum = Math.max(...prevWeeks.map(w => w.week));
        const prevRemaining = Math.max(0, 38 - prevWeekNum);
        const prevProgress = prevWeekNum / 38;
        const prevFutureTrust = 0.1 + prevProgress * 0.5;
        const prevTargetFuture = prevRemaining * futureCreditPerWeek * prevFutureTrust * 0.85;
        const prevTargetPace = prevBaseline - prevEarned - prevTargetFuture;
        const prevTargetMin = Math.max(5.0, Math.min(8.5, prevTargetPace)) * 42.195;
        projDeltaMin = prevTargetMin - projTargetMin; // positive = got faster
      }

      if (projDeltaMin > 0.5) {
        projTrend = "improving";
        projTrendDetail = `${Math.round(projDeltaMin)} min faster than last week`;
      } else if (projDeltaMin < -0.5) {
        projTrend = "declining";
        projTrendDetail = `${Math.round(Math.abs(projDeltaMin))} min slower than last week`;
      } else {
        projTrend = "stable";
        projTrendDetail = "Holding steady vs last week";
      }

    } else {
      // Not enough data — start with a deliberately conservative anchor
      projConservativePaceKm = 7.25;  // ~5:06
      projTargetPaceKm = 6.83;       // ~4:48
      projOptimisticPaceKm = 6.42;   // ~4:31
      projOptimisticMin = projOptimisticPaceKm * 42.195;
      projTargetMin = projTargetPaceKm * 42.195;
      projConservativeMin = projConservativePaceKm * 42.195;
      projTrend = "building";
      projTrendDetail = "Keep logging runs — projections activate after 3 weeks of data";
    }

    const fmtPace = (p) => { const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${String(s).padStart(2, "0")}`; };

    return {
      totalRun, totalFB, totalSpin, totalAll, totalPlan, longestRun, lastWeekKm, lastWeekPlan: lastWeek?.plan || 0, lastPace, weeksToRace, consistency,
      projConservative: fmt(projConservativeMin),
      projTarget: fmt(projTargetMin),
      projOptimistic: fmt(projOptimisticMin),
      projConservativePace: fmtPace(projConservativePaceKm),
      projTargetPace: fmtPace(projTargetPaceKm),
      projOptimisticPace: fmtPace(projOptimisticPaceKm),
      projMethod, adherencePct, projTrend, projTrendDetail,
      projDeltaMin: typeof projDeltaMin !== 'undefined' ? projDeltaMin : 0,
      earnedMinutes: Math.round(earnedMinutes),
      currentEasyPace: paceWeeks.length >= 3 ? fmtPace((() => { const rw = paceWeeks.slice(-4); const s = rw.reduce((a, w) => a + w.pace * w.run, 0); const r = rw.reduce((a, w) => a + w.run, 0); return r > 0 ? s / r : 0; })()) : null,
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

    let completedToday = null; // track what was done today for the "done" badge

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

      // Check if this session was already completed (activity logged in weeklyActuals)
      const actuals = weeklyActuals[wk];
      if (actuals && actuals[dayKey]) {
        // This session is done — if it's today, remember it for the badge
        if (offset === 0) {
          const detail = weekPlan.detail?.[dayKey] || null;
          completedToday = { session, detail, actual: actuals[dayKey], week: wk };
        }
        continue; // skip to next day
      }

      const detail = weekPlan.detail?.[dayKey] || null;

      // Relative label
      let when;
      if (offset === 0) when = "Today";
      else if (offset === 1) when = "Tomorrow";
      else when = dayName;

      // Format the date
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const dateStr = `${checkDate.getDate()} ${months[checkDate.getMonth()]}`;

      return { when, dateStr, dayName, session, detail, week: wk, weekNotes: weekPlan.notes, completedToday };
    }
    return null;
  }, [trainingPlan, weeklyActuals]);

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
              <div className="flex items-center gap-2">
                <div className="text-2xl sm:text-3xl font-bold text-white">{stats.projTarget}</div>
                {stats.projMethod === "dynamic" && stats.projDeltaMin !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                    stats.projDeltaMin > 0
                      ? "text-emerald-300 bg-emerald-500/20"
                      : "text-red-300 bg-red-500/20"
                  }`}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      {stats.projDeltaMin > 0
                        ? <path d="M5 1L9 6H1L5 1Z" />
                        : <path d="M5 9L1 4H9L5 9Z" />
                      }
                    </svg>
                    {Math.round(Math.abs(stats.projDeltaMin))}m
                  </div>
                )}
              </div>
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

      {/* ═══ TODAY'S SESSION DONE + NEXT TRAINING ═══ */}
      {nextTraining?.completedToday && (
        <div className="px-4 sm:px-8 -mt-3 mb-2">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-3 sm:p-4 shadow-md text-white flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Today's session done</div>
              <div className="text-emerald-200 text-xs">{nextTraining.completedToday.session} · {nextTraining.completedToday.actual}</div>
            </div>
          </div>
        </div>
      )}

      {nextTraining && (
        <div className="px-4 sm:px-8 -mt-1 mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-6 shadow-lg text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <span className="text-xs sm:text-sm font-medium text-blue-200 uppercase tracking-wider">{nextTraining.completedToday ? "Up Next" : "Next Training"}</span>
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
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedSession(null); }}
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
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-blue-800">
                  Race Day Projection
                  {stats.projMethod === "dynamic" && <span className="ml-2 text-xs font-normal text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Live</span>}
                </h3>
                {stats.projMethod === "dynamic" && stats.projDeltaMin !== 0 && (
                  <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                    stats.projDeltaMin > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                      {stats.projDeltaMin > 0
                        ? <path d="M5 1L9 6H1L5 1Z" />
                        : <path d="M5 9L1 4H9L5 9Z" />
                      }
                    </svg>
                    {Math.round(Math.abs(stats.projDeltaMin))} min vs last week
                  </div>
                )}
                {stats.projMethod === "dynamic" && stats.projDeltaMin === 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                    → Holding steady
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">{stats.weeksToRace} weeks to race · {stats.projTrendDetail}</p>

              {/* Earned time banner */}
              {stats.projMethod === "dynamic" && stats.earnedMinutes > 0 && (
                <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <span className="text-emerald-600 text-sm">⚡</span>
                  <span className="text-xs text-emerald-800">
                    Training has earned you <strong>{stats.earnedMinutes} min</strong> off your projection so far. Every good week earns more.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{stats.projOptimistic}</div>
                  <div className="text-xs text-emerald-500 font-medium">Best Case</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projOptimisticPace}/km</div>
                  <div className="text-xs text-slate-400">Nail every week</div>
                </div>
                <div className="text-center border-x border-blue-200 px-4">
                  <div className="text-2xl font-bold text-blue-800">{stats.projTarget}</div>
                  <div className="text-xs text-blue-600 font-medium">Target</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projTargetPace}/km</div>
                  <div className="text-xs text-slate-400">Stay consistent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{stats.projConservative}</div>
                  <div className="text-xs text-amber-500">Floor</div>
                  <div className="text-xs text-slate-500 mt-1">~{stats.projConservativePace}/km</div>
                  <div className="text-xs text-slate-400">Minimal training</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                {stats.projMethod === "dynamic" ? (
                  <>
                    <div>
                      Easy pace: {stats.currentEasyPace}/km · Longest run: {stats.longestRun.toFixed(1)} km · Adherence: {stats.adherencePct}%
                    </div>
                    <div className={stats.adherencePct >= 80 ? "text-emerald-700" : stats.adherencePct >= 60 ? "text-blue-700" : "text-amber-700"}>
                      {stats.adherencePct >= 80
                        ? "You're earning time fast. These projections will keep tightening."
                        : stats.adherencePct >= 60
                        ? "Solid base. More consistent weeks will unlock faster projections."
                        : "Room to grow — each good week earns 2-4 minutes off your projection."}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">Keep logging runs — projections sharpen after 3 weeks of data.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TRAINING PLAN ═══ */}
        {activeTab === "plan" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-700">Training Plan — Week by Week</h3>
                <span className="text-xs text-slate-400 hidden sm:inline">Tap a future session to move it</span>
              </div>
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
                      // For current week: compare against planned km for days up to today only
                      // (not the full week target — that unfairly penalizes mid-week)
                      let pct = null;
                      if ((isPastWeek || isCurrent) && weekData && w.total > 0) {
                        if (isCurrent) {
                          // Sum planned km for Mon through today
                          const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
                          const daySlots = ["mon","tue","wed","thu","fri","sat","sun"];
                          let plannedSoFar = 0;
                          for (let di = 0; di <= todayIdx; di++) {
                            const sess = w[daySlots[di]];
                            if (sess && sess !== "Rest" && !sess.includes("✈️") && sess !== "Match" && sess !== "LAST MATCH") {
                              const m = sess.match(/^(\d+\.?\d*)/);
                              if (m) plannedSoFar += parseFloat(m[1]);
                            }
                          }
                          pct = plannedSoFar > 0 ? Math.round((actualTotal || 0) / plannedSoFar * 100) : 100;
                        } else {
                          pct = Math.round((actualTotal || 0) / w.total * 100);
                        }
                      }
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
                              // Per-day future: future weeks all future; current week — days after today are future
                              let dayIsFuture;
                              if (isPastWeek) {
                                dayIsFuture = false;
                              } else if (isFutureWeek) {
                                dayIsFuture = true;
                              } else {
                                dayIsFuture = dayIdx > todayDayIdx;
                              }

                              // Drag-to-reschedule: only future sessions are movable
                              const hasSession = w[d] && w[d] !== "Rest" && !w[d].includes("✈️");
                              const isDraggable = dayIsFuture && hasSession;
                              const isDropTarget = dayIsFuture;
                              const isSelected = selectedSession?.weekNum === w.week && selectedSession?.day === d;
                              const isSameWeekSelected = selectedSession?.weekNum === w.week && selectedSession?.day !== d && dayIsFuture;

                              return (
                                <td key={d}
                                  className={`px-2 py-2 text-center transition-all ${
                                    isSelected ? "ring-2 ring-blue-400 rounded-lg bg-blue-100/50" :
                                    isSameWeekSelected ? "ring-1 ring-dashed ring-blue-200 rounded-lg cursor-pointer" :
                                    ""
                                  }`}
                                  draggable={isDraggable}
                                  onDragStart={isDraggable ? (e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData("text/plain", JSON.stringify({ weekNum: w.week, day: d }));
                                    e.dataTransfer.effectAllowed = "move";
                                  } : undefined}
                                  onDragOver={isDropTarget ? (e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                  } : undefined}
                                  onDrop={isDropTarget ? (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const from = JSON.parse(e.dataTransfer.getData("text/plain"));
                                      if (from.weekNum === w.week && from.day !== d) {
                                        swapSessions(w.week, from.day, d);
                                      }
                                    } catch {}
                                  } : undefined}
                                  onClick={dayIsFuture ? (e) => {
                                    e.stopPropagation();
                                    if (selectedSession?.weekNum === w.week && selectedSession?.day !== d) {
                                      // Second tap — swap
                                      swapSessions(w.week, selectedSession.day, d);
                                      setSelectedSession(null);
                                    } else if (isDraggable) {
                                      // First tap — select
                                      setSelectedSession(isSelected ? null : { weekNum: w.week, day: d });
                                    } else {
                                      setSelectedSession(null);
                                    }
                                  } : undefined}
                                >
                                  <DayCell
                                    planned={w[d]}
                                    actual={actuals[d]}
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
                                {(w.detail || Object.keys(actuals).length > 0) && <span className="text-xs text-blue-400">{isExpanded ? "▼" : "▶"}</span>}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded detail row — actuals for past/current days, planned for future days */}
                          {isExpanded && (w.detail || Object.keys(actuals).length > 0) && (
                            <tr className="bg-slate-50">
                              <td colSpan={11} className="px-6 py-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {days.map((dayKey, dayIdx) => {
                                    const actualStr = actuals[dayKey];
                                    const plannedDetail = w.detail?.[dayKey];
                                    let isDayFuture;
                                    if (isPastWeek) isDayFuture = false;
                                    else if (isFutureWeek) isDayFuture = true;
                                    else isDayFuture = dayIdx > todayDayIdx;

                                    // Prioritize actual: show actual card if an activity was recorded
                                    if (actualStr) {
                                      return (
                                        <div key={dayKey} className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm text-emerald-800 capitalize">{dayKey}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">actual</span>
                                          </div>
                                          <div className="text-sm font-bold text-emerald-900 whitespace-pre-line">{actualStr}</div>
                                          {plannedDetail && (
                                            <div className="mt-1.5 pt-1.5 border-t border-emerald-100 text-xs text-slate-400">
                                              <span className="line-through">plan: {plannedDetail.km > 0 ? `${plannedDetail.km}km ` : ""}{plannedDetail.type}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    // No actual — show planned only for future days
                                    if (isDayFuture && plannedDetail) {
                                      return (
                                        <div key={dayKey} className="bg-white rounded-lg p-3 border border-slate-200">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm text-slate-700 capitalize">{dayKey}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                              plannedDetail.type === "easy" ? "bg-green-100 text-green-700" :
                                              plannedDetail.type === "long" || plannedDetail.type === "long easy" ? "bg-blue-100 text-blue-700" :
                                              plannedDetail.type === "tempo" ? "bg-orange-100 text-orange-700" :
                                              plannedDetail.type === "intervals" || plannedDetail.type === "MP intervals" ? "bg-red-100 text-red-700" :
                                              plannedDetail.type === "quality" || plannedDetail.type === "MP continuous" ? "bg-purple-100 text-purple-700" :
                                              plannedDetail.type === "shakeout" || plannedDetail.type === "recovery" ? "bg-gray-100 text-gray-600" :
                                              plannedDetail.type === "football" ? "bg-orange-100 text-orange-700" :
                                              plannedDetail.type === "RACE" ? "bg-yellow-100 text-yellow-800 font-bold" :
                                              "bg-slate-100 text-slate-600"
                                            }`}>{plannedDetail.type}</span>
                                          </div>
                                          {plannedDetail.km > 0 && <div className="text-lg font-bold text-slate-800">{plannedDetail.km} km</div>}
                                          {plannedDetail.hr && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <span className="text-xs text-red-400">♥</span>
                                              <span className="text-xs text-slate-600">{plannedDetail.hr}</span>
                                            </div>
                                          )}
                                          {plannedDetail.pace && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                              <span className="text-xs text-blue-400">⏱</span>
                                              <span className="text-xs text-slate-600">{plannedDetail.pace}</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    // Past day without actual → show a muted "no activity" card so the week is complete
                                    if (!isDayFuture && plannedDetail) {
                                      return (
                                        <div key={dayKey} className="bg-white rounded-lg p-3 border border-dashed border-slate-200 opacity-60">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm text-slate-400 capitalize">{dayKey}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">missed</span>
                                          </div>
                                          <div className="text-xs text-slate-400 line-through">
                                            {plannedDetail.km > 0 ? `${plannedDetail.km}km ` : ""}{plannedDetail.type}
                                          </div>
                                        </div>
                                      );
                                    }

                                    return null;
                                  })}
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
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 px-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#DBEAFE", border: "2px solid #93C5FD" }}></div> Planned
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#D1FAE5", border: "2px solid #6EE7B7" }}></div> Completed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#FEF3C7", border: "2px solid #FCD34D" }}></div> Ease Week
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#FEE2E2", border: "2px solid #FCA5A5" }}></div> Peak
              </div>
              <span className="text-slate-400">·</span>
              <div className="flex items-center gap-3">
                <span>🏃 Run</span>
                <span>⚽ Football</span>
                <span>🚴 Cycling</span>
                <span className="text-slate-400 font-medium">MP</span><span className="text-slate-400">= Marathon Pace</span>
              </div>
            </div>

            {/* ═══ PLAN ACTIONS ═══ */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-2">
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Plan adjustments</h4>
              <p className="text-xs text-slate-400 mb-4">
                {planSource === "custom"
                  ? `You're using a modified plan${planUpdatedAt ? ` · last updated ${new Date(planUpdatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
                  : "You're on the original training plan. Need to adjust after a break or change of schedule?"
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowReplan(true)}
                  className="flex-1 group border border-slate-200 rounded-xl px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">Replan from here</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    AI generates an adjusted plan from week {currentWeek} onward based on your reason (illness, missed weeks, etc.). You'll preview all changes before accepting.
                  </p>
                </button>
                {planSource === "custom" && (
                  <div className="sm:w-48 flex flex-col">
                    {!confirmReset ? (
                      <button
                        onClick={() => setConfirmReset(true)}
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-left hover:border-red-200 hover:bg-red-50/50 transition"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-sm font-medium text-slate-700">Reset plan</span>
                        </div>
                        <p className="text-xs text-slate-400">Go back to the original training plan</p>
                      </button>
                    ) : (
                      <div className="flex-1 border border-red-200 bg-red-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-red-700 font-medium mb-2">Discard all edits and revert to the original plan?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { savePlan(staticTrainingPlan, "reset to default"); setPlanSource("default"); setConfirmReset(false); }}
                            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition"
                          >
                            Yes, reset
                          </button>
                          <button
                            onClick={() => setConfirmReset(false)}
                            className="text-xs text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-white transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                  // Pro-rate current week's target to days elapsed
                  let pct = 0;
                  if (w.plan > 0) {
                    if (w.week === currentWeek) {
                      const todayIdx = (new Date().getDay() + 6) % 7;
                      const daySlots = ["mon","tue","wed","thu","fri","sat","sun"];
                      const wp = trainingPlan.find(p => p.week === w.week);
                      let plannedSoFar = 0;
                      if (wp) {
                        for (let di = 0; di <= todayIdx; di++) {
                          const sess = wp[daySlots[di]];
                          if (sess && sess !== "Rest" && !sess.includes("✈️") && sess !== "Match" && sess !== "LAST MATCH") {
                            const m = sess.match(/^(\d+\.?\d*)/);
                            if (m) plannedSoFar += parseFloat(m[1]);
                          }
                        }
                      }
                      pct = plannedSoFar > 0 ? Math.round(total / plannedSoFar * 100) : 100;
                    } else {
                      pct = Math.round(total / w.plan * 100);
                    }
                  }
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

      {/* ═══ REPLAN MODAL ═══ */}
      {showReplan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !replanning && setShowReplan(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-800">Replan from Week {currentWeek}</h3>
                <button onClick={() => setShowReplan(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>

              <p className="text-sm text-slate-500 mb-4">Claude will generate an adjusted plan based on your training history and the reason below. You'll preview changes before accepting.</p>

              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">What happened?</label>
                {[
                  ["missed-1", "Missed ~1 week", "Life got in the way, minor disruption"],
                  ["missed-2", "Missed 2+ weeks", "Extended break — illness, travel, burnout"],
                  ["injury", "Returning from injury", "Need cautious ramp-up"],
                  ["feeling-strong", "Feeling strong", "Ahead of schedule, want more"],
                ].map(([id, label, desc]) => (
                  <button key={id}
                    onClick={() => { setReplanReason(id); setReplanCustom(""); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      replanReason === id
                        ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-800">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </button>
                ))}
                <button
                  onClick={() => setReplanReason("custom")}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    replanReason === "custom"
                      ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="text-sm font-medium text-slate-800">Something else</div>
                  <div className="text-xs text-slate-500">Describe your situation</div>
                </button>
                {replanReason === "custom" && (
                  <textarea
                    value={replanCustom}
                    onChange={e => setReplanCustom(e.target.value)}
                    placeholder="E.g., I want to shift my peak week earlier because..."
                    className="w-full mt-2 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                    rows={3}
                  />
                )}
              </div>

              {/* Training summary — auto-populated */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your training so far</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-slate-800">{weeklyData.length}</div>
                    <div className="text-xs text-slate-500">weeks logged</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800">
                      {weeklyData.reduce((s, w) => s + (w.run || 0), 0).toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-500">total km</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800">
                      {weeklyData.length > 0 ? Math.max(...weeklyData.map(w => w.longRun || 0)).toFixed(0) : 0}
                    </div>
                    <div className="text-xs text-slate-500">longest run</div>
                  </div>
                </div>
              </div>

              {replanError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                  {replanError}
                </div>
              )}

              <button
                onClick={generateReplan}
                disabled={replanning || (!replanReason || (replanReason === "custom" && !replanCustom.trim()))}
                className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold py-3 rounded-xl hover:from-violet-600 hover:to-indigo-600 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {replanning ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Generating new plan...
                  </>
                ) : "Generate adjusted plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REPLAN DIFF PREVIEW ═══ */}
      {showReplanDiff && proposedPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Review New Plan</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Changed weeks are highlighted. Scroll to review, then accept or reject.</p>
                </div>
                <button onClick={rejectReplan} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>

              <div className="space-y-3 mb-6">
                {proposedPlan.plan
                  .filter(w => w.week >= currentWeek && w.week <= 38)
                  .map(w => {
                    const isChanged = proposedPlan.changedWeeks.includes(w.week);
                    const oldWeek = trainingPlan.find(ow => ow.week === w.week);
                    const daySlots = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
                    const dayLabelsShort = ["M", "T", "W", "T", "F", "S", "S"];

                    return (
                      <div key={w.week} className={`rounded-xl border p-3 transition ${
                        isChanged ? "border-violet-200 bg-violet-50/50" : "border-slate-100 bg-white opacity-60"
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${w.week === currentWeek ? "text-blue-600" : "text-slate-700"}`}>
                              Wk {w.week}
                            </span>
                            <span className="text-xs text-slate-400">{w.dates}</span>
                            {isChanged && <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-medium">Changed</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-700">{w.total}km</span>
                            {isChanged && oldWeek && oldWeek.total !== w.total && (
                              <span className="text-xs text-slate-400 line-through">{oldWeek.total}</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {daySlots.map((d, i) => {
                            const session = w[d] || "Rest";
                            const oldSession = oldWeek?.[d] || "Rest";
                            const changed = isChanged && session !== oldSession;
                            const hasSession = session !== "Rest" && !session.includes("✈️");
                            return (
                              <div key={d} className={`text-center rounded-lg py-1.5 px-1 ${
                                changed ? "bg-violet-100 ring-1 ring-violet-300" :
                                hasSession ? "bg-slate-50" : ""
                              }`}>
                                <div className="text-xs text-slate-400 font-medium">{dayLabelsShort[i]}</div>
                                <div className={`text-xs font-medium mt-0.5 ${
                                  changed ? "text-violet-700" : hasSession ? "text-slate-700" : "text-slate-300"
                                }`}>
                                  {session}
                                </div>
                                {changed && oldSession !== "Rest" && (
                                  <div className="text-xs text-slate-400 line-through mt-0.5" style={{ fontSize: "9px" }}>{oldSession}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {w.notes && <div className="text-xs text-slate-500 mt-1.5">{w.notes}</div>}
                      </div>
                    );
                  })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={rejectReplan}
                  className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50 transition"
                >
                  Reject
                </button>
                <button
                  onClick={acceptReplan}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-3 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition shadow-md"
                >
                  Accept new plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast for plan swaps */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-slate-800 text-white rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4 text-sm">
            <span>
              Moved session: <span className="font-medium capitalize">{undoState.fromDay}</span> ↔ <span className="font-medium capitalize">{undoState.toDay}</span> (Week {undoState.weekNum})
            </span>
            <button
              onClick={undoSwap}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-medium transition"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
