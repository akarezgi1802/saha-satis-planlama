import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16", "#06b6d4", "#e11d48"];
const DAY_NAMES = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi" };
const DAY_SHORT = { 1: "Pzt", 2: "Salı", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt" };

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,0.4)">D</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export default function MyPlan() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [depot, setDepot] = useState(null);
  const [tab, setTab] = useState("weekly");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    api.get("/plans/").then((r) => {
      const completed = r.data.filter((p) => p.status === "completed");
      setPlans(completed);
      if (completed.length > 0) setSelectedPlan(completed[0].id);
    });
    api.get("/settings/depot").then((r) => setDepot(r.data));
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;
    setLoading(true);
    api
      .get(`/plans/${selectedPlan}/my-plan`)
      .then((r) => {
        setData(r.data);
        const days = [...new Set(r.data.weekly_plan.map((w) => w.day_of_week))].sort();
        if (days.length > 0) setSelectedDay(days[0]);
      })
      .catch((err) => {
        if (err.response?.status === 400) {
          setData(null);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedPlan]);

  if (user.cluster_index === null || user.cluster_index === undefined) {
    return (
      <div>
        <div className="page-toolbar"><h1>Benim Planım</h1></div>
        <div className="page-body">
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#8856;</div>
            <h3 style={{ marginBottom: 8 }}>Henüz bir bölge atanmadı</h3>
            <p style={{ color: "#64748b" }}>Yöneticinizden size bir bölge ataması yapmasını isteyin.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCustomers = data ? data.clusters.length : 0;
  const totalVisits = data ? data.weekly_plan.length : 0;
  const totalDistance = data ? data.routes.reduce((s, r) => s + (r.total_distance || 0), 0) : 0;
  const totalTime = data ? data.routes.reduce((s, r) => s + (r.total_time_minutes || 0), 0) : 0;
  const days = data ? [...new Set(data.weekly_plan.map((w) => w.day_of_week))].sort() : [];

  return (
    <div>
      <div className="page-toolbar">
        <h1>Benim Planım — Bölge {user.cluster_index + 1}</h1>
        <div className="toolbar-actions">
          {plans.length > 0 && (
            <select className="form-input" style={{ width: "100%", maxWidth: 220 }} value={selectedPlan || ""} onChange={(e) => setSelectedPlan(Number(e.target.value))}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="page-body">
        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}>
            <div className="spinner" />
            <p style={{ marginTop: 12, color: "#64748b" }}>Plan yükleniyor...</p>
          </div>
        ) : !data ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#64748b" }}>Bu plan için veri bulunamadı.</p>
          </div>
        ) : (
          <>
            <div className="kpi-strip">
              <div className="kpi-tile">
                <div className="kpi-label">Müşteri Sayısı</div>
                <div className="kpi-value">{totalCustomers}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Haftalık Ziyaret</div>
                <div className="kpi-value">{totalVisits}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Mesafe</div>
                <div className="kpi-value sm">{totalDistance.toFixed(1)} <span className="kpi-unit">km</span></div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Süre</div>
                <div className="kpi-value sm">{Math.round(totalTime)} <span className="kpi-unit">dk</span></div>
              </div>
            </div>

            <div className="tab-bar">
              {[
                { key: "weekly", label: "Haftalık Plan" },
                { key: "daily", label: "Günlük Plan" },
              ].map((t) => (
                <button key={t.key} className={`tab-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "weekly" && <WeeklyPlanTab data={data} />}
            {tab === "daily" && (
              <DailyPlanTab
                data={data}
                depot={depot}
                days={days}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}


/* ═══ HAFTALIK PLAN SEKMESI ═══ */
function WeeklyPlanTab({ data }) {
  const [search, setSearch] = useState("");

  const custIds = [...new Set(data.weekly_plan.map((w) => w.customer_id))];

  const rows = custIds.map((custId) => {
    const entries = data.weekly_plan.filter((w) => w.customer_id === custId);
    const days = entries.map((e) => e.day_of_week);
    const custName = entries[0]?.customer_name || "";
    return { custId, custName, days, revenue: entries[0]?.monthly_revenue || 0, visitFreq: entries[0]?.visit_frequency || 0 };
  });

  const filtered = search
    ? rows.filter((r) => r.custName.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const dayCounts = {};
  for (let d = 1; d <= 6; d++) {
    dayCounts[d] = data.weekly_plan.filter((w) => w.day_of_week === d).length;
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h3>Haftalık Ziyaret Planı</h3>
          <span className="panel-info">{filtered.length} / {rows.length} müşteri</span>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            className="form-input"
            placeholder="Müşteri adına göre filtrele..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: window.innerWidth <= 768 ? "100%" : 360 }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Müşteri</th>
                <th>Aylık Ciro</th>
                <th>Sıklık</th>
                <th style={{ textAlign: "center" }}>Pzt <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[1]})</span></th>
                <th style={{ textAlign: "center" }}>Salı <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[2]})</span></th>
                <th style={{ textAlign: "center" }}>Çar <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[3]})</span></th>
                <th style={{ textAlign: "center" }}>Per <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[4]})</span></th>
                <th style={{ textAlign: "center" }}>Cum <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[5]})</span></th>
                <th style={{ textAlign: "center" }}>Cmt <span style={{ fontSize: 10, color: "#94a3b8" }}>({dayCounts[6]})</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    {search ? "Aramayla eşleşen müşteri bulunamadı" : "Haftalık plan verisi yok"}
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr key={row.custId}>
                    <td className="cell-dim">{idx + 1}</td>
                    <td className="cell-bold">{row.custName}</td>
                    <td className="cell-mono">{Number(row.revenue).toLocaleString("tr-TR")} ₺</td>
                    <td><span className="badge-freq">{row.visitFreq}x</span></td>
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <td key={d} style={{ textAlign: "center" }}>
                        {row.days.includes(d) ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 24, height: 24, borderRadius: "50%",
                            background: COLORS[0], color: "#fff",
                            fontSize: 11, fontWeight: 700,
                          }}>&#10003;</span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


/* ═══ GÜNLÜK PLAN SEKMESI ═══ */
function DailyPlanTab({ data, depot, days, selectedDay, setSelectedDay }) {
  const dayCustomers = selectedDay
    ? data.weekly_plan.filter((w) => w.day_of_week === selectedDay)
    : [];

  const dayRoute = selectedDay
    ? data.routes.find((r) => r.day_of_week === selectedDay)
    : null;

  const mapCenter = data.clusters.length > 0
    ? [data.clusters.reduce((s, c) => s + c.x, 0) / data.clusters.length, data.clusters.reduce((s, c) => s + c.y, 0) / data.clusters.length]
    : depot ? [depot.depot_x, depot.depot_y] : [38.6, 27.4];

  const routeCoords = dayRoute
    ? dayRoute.stops.map((s) => [s.x, s.y])
    : [];
  if (routeCoords.length > 0 && depot) {
    routeCoords.unshift([depot.depot_x, depot.depot_y]);
    routeCoords.push([depot.depot_x, depot.depot_y]);
  }

  return (
    <div>
      <div className="seg-bar" style={{ marginBottom: 16 }}>
        {days.map((d) => (
          <button
            key={d}
            className={`seg-item ${selectedDay === d ? "active" : ""}`}
            onClick={() => setSelectedDay(d)}
          >
            {DAY_NAMES[d] || `Gün ${d}`}
            <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 12 }}>
              ({data.weekly_plan.filter((w) => w.day_of_week === d).length})
            </span>
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h3>{DAY_NAMES[selectedDay]} — Rota Haritası</h3>
          </div>
          <div style={{ height: window.innerWidth <= 768 ? 300 : 450 }}>
            <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
              {depot && (
                <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
                  <Popup><strong>DEPO</strong></Popup>
                </Marker>
              )}
              {dayRoute && dayRoute.stops.map((s) => {
                const icon = L.divIcon({
                  className: "",
                  html: `<div style="width:28px;height:28px;border-radius:8px;background:${COLORS[0]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${s.visit_order}</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                });
                return (
                  <Marker key={s.customer_id} position={[s.x, s.y]} icon={icon}>
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 160 }}>
                        <strong>{s.visit_order}. {s.customer_name}</strong>
                        {s.estimated_arrival_minutes != null && (
                          <><br />Tahmini varış: {Math.round(s.estimated_arrival_minutes)} dk</>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              {routeCoords.length > 1 && (
                <Polyline positions={routeCoords} color={COLORS[0]} weight={3} opacity={0.7} dashArray="8 4" />
              )}
            </MapContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{DAY_NAMES[selectedDay]} — Ziyaret Listesi ({dayCustomers.length} müşteri)</h3>
          </div>
          {dayRoute ? (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Sıra</th>
                    <th>Müşteri</th>
                    <th>Tahmini Varış</th>
                    <th>Navigasyon</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRoute.stops.map((s, idx) => {
                    const prev = idx === 0
                      ? (depot ? `${depot.depot_x},${depot.depot_y}` : null)
                      : `${dayRoute.stops[idx - 1].x},${dayRoute.stops[idx - 1].y}`;
                    const navUrl = prev
                      ? `https://www.google.com/maps/dir/${prev}/${s.x},${s.y}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${s.x},${s.y}`;
                    return (
                      <tr key={s.customer_id}>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 28, height: 28, borderRadius: 8, background: COLORS[0], color: "#fff",
                            fontWeight: 700, fontSize: 13,
                          }}>
                            {s.visit_order}
                          </span>
                        </td>
                        <td className="cell-bold">{s.customer_name}</td>
                        <td className="cell-mono">
                          {s.estimated_arrival_minutes != null ? `${Math.round(s.estimated_arrival_minutes)} dk` : "—"}
                        </td>
                        <td>
                          <a href={navUrl} target="_blank" rel="noopener noreferrer" className="btn btn-emphasized btn-xs">
                            Yol Tarifi
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
              Bu gün için rota bilgisi yok
            </div>
          )}

          {dayRoute && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 20, fontSize: 13, color: "#64748b" }}>
              <span>Mesafe: <strong style={{ color: "#1e293b" }}>{dayRoute.total_distance?.toFixed(1) || "—"} km</strong></span>
              <span>Süre: <strong style={{ color: "#1e293b" }}>{dayRoute.total_time_minutes ? Math.round(dayRoute.total_time_minutes) + " dk" : "—"}</strong></span>
              <span>Müşteri: <strong style={{ color: "#1e293b" }}>{dayRoute.customer_count}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
