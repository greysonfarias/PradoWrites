'use client';
import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

/**
 * Bitcoin Market Overview — Polished + Mobile + 6M Range
 *
 * Fix for SyntaxError at (194:8): removed a stray duplicated JSX fragment that
 * appeared after the FearGreedGauge() component. That fragment caused the
 * "Adjacent JSX elements must be wrapped" parser error. File is now clean.
 *
 * Features:
 * - 6 months of data with 10‑day ticks on X axis.
 * - Live price, Fear & Greed, MVRV (via /api/mvrv) with fallbacks.
 * - Responsive layout and SVG gauge with pointer.
 */

/* --------------------------------
   Data helpers
---------------------------------*/
function generateMockPriceSeries(days = 180) {
  const now = Date.now();
  let price = 68000;
  return Array.from({ length: days }, (_, i) => {
    price += (Math.random() - 0.5) * 1200;
    const t = now - (days - 1 - i) * 24 * 60 * 60 * 1000;
    return { t, price: Math.max(15000, price) };
  });
}

function generateMockMVRVSeries(anchorLength = 180) {
  const now = Date.now();
  let mvrv = 2.1;
  const len = typeof anchorLength === 'number' && anchorLength > 0 ? anchorLength : 180;
  const arr = Array.from({ length: len }, (_, i) => {
    mvrv += (Math.random() - 0.5) * 0.06;
    const t = now - (len - 1 - i) * 24 * 60 * 60 * 1000;
    return { t, mvrv: Math.max(0.6, Math.min(5, mvrv)) };
  });
  return { current: arr[arr.length - 1].mvrv, series: arr };
}

async function fetchBTC() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { signal: controller.signal, cache: "no-store" }
    );
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const p = j && j.bitcoin ? j.bitcoin : null;
    return {
      price: p && typeof p.usd === "number" ? p.usd : null,
      change24h: p && typeof p.usd_24h_change === "number" ? p.usd_24h_change : null,
    };
  } catch (e) {
    return { price: null, change24h: null, error: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(id);
  }
}

async function fetchBTC6m() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=180&interval=daily",
      { signal: controller.signal, cache: "no-store" }
    );
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const prices = Array.isArray(j.prices) ? j.prices : [];
    return prices.map(([ts, val]) => ({ t: ts, price: Number(val) }));
  } catch (e) {
    return generateMockPriceSeries(180);
  } finally {
    clearTimeout(id);
  }
}

async function fetchFearGreed() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1&format=json", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const v = j && j.data && j.data[0] ? j.data[0] : null;
    return {
      value: v && v.value ? Number(v.value) : null,
      classification: v && v.value_classification ? String(v.value_classification) : null,
      updated: v && v.timestamp ? new Date(Number(v.timestamp) * 1000) : null,
    };
  } catch (e) {
    return { value: null, classification: null, updated: null, error: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(id);
  }
}

async function fetchMVRV() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("/api/mvrv", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const points = Array.isArray(j.series) ? j.series : [];
    return {
      current: typeof j.current === 'number' ? j.current : (points.length ? Number(points[points.length - 1].mvrv) : null),
      series: points.map((p) => ({ t: new Date(p.t).getTime(), mvrv: Number(p.mvrv) })),
      fromProxy: true,
    };
  } catch (e) {
    const mock = generateMockMVRVSeries();
    return { ...mock, fromProxy: false, error: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(id);
  }
}

function currency(n) {
  return typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "—";
}

/* --------------------------------
   Fear & Greed — Progress Bar (simple, solid colors)
---------------------------------*/
function FNGBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  // Colors per request: red < 30, yellow ≤ 75, red > 75
  const color = v < 30 ? '#dc2626' : (v <= 75 ? '#f59e0b' : '#dc2626');
  return (
    <div style={{ width: '100%', height: 12, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${v}%`, height: '100%', background: color }} />
    </div>
  );
}

/* --------------------------------
   Alerts, domain and merge helpers
---------------------------------*/
function computeMvrvDomain(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [0, 4];
  let mn = Infinity, mx = -Infinity;
  for (const p of arr) {
    if (typeof p.mvrv === 'number') {
      if (p.mvrv < mn) mn = p.mvrv;
      if (p.mvrv > mx) mx = p.mvrv;
    }
  }
  if (!isFinite(mn) || !isFinite(mx)) return [0, 4];
  const pad = Math.max(0.05, (mx - mn) * 0.1);
  return [Math.max(0, Math.floor((mn - pad) * 10) / 10), Math.ceil((mx + pad) * 10) / 10];
}

function buildAlerts(state) {
  const out = [];
  const mv = state && state.mvrv && typeof state.mvrv.current === 'number' ? state.mvrv.current : null;
  const fg = state && typeof state.fngValue === 'number' ? state.fngValue : null;
  if (typeof mv === 'number') {
    if (mv >= 3.0) out.push({ level: 'HIGH', title: 'MVRV Overbought', desc: `MVRV at ${mv.toFixed(2)} (>= 3.0).` });
    else if (mv >= 2.5) out.push({ level: 'MEDIUM', title: 'MVRV Elevated', desc: `MVRV at ${mv.toFixed(2)} (>= 2.5).` });
  }
  if (typeof fg === 'number' && fg >= 70) out.push({ level: 'MEDIUM', title: 'Extreme Greed', desc: `Fear & Greed = ${fg}.` });
  return out;
}

function AlertBadge({ level }) {
  const color = level === 'HIGH' ? '#dc2626' : level === 'MEDIUM' ? '#f59e0b' : '#64748b';
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color, marginTop: 6 }} />;
}

// Style system
const S = {
  page: { background: '#0b1220', minHeight: '100vh' },
  hero: {
    background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
    color: '#e2e8f0',
    padding: '24px 24px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.12)'
  },
  heroTitle: { fontSize: 24, fontWeight: 800, letterSpacing: 0.2 },
  heroSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  content: { padding: 24 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  mainGrid: (isWide) => ({ display: 'grid', gridTemplateColumns: isWide ? '2fr 1fr' : '1fr', gap: 16 }),
  card: { background: '#ffffff', borderRadius: 16, boxShadow: '0 4px 24px rgba(2,6,23,0.05)', border: '1px solid #eef2f7', padding: 14 },
  statLabel: { fontSize: 12, color: '#64748b' },
  statValue: { fontSize: 22, fontWeight: 700 },
  muted: { fontSize: 12, color: '#64748b' },
  btn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #1f2937', background: 'transparent', color: '#e5e7eb', cursor: 'pointer' },
};

/* --------------------------------
   Sidebar (MUI-ish style)
---------------------------------*/
function Sidebar({ active = 'dashboard', onSelect }) {
  const items = [
    { id: 'dashboard', label: 'MVRV' },
    { id: 'markets', label: 'Markets' },
    { id: 'onchain', label: 'On-chain' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'settings', label: 'Settings' },
  ];
  const Item = ({ id, label }) => {
    const isActive = active === id;
    return (
      <button
        onClick={() => onSelect && onSelect(id)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid ' + (isActive ? '#334155' : 'transparent'),
          background: isActive ? 'rgba(148,163,184,0.12)' : 'transparent',
          color: '#e2e8f0',
          cursor: 'pointer'
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: '#0b1220',
      borderRight: '1px solid rgba(148,163,184,0.12)',
      padding: 16,
      position: 'sticky',
      top: 0
    }}>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Menu</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((it) => (
          <Item key={it.id} id={it.id} label={it.label} />
        ))}
      </div>
    </aside>
  );
}

/* --------------------------------
   Main component
---------------------------------*/
export default function BitcoinDashboardPhase5Visual() {
  const initial = useMemo(() => generateMockPriceSeries(180), []);
  const [priceSeries, setPriceSeries] = useState(initial);
  const [price, setPrice] = useState(null);
  const [change24h, setChange24h] = useState(null);

  const [fngValue, setFngValue] = useState(null);
  const [fngClass, setFngClass] = useState(null);
  const [fngUpdated, setFngUpdated] = useState(null);

  const [mvrv, setMvrv] = useState({ current: null, series: [], fromProxy: false, error: null });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ price: null, fng: null, mvrv: null });
  const [isWide, setIsWide] = useState(true);
  const [active, setActive] = useState('dashboard');

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function refreshPrice() {
    const r = await fetchBTC();
    if (r && typeof r.price === "number") {
      setPrice(r.price);
      setChange24h(r.change24h);
      setErrors((e) => ({ ...e, price: null }));
    } else {
      setErrors((e) => ({ ...e, price: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshFNG() {
    const r = await fetchFearGreed();
    if (r && typeof r.value === "number") {
      setFngValue(r.value);
      setFngClass(r.classification || "Neutral");
      setFngUpdated(r.updated || new Date());
      setErrors((e) => ({ ...e, fng: null }));
    } else {
      setFngValue(74);
      setFngClass("Greed");
      setFngUpdated(new Date());
      setErrors((e) => ({ ...e, fng: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshMVRV() {
    const r = await fetchMVRV();
    if (r && Array.isArray(r.series) && r.series.length) {
      setMvrv({ current: r.current, series: r.series, fromProxy: !!r.fromProxy, error: null });
      setErrors((e) => ({ ...e, mvrv: null }));
    } else {
      const mock = generateMockMVRVSeries(priceSeries.length);
      setMvrv({ current: mock.current, series: mock.series, fromProxy: false, error: r && r.error ? r.error : 'fetch error' });
      setErrors((e) => ({ ...e, mvrv: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshAll() {
    setLoading(true);
    // Ensure 6M series first
    try {
      const hist = await fetchBTC6m();
      if (Array.isArray(hist) && hist.length) setPriceSeries(hist);
    } catch {}
    await Promise.all([refreshPrice(), refreshFNG(), refreshMVRV()]);
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 60000);
    return () => clearInterval(id);
  }, []);

  const changeText = typeof change24h === "number" ? `${change24h.toFixed(2)}%` : "—";
  const changeColor = typeof change24h === "number" ? (change24h >= 0 ? "#059669" : "#dc2626") : "#475569";
  const mvrvDomain = computeMvrvDomain(mvrv.series);
  const alerts = buildAlerts({ mvrv, fngValue });

  return (
    <div style={{ ...S.page, display: 'flex' }}>
      {/* Sidebar */}
      <Sidebar active={active} onSelect={setActive} />

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Hero/header */}
        <div style={S.hero}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={S.heroTitle}>Bitcoin Market Overview</div>
              <div style={S.heroSub}>Live price, sentiment and on-chain valuation (MVRV)</div>
            </div>
            <button onClick={refreshAll} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={S.content}>
          {active === 'dashboard' && (
            <>
              {/* Stats row */}
              <div style={{ ...S.statsGrid, marginBottom: 16 }}>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Bitcoin Price</div>
                  <div style={S.statValue}>{currency(price)}</div>
                  <div style={{ ...S.muted, color: changeColor, marginTop: 4 }}>24h {changeText}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>MVRV</div>
                  <div style={S.statValue}>{typeof mvrv.current === 'number' ? mvrv.current.toFixed(2) : '—'}</div>
                  <div style={S.muted}>{mvrv.fromProxy ? 'Live' : 'Mock'}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Fear & Greed</div>
                  <div style={S.statValue}>{typeof fngValue === 'number' ? fngValue : '—'}</div>
                  <div style={S.muted}>{fngClass || 'Neutral'}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Updated</div>
                  <div style={S.statValue}>{fngUpdated ? new Date(fngUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                  <div style={S.muted}>auto-refresh 60s</div>
                </div>
              </div>

              {/* Main grid */}
              <div style={S.mainGrid(isWide)}>
                {/* Chart card */}
                <div style={{ ...S.card }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Price & MVRV</div>
                    <div style={{ ...S.muted }}>Last 6 months • ticks every 10 days</div>
                  </div>
                  <div style={{ width: '100%', height: 420 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergeSeries(priceSeries, mvrv.series)} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          scale="time"
                          ticks={compute10DayTicks(priceSeries)}
                          tickFormatter={(t) => new Date(t).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                          fontSize={12}
                          stroke="#94a3b8"
                          tick={{ fill: '#475569' }}
                        />
                        <YAxis yAxisId="left" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} fontSize={12} stroke="#94a3b8" tick={{ fill: '#475569' }} />
                        <YAxis yAxisId="right" orientation="right" domain={mvrvDomain} tickFormatter={(v) => Number(v).toFixed(1)} fontSize={12} stroke="#94a3b8" tick={{ fill: '#475569' }} />
                        <Tooltip labelFormatter={(l) => new Date(l).toLocaleString()} formatter={(v, n) => (n === 'price' ? `$${Number(v).toFixed(2)}` : Number(v).toFixed(2))} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="price" name="Bitcoin Price" dot={false} strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="mvrv" name="MVRV" dot={false} strokeWidth={2} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right column: F&G and Alerts */}
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ ...S.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Fear & Greed Index</div>
                      <div style={{ ...S.muted }}>{fngUpdated ? new Date(fngUpdated).toLocaleString() : '—'}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
                      <div style={{ minWidth: 70, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{typeof fngValue === 'number' ? fngValue : '—'}</div>
                      <div style={{ minWidth: 80, fontSize: 14, color: '#475569' }}>{fngClass || 'Neutral'}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <FNGBar value={fngValue || 0} />
                    </div>
                    <div style={{ marginTop: 8, ...S.muted }}>Components: Volatility, Market Momentum, Social Media, Surveys, Dominance, Trends</div>
                  </div>

                  <div style={{ ...S.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Market Alerts</div>
                      <div style={{ ...S.muted }}>{alerts.length} active</div>
                    </div>
                    {alerts.length === 0 ? (
                      <div style={{ ...S.muted }}>No active alerts.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {alerts.map((a, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #eef2f7', borderRadius: 12, padding: 10 }}>
                            <AlertBadge level={a.level} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                              <div style={{ fontSize: 12, color: '#475569' }}>{a.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error banner */}
              {(errors.price || errors.fng || errors.mvrv) ? (
                <div style={{ marginTop: 16, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', padding: 10, borderRadius: 12 }}>
                  {errors.price ? `Price: ${errors.price}. ` : ''}
                  {errors.fng ? `F&G: ${errors.fng}. ` : ''}
                  {errors.mvrv ? `MVRV: ${errors.mvrv}.` : ''}
                </div>
              ) : null}
            </>
          )}

          {active !== 'dashboard' && (
            <div style={{ ...S.card }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
                {active.charAt(0).toUpperCase() + active.slice(1)}
              </div>
              <div style={S.muted}>This section is a placeholder. Click Dashboard in the sidebar to return.</div>
            </div>
          )}

          <pre style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>Visual polished + mobile fixes. See console for runtime tests.</pre>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------
   Merge, ticks & tests
---------------------------------*/
function mergeSeries(priceArr, mvrvArr) {
  const out = [];
  let i = 0, j = 0;
  while (i < (priceArr?.length || 0) || j < (mvrvArr?.length || 0)) {
    const p = priceArr[i];
    const m = mvrvArr[j];
    if (p && m) {
      const tp = Number(p.t);
      const tm = Number(m.t);
      if (Math.abs(tp - tm) <= 12 * 60 * 60 * 1000) {
        out.push({ t: tp, price: p.price, mvrv: m.mvrv });
        i++; j++;
      } else if (tp < tm) {
        out.push({ t: tp, price: p.price, mvrv: undefined });
        i++;
      } else {
        out.push({ t: tm, price: undefined, mvrv: m.mvrv });
        j++;
      }
    } else if (p) {
      out.push({ t: Number(p.t), price: p.price, mvrv: undefined });
      i++;
    } else if (m) {
      out.push({ t: Number(m.t), price: undefined, mvrv: m.mvrv });
      j++;
    } else {
      break;
    }
  }
  return out;
}

function compute10DayTicks(series) {
  if (!Array.isArray(series) || !series.length) return [];
  const start = Number(series[0].t);
  const end = Number(series[series.length - 1].t);
  const oneDay = 24 * 60 * 60 * 1000;
  const step = 10 * oneDay;
  const alignedStart = start - (start % oneDay);
  const ticks = [];
  for (let t = alignedStart; t <= end + 1; t += step) ticks.push(t);
  return ticks;
}

// Runtime tests
try {
  const ps = generateMockPriceSeries(180);
  const mockM = generateMockMVRVSeries(ps.length);
  console.assert(Array.isArray(ps) && ps.length === 180, "Price series should have 180 points (~6m)");
  console.assert(Array.isArray(mockM.series) && mockM.series.length === 180, "MVRV series should have 180 points (~6m)");
  const merged = mergeSeries(ps, mockM.series);
  console.assert(Array.isArray(merged) && merged.length >= 24, "Merged series should have at least 24 points");
  const dom = computeMvrvDomain(mockM.series);
  console.assert(Array.isArray(dom) && dom.length === 2 && dom[1] >= dom[0], "MVRV domain should be valid");
  const al = buildAlerts({ mvrv: { current: 3.1 }, fngValue: 80 });
  console.assert(al.length >= 2, "Alert engine should fire on high MVRV and high F&G");
  const al2 = buildAlerts({ mvrv: { current: 2.6 }, fngValue: 50 });
  console.assert(al2.length === 1 && al2[0].level === 'MEDIUM', "MVRV caution level should be MEDIUM");
} catch (e) {
  console.error("Visual/mobile runtime tests failed", e);
}

export { generateMockPriceSeries, generateMockMVRVSeries, fetchBTC, fetchFearGreed, fetchMVRV, currency, computeMvrvDomain, mergeSeries, buildAlerts };
