"use client";

import { useState, useEffect } from "react";

/**
 * /sync — One-click WHOOP sync page
 *
 * Two sync methods:
 * 1. BOOKMARKLET: Drag the bookmarklet to bookmarks bar → click it on app.whoop.com
 *    The bookmarklet extracts the token and POSTs it to this page's sync API.
 * 2. PASTE: Manually paste a WHOOP access token (fallback).
 *
 * The bookmarklet works by reading the access_token from WHOOP's Cognito cookie
 * and calling our sync API with CORS enabled.
 */

const SYNC_API = typeof window !== "undefined"
  ? `${window.location.origin}/api/sync`
  : "/api/sync";

// Bookmarklet source — runs on app.whoop.com, extracts token, calls our API
function buildBookmarklet(syncUrl) {
  // This JS runs IN the context of app.whoop.com when the bookmarklet is clicked
  const code = `
(function(){
  try {
    /* Try multiple token sources */
    var token = null;

    /* 1. Try document.cookie (non-httpOnly cookies) */
    var cookies = document.cookie.split(';');
    for(var i=0;i<cookies.length;i++){
      var c = cookies[i].trim();
      if(c.startsWith('access_token=') || c.startsWith('whoop-auth-token=')){
        token = c.split('=').slice(1).join('=');
        break;
      }
    }

    /* 2. Try localStorage */
    if(!token){
      var keys = ['access_token','whoop_access_token','auth_token','cognitoToken','idToken'];
      for(var k=0;k<keys.length;k++){
        var v = localStorage.getItem(keys[k]);
        if(v && v.length > 50){token=v;break;}
      }
    }

    /* 3. Try sessionStorage */
    if(!token){
      for(var k=0;k<keys.length;k++){
        var v = sessionStorage.getItem(keys[k]);
        if(v && v.length > 50){token=v;break;}
      }
    }

    /* 4. Scan localStorage for Cognito keys (CognitoIdentityServiceProvider.*) */
    if(!token){
      for(var j=0;j<localStorage.length;j++){
        var key = localStorage.key(j);
        if(key && key.includes('CognitoIdentityServiceProvider') && (key.endsWith('.idToken') || key.endsWith('.accessToken'))){
          var v = localStorage.getItem(key);
          if(v && v.length > 50){token=v;break;}
        }
      }
    }

    if(!token){
      alert('Could not find WHOOP token. Make sure you are logged in to app.whoop.com and try again.');
      return;
    }

    /* Show syncing indicator */
    var div = document.createElement('div');
    div.id = 'whoop-sync-overlay';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:system-ui';
    div.innerHTML = '<div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><div style="font-size:32px;margin-bottom:16px">🔄</div><div style="font-size:18px;font-weight:bold;color:#1e293b">Syncing with Berlin Marathon Dashboard...</div><div style="margin-top:12px;color:#64748b;font-size:14px">Fetching your activities from WHOOP</div></div>';
    document.body.appendChild(div);

    /* POST to sync API */
    fetch('${syncUrl}',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accessToken:token})
    })
    .then(function(r){return r.json()})
    .then(function(data){
      var el = document.getElementById('whoop-sync-overlay');
      if(data.status==='success'){
        el.innerHTML = '<div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><div style="font-size:32px;margin-bottom:16px">✅</div><div style="font-size:18px;font-weight:bold;color:#059669">Synced!</div><div style="margin-top:12px;color:#64748b;font-size:14px">'+data.activitiesCount+' activities • '+data.weeksWithData+' weeks</div><div style="margin-top:8px;color:#64748b;font-size:12px">Runs: '+data.breakdown.runs+' | Football: '+data.breakdown.football+' | Spin: '+data.breakdown.spin+'</div><div style="margin-top:20px"><a href="${syncUrl.replace('/api/sync','')}" style="background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open Dashboard →</a></div></div>';
      } else {
        el.innerHTML = '<div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><div style="font-size:32px;margin-bottom:16px">❌</div><div style="font-size:18px;font-weight:bold;color:#dc2626">Sync Failed</div><div style="margin-top:12px;color:#64748b;font-size:14px">'+(data.message||'Unknown error')+'</div></div>';
      }
      setTimeout(function(){var o=document.getElementById('whoop-sync-overlay');if(o)o.remove()},8000);
    })
    .catch(function(err){
      var el = document.getElementById('whoop-sync-overlay');
      el.innerHTML = '<div style="background:white;padding:40px;border-radius:16px;text-align:center;max-width:400px"><div style="font-size:32px;margin-bottom:16px">❌</div><div style="font-size:18px;font-weight:bold;color:#dc2626">Network Error</div><div style="margin-top:12px;color:#64748b;font-size:14px">'+err.message+'</div></div>';
      setTimeout(function(){var o=document.getElementById('whoop-sync-overlay');if(o)o.remove()},5000);
    });
  } catch(e) {
    alert('Sync error: '+e.message);
  }
})()
`.replace(/\n\s*/g, '').trim();

  return `javascript:${encodeURIComponent(code)}`;
}

export default function SyncPage() {
  const [syncUrl, setSyncUrl] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [status, setStatus] = useState(null); // null | "syncing" | "success" | "error"
  const [result, setResult] = useState(null);
  const [bookmarkletHref, setBookmarkletHref] = useState("#");
  const [listenStatus, setListenStatus] = useState("idle"); // idle | listening | received

  useEffect(() => {
    const url = `${window.location.origin}/api/sync`;
    setSyncUrl(url);
    setBookmarkletHref(buildBookmarklet(url));
  }, []);

  // Listen for postMessage from the bookmarklet (optional fallback)
  useEffect(() => {
    function handler(event) {
      if (event.data && event.data.type === "whoop-sync-token") {
        setTokenValue(event.data.token);
        setListenStatus("received");
        handleSync(event.data.token);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function handleSync(token) {
    const t = token || tokenValue;
    if (!t.trim()) return;
    setStatus("syncing");
    setResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: t.trim() }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setStatus("success");
        setResult(data);
      } else {
        setStatus("error");
        setResult(data);
      }
    } catch (e) {
      setStatus("error");
      setResult({ message: e.message });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">🔄 WHOOP Sync</h1>
          <p className="text-slate-400 mt-2">Berlin Marathon 2026 Training Dashboard</p>
        </div>

        {/* Status card */}
        {status && (
          <div className={`mb-6 rounded-xl p-6 text-center ${
            status === "syncing" ? "bg-blue-900/50 border border-blue-700" :
            status === "success" ? "bg-emerald-900/50 border border-emerald-700" :
            "bg-red-900/50 border border-red-700"
          }`}>
            <div className="text-4xl mb-3">
              {status === "syncing" ? "🔄" : status === "success" ? "✅" : "❌"}
            </div>
            <div className={`text-lg font-bold ${
              status === "syncing" ? "text-blue-300" :
              status === "success" ? "text-emerald-300" :
              "text-red-300"
            }`}>
              {status === "syncing" ? "Syncing..." :
               status === "success" ? "Sync Complete!" :
               "Sync Failed"}
            </div>
            {result && status === "success" && (
              <div className="mt-3 text-sm text-slate-300">
                <div>{result.activitiesCount} activities · {result.weeksWithData} weeks</div>
                <div className="text-slate-400 mt-1">
                  🏃 {result.breakdown?.runs || 0} runs · ⚽ {result.breakdown?.football || 0} football · 🚴 {result.breakdown?.spin || 0} spin
                </div>
                <a href="/" className="mt-4 inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  Open Dashboard →
                </a>
              </div>
            )}
            {result && status === "error" && (
              <div className="mt-2 text-sm text-red-300">{result.message}</div>
            )}
          </div>
        )}

        {/* Method 1: Bookmarklet */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-4">
          <h2 className="text-lg font-bold text-white mb-3">⚡ One-Click Sync (Recommended)</h2>
          <ol className="text-sm text-slate-300 space-y-3 mb-4">
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              <span>Drag this button to your bookmarks bar:</span>
            </li>
          </ol>

          <div className="flex justify-center mb-4">
            <a
              href={bookmarkletHref}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all cursor-grab active:cursor-grabbing select-none"
              title="Drag this to your bookmarks bar"
            >
              🔄 Sync WHOOP → Marathon
            </a>
          </div>

          <ol start="2" className="text-sm text-slate-300 space-y-3">
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              <span>Go to <a href="https://app.whoop.com" target="_blank" rel="noopener" className="text-blue-400 underline">app.whoop.com</a> and make sure you're logged in</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">3.</span>
              <span>Click the bookmark — it auto-extracts your token and syncs!</span>
            </li>
          </ol>
        </div>

        {/* Method 2: Manual paste */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-bold text-white mb-3">🔑 Manual Token Paste</h2>
          <p className="text-sm text-slate-400 mb-3">
            On app.whoop.com → F12 → Application → Cookies → copy <code className="text-slate-300">access_token</code>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleSync()}
              disabled={status === "syncing" || !tokenValue.trim()}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {status === "syncing" ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
