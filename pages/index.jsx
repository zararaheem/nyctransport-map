import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";

const Map = dynamic(() => import("../components/Map"), { ssr: false });

const STATUS_COLORS = {
  interested:     "#22c55e",
  not_interested: "#ef4444",
  unknown:        "#94a3b8",
};

const STATUS_LABELS = {
  interested:     "Interested",
  not_interested: "Not interested",
  unknown:        "No response",
};

export default function Home() {
  const [families,     setFamilies]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [filter,       setFilter]       = useState("interested"); // default: show interested
  const [search,       setSearch]       = useState("");
  const [lastRefresh,  setLastRefresh]  = useState(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch("/api/families");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFamilies(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + live polling every 30s
  useEffect(() => {
    loadData();
    const id = setInterval(() => loadData(true), 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  const filtered = useMemo(() => {
    return families.filter((f) => {
      const matchStatus = filter === "all" || f.status === filter;
      const matchSearch =
        !search ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.rawAddress.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [families, filter, search]);

  const counts = useMemo(() => ({
    all:            families.length,
    interested:     families.filter((f) => f.status === "interested").length,
    not_interested: families.filter((f) => f.status === "not_interested").length,
    unknown:        families.filter((f) => f.status === "unknown").length,
    unmapped:       families.filter((f) => !f.lat).length,
  }), [families]);

  return (
    <>
      <Head>
        <title>Transport Interest Map</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">TT</span>
              <div>
                <div className="logo-title">Transport Tracker</div>
                <div className="logo-sub">NYC Family Interest Map</div>
              </div>
            </div>
          </header>

          {/* Live aggregate banner */}
          <div className="banner">
            <span className="banner-stat">
              <span className="banner-num">{counts.all}</span>
              <span className="banner-label">responded</span>
            </span>
            <span className="banner-divider">·</span>
            <span className="banner-stat">
              <span className="banner-num" style={{ color: STATUS_COLORS.interested }}>
                {counts.interested}
              </span>
              <span className="banner-label">interested</span>
            </span>
            {loading && <span className="banner-pulse" title="Live — updating…" />}
          </div>

          {/* Status filter tabs */}
          <div className="stats-grid">
            {["all", "interested", "not_interested", "unknown"].map((s) => (
              <button
                key={s}
                className={`stat-card ${filter === s ? "active" : ""}`}
                onClick={() => setFilter(s)}
                style={
                  filter === s && s !== "all"
                    ? { borderColor: STATUS_COLORS[s], background: STATUS_COLORS[s] + "12" }
                    : {}
                }
              >
                <div
                  className="stat-count"
                  style={s !== "all" ? { color: STATUS_COLORS[s] } : {}}
                >
                  {counts[s]}
                </div>
                <div className="stat-label">
                  {s === "all" ? "All" : STATUS_LABELS[s]}
                </div>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              placeholder="Search name or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Family list */}
          <div className="family-list">
            {loading && families.length === 0 && (
              <div className="list-empty">Loading from Google Sheets…</div>
            )}
            {error && (
              <div className="list-error">Error: {error}</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="list-empty">No entries match this filter.</div>
            )}
            {filtered.map((f) => (
              <button
                key={f.id}
                className={`family-row ${selected?.id === f.id ? "selected" : ""}`}
                onClick={() => setSelected(selected?.id === f.id ? null : f)}
              >
                <span className="dot" style={{ background: STATUS_COLORS[f.status] }} />
                <div className="family-info">
                  <div className="family-name">{f.name}</div>
                  <div className="family-addr">
                    {f.geocoded
                      ? f.displayAddress
                      : <span className="unmapped">Could not geocode</span>}
                  </div>
                </div>
                <span className="family-badge" style={{ color: STATUS_COLORS[f.status] }}>
                  {f.status === "interested" ? "Yes" : f.status === "not_interested" ? "No" : "Unknown"}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="sidebar-footer">
            <span>{counts.unmapped > 0 ? `${counts.unmapped} unmapped · ` : ""}</span>
            <button className="refresh-btn" onClick={() => loadData()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {lastRefresh && (
              <span className="refresh-time">
                {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="map-area">
          {/* Legend */}
          <div className="legend">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="legend-item">
                <span className="legend-dot" style={{ background: STATUS_COLORS[key] }} />
                {label}
              </div>
            ))}
          </div>

          {/* Selected card */}
          {selected && (
            <div className="detail-card">
              <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
              <div className="detail-name">{selected.name}</div>
              <div className="detail-addr">{selected.displayAddress || selected.rawAddress}</div>
              {selected.rawAddress !== selected.displayAddress && (
                <div className="detail-raw">Original: "{selected.rawAddress}"</div>
              )}
              <div className="detail-status" style={{ color: STATUS_COLORS[selected.status] }}>
                {STATUS_LABELS[selected.status]}
              </div>
            </div>
          )}

          <Map
            families={filtered}
            selectedId={selected?.id ?? null}
            onSelectFamily={(f) => setSelected(selected?.id === f.id ? null : f)}
          />
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f3f4f6; color: #111827; }

        .app { display: flex; height: 100vh; overflow: hidden; }

        .sidebar {
          width: 340px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid #eef2f7;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.4px;
          background: #0f172a;
          color: #f8fafc;
        }
        .logo-title { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: #0f172a; }
        .logo-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }

        .banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }
        .banner-stat { display: flex; align-items: baseline; gap: 5px; }
        .banner-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 24px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1;
        }
        .banner-label { font-size: 12px; color: #6b7280; }
        .banner-divider { font-size: 18px; color: #cbd5e1; margin: 0 2px; }
        .banner-pulse {
          width: 7px; height: 7px; border-radius: 50%; background: #22c55e; margin-left: auto;
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }

        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 16px; }
        .stat-card {
          background: #ffffff; border: 1.5px solid #e5e7eb; border-radius: 10px;
          padding: 10px 12px; cursor: pointer; text-align: left; transition: all .15s;
        }
        .stat-card:hover { border-color: #cbd5e1; }
        .stat-card.active { border-color: #334155; background: #f8fafc; }
        .stat-count { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 600; color: #0f172a; }
        .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }

        .search-wrap { position: relative; padding: 0 16px 12px; }
        .search-icon { position: absolute; left: 28px; top: 50%; transform: translateY(-60%); font-size: 16px; color: #9ca3af; }
        .search-input {
          width: 100%; padding: 9px 12px 9px 32px; border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-family: 'Inter', sans-serif; font-size: 13px; background: #ffffff; color: #0f172a; outline: none;
          transition: border-color .15s;
        }
        .search-input:focus { border-color: #94a3b8; }

        .family-list { flex: 1; overflow-y: auto; padding: 0 8px; }
        .list-empty { padding: 24px; text-align: center; font-size: 13px; color: #9ca3af; }
        .list-error { margin: 12px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 12px; color: #dc2626; }

        .family-row {
          display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 12px;
          border-radius: 8px; border: 1.5px solid transparent; background: transparent; cursor: pointer; text-align: left;
          transition: all .12s;
        }
        .family-row:hover { background: #f8fafc; border-color: #e5e7eb; }
        .family-row.selected { background: #f1f5f9; border-color: #cbd5e1; }

        .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .family-info { flex: 1; min-width: 0; }
        .family-name { font-size: 13px; font-weight: 500; color: #0f172a; }
        .family-addr { font-size: 11px; color: #6b7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .unmapped { color: #d97706; }
        .family-badge { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; flex-shrink: 0; margin-top: 1px; }

        .sidebar-footer {
          padding: 10px 16px; border-top: 1px solid #eef2f7; font-size: 11px; color: #9ca3af;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .refresh-btn {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 10px;
          font-size: 11px; cursor: pointer; color: #334155; font-family: 'JetBrains Mono', monospace; transition: all .12s;
        }
        .refresh-btn:hover { background: #f8fafc; }
        .refresh-btn:disabled { opacity: .5; cursor: default; }
        .refresh-time { margin-left: auto; }

        .map-area { flex: 1; position: relative; }
        .legend {
          position: absolute; bottom: 24px; left: 24px; z-index: 10;
          background: rgba(255,255,255,0.92); border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px;
          display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 12px rgba(15,23,42,.08);
        }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #334155; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

        .detail-card {
          position: absolute; top: 24px; right: 24px; z-index: 10; background: #fff; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 16px 20px; max-width: 280px; box-shadow: 0 10px 24px rgba(2,6,23,.15);
        }
        .detail-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 14px; color: #94a3b8; cursor: pointer; }
        .detail-name { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px; padding-right: 16px; }
        .detail-addr { font-size: 12px; color: #475569; line-height: 1.5; }
        .detail-raw { font-size: 11px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        .detail-status { margin-top: 10px; font-size: 12px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
      `}</style>
    </>
  );
}
