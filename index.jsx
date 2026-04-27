// pages/index.jsx
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";

// Mapbox must load client-side only (uses window)
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
  const [families, setFamilies]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      const res  = await fetch("/api/families");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFamilies(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

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
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <header className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">🚌</span>
              <div>
                <div className="logo-title">Transport Tracker</div>
                <div className="logo-sub">NYC Family Interest Map</div>
              </div>
            </div>
          </header>

          {/* Stats */}
          <div className="stats-grid">
            {["all", "interested", "not_interested", "unknown"].map((s) => (
              <button
                key={s}
                className={`stat-card ${filter === s ? "active" : ""}`}
                onClick={() => setFilter(s)}
                style={filter === s && s !== "all"
                  ? { borderColor: STATUS_COLORS[s], background: STATUS_COLORS[s] + "12" }
                  : {}}
              >
                <div
                  className="stat-count"
                  style={s !== "all" ? { color: STATUS_COLORS[s] } : {}}
                >
                  {counts[s]}
                </div>
                <div className="stat-label">
                  {s === "all" ? "Total" : STATUS_LABELS[s]}
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
            {loading && (
              <div className="list-empty">Loading from Google Sheets…</div>
            )}
            {error && (
              <div className="list-error">⚠ {error}</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="list-empty">No families match this filter.</div>
            )}
            {filtered.map((f) => (
              <button
                key={f.id}
                className={`family-row ${selected?.id === f.id ? "selected" : ""}`}
                onClick={() => setSelected(selected?.id === f.id ? null : f)}
              >
                <span
                  className="dot"
                  style={{ background: STATUS_COLORS[f.status] }}
                />
                <div className="family-info">
                  <div className="family-name">{f.name}</div>
                  <div className="family-addr">
                    {f.geocoded
                      ? f.displayAddress
                      : <span className="unmapped">⚠ Could not geocode</span>}
                  </div>
                </div>
                <span className="family-badge" style={{ color: STATUS_COLORS[f.status] }}>
                  {f.status === "interested" ? "✓" : f.status === "not_interested" ? "✗" : "?"}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="sidebar-footer">
            <span>{counts.unmapped > 0 ? `${counts.unmapped} could not be mapped · ` : ""}</span>
            <button className="refresh-btn" onClick={loadData} disabled={loading}>
              {loading ? "Refreshing…" : "↺ Refresh"}
            </button>
            {lastRefresh && (
              <span className="refresh-time">
                Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

          {/* Selected family card */}
          {selected && (
            <div className="detail-card">
              <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
              <div className="detail-name">{selected.name}</div>
              <div className="detail-addr">{selected.displayAddress || selected.rawAddress}</div>
              {selected.rawAddress !== selected.displayAddress && (
                <div className="detail-raw">Original: "{selected.rawAddress}"</div>
              )}
              <div
                className="detail-status"
                style={{ color: STATUS_COLORS[selected.status] }}
              >
                {STATUS_LABELS[selected.status]}
              </div>
            </div>
          )}

          <Map families={filtered} onSelectFamily={setSelected} />
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f1f5f9; }

        .app {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 320px;
          flex-shrink: 0;
          background: #fff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 20px 20px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon { font-size: 26px; }
        .logo-title { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500; color: #0f172a; }
        .logo-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 16px;
        }

        .stat-card {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
        }
        .stat-card:hover { border-color: #cbd5e1; }
        .stat-card.active { border-color: #334155; background: #f1f5f9; }

        .stat-count { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 500; color: #0f172a; }
        .stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }

        .search-wrap {
          position: relative;
          padding: 0 16px 12px;
        }
        .search-icon {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-60%);
          font-size: 16px;
          color: #94a3b8;
        }
        .search-input {
          width: 100%;
          padding: 9px 12px 9px 32px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          background: #f8fafc;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s;
        }
        .search-input:focus { border-color: #94a3b8; background: #fff; }

        .family-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px;
        }

        .list-empty { padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; }
        .list-error {
          margin: 12px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          font-size: 12px;
          color: #dc2626;
        }

        .family-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1.5px solid transparent;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: all 0.12s;
        }
        .family-row:hover { background: #f8fafc; border-color: #e2e8f0; }
        .family-row.selected { background: #f1f5f9; border-color: #cbd5e1; }

        .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .family-info { flex: 1; min-width: 0; }
        .family-name { font-size: 13px; font-weight: 500; color: #0f172a; }
        .family-addr { font-size: 11px; color: #94a3b8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .unmapped { color: #f59e0b; }
        .family-badge { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500; flex-shrink: 0; margin-top: 1px; }

        .sidebar-footer {
          padding: 12px 16px;
          border-top: 1px solid #f1f5f9;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .refresh-btn {
          background: none;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 10px;
          font-size: 11px;
          cursor: pointer;
          color: #475569;
          font-family: 'DM Mono', monospace;
          transition: all 0.12s;
        }
        .refresh-btn:hover { background: #f8fafc; }
        .refresh-btn:disabled { opacity: 0.5; cursor: default; }
        .refresh-time { margin-left: auto; }

        /* ── Map area ── */
        .map-area {
          flex: 1;
          position: relative;
          padding: 16px;
        }

        .legend {
          position: absolute;
          bottom: 32px;
          left: 32px;
          z-index: 10;
          background: rgba(255,255,255,0.96);
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

        .detail-card {
          position: absolute;
          top: 32px;
          right: 32px;
          z-index: 10;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          max-width: 260px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        .detail-close {
          position: absolute;
          top: 10px; right: 12px;
          background: none; border: none;
          font-size: 14px; color: #94a3b8;
          cursor: pointer;
        }
        .detail-name { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px; padding-right: 16px; }
        .detail-addr { font-size: 12px; color: #64748b; line-height: 1.5; }
        .detail-raw { font-size: 11px; color: #94a3b8; margin-top: 4px; font-style: italic; }
        .detail-status { margin-top: 10px; font-size: 12px; font-weight: 600; font-family: 'DM Mono', monospace; }

        /* Mapbox popup override */
        .family-popup .mapboxgl-popup-content {
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          padding: 12px 14px;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>
    </>
  );
}
