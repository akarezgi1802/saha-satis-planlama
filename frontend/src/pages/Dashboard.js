import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api";

const COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4"];
const DAY_SHORT = { 1: "Pzt", 2: "Salı", 3: "Çar", 4: "Per", 5: "Cum", 6: "Cmt" };

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,0.4)">D</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function fmtCurrency(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return Number(v).toLocaleString("tr-TR");
}

function CustomTooltip({ active, payload, label, suffix, valueKey }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
      fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, color: "#334155", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#64748b" }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: "#0f172a" }}>
            {typeof p.value === "number" ? Number(p.value).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : p.value}
            {suffix && ` ${suffix}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.payload.fill }} />
        <span style={{ fontWeight: 600, color: "#334155" }}>{d.name}</span>
      </div>
      <div style={{ marginTop: 4, color: "#0f172a", fontWeight: 700 }}>
        {d.value} müşteri
      </div>
    </div>
  );
}

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="#334155" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11} fontWeight={600}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [results, setResults] = useState(null);
  const [depot, setDepot] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/customers/count").then((r) => setStats(r.data));
    api.get("/settings/depot").then((r) => setDepot(r.data)).catch(() => {});
    api.get("/plans/").then((r) => {
      const all = r.data;
      setPlans(all);
      const completed = all.filter((p) => p.status === "completed");
      if (completed.length > 0) setSelectedPlan(completed[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;
    setLoading(true);
    api.get(`/plans/${selectedPlan}/results`)
      .then((r) => setResults(r.data))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [selectedPlan]);

  const completedPlans = plans.filter((p) => p.status === "completed");
  const currentPlan = plans.find((p) => p.id === selectedPlan);

  const clusterData = results ? (() => {
    const map = {};
    results.clusters.forEach((c) => {
      if (!map[c.cluster_index]) map[c.cluster_index] = { name: `ST ${c.cluster_index}`, count: 0, revenue: 0 };
      map[c.cluster_index].count++;
      map[c.cluster_index].revenue += c.monthly_revenue;
    });
    return Object.values(map);
  })() : [];

  const dayData = results ? (() => {
    const ordered = [1, 2, 3, 4, 5, 6];
    const map = {};
    ordered.forEach((d) => { map[d] = { name: DAY_SHORT[d], distance: 0, customers: 0 }; });
    results.routes.forEach((r) => {
      if (map[r.day_of_week]) {
        map[r.day_of_week].distance += r.total_distance || 0;
        map[r.day_of_week].customers += r.customer_count || 0;
      }
    });
    return ordered.map((d) => map[d]);
  })() : [];

  const stList = results ? [...new Set(results.clusters.map((c) => c.cluster_index))].sort() : [];

  const stDayData = results ? (() => {
    const ordered = [1, 2, 3, 4, 5, 6];
    return ordered.map((day) => {
      const row = { name: DAY_SHORT[day] };
      stList.forEach((ci) => {
        const route = results.routes.find((r) => r.cluster_index === ci && r.day_of_week === day);
        row[`ST ${ci}`] = route ? route.customer_count : 0;
      });
      return row;
    });
  })() : [];

  const mapCenter = results && results.clusters.length > 0
    ? [results.clusters.reduce((s, c) => s + c.x, 0) / results.clusters.length, results.clusters.reduce((s, c) => s + c.y, 0) / results.clusters.length]
    : depot ? [depot.depot_x, depot.depot_y] : [38.6, 27.4];

  return (
    <div>
      <div className="page-toolbar">
        <h1>Gösterge Paneli</h1>
        <div className="toolbar-actions">
          {completedPlans.length > 0 && (
            <select
              className="form-input"
              style={{ width: 240 }}
              value={selectedPlan || ""}
              onChange={(e) => setSelectedPlan(Number(e.target.value))}
            >
              {completedPlans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="page-body">
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-label">Toplam Müşteri</div>
            <div className="kpi-value">{stats?.count ?? "..."}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Toplam Ciro</div>
            <div className="kpi-value sm">
              {stats?.total_revenue
                ? Number(stats.total_revenue).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                : "..."}
              {stats?.total_revenue && <span className="kpi-unit">₺</span>}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Tamamlanan Plan</div>
            <div className="kpi-value">{completedPlans.length}</div>
          </div>
          {currentPlan && (
            <>
              <div className="kpi-tile">
                <div className="kpi-label">ST Sayısı</div>
                <div className="kpi-value">{currentPlan.st_count}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Mesafe</div>
                <div className="kpi-value sm">
                  {currentPlan.total_distance?.toFixed(1) || "—"}
                  <span className="kpi-unit">km</span>
                </div>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}>
            <div className="spinner" />
            <p style={{ marginTop: 12, color: "#64748b" }}>Plan verileri yükleniyor...</p>
          </div>
        ) : !results ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9776;</div>
            <h3 style={{ marginBottom: 8 }}>Henüz tamamlanmış plan yok</h3>
            <p style={{ color: "#64748b", marginBottom: 16 }}>Plan oluşturup optimizasyonu çalıştırdığınızda sonuçlar burada görünecektir.</p>
            <button className="btn btn-emphasized" onClick={() => navigate("/plans")}>Plan Yönetimine Git</button>
          </div>
        ) : (
          <>
            {/* --- ROW 1: Map + Pie --- */}
            <div className="grid-2">
              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-header"><h3>Bölge Haritası</h3></div>
                <div style={{ height: 380 }}>
                  <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }} key={selectedPlan}>
                    <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                    {results.clusters.map((p, i) => (
                      <CircleMarker key={i} center={[p.x, p.y]} radius={7} fillColor={COLORS[p.cluster_index % COLORS.length]} color="#fff" weight={2} fillOpacity={0.9}>
                        <Popup>
                          <div style={{ fontSize: 13 }}>
                            <strong>{p.customer_name}</strong><br />
                            ST {p.cluster_index} · {Number(p.monthly_revenue).toLocaleString("tr-TR")} ₺
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                    {depot && (
                      <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
                        <Popup><strong>DEPO</strong></Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
              </div>

              <div className="panel" style={{ marginBottom: 0 }}>
                <div className="panel-header">
                  <h3>Bölge Dağılımı</h3>
                  <span className="panel-info">{results.clusters.length} müşteri</span>
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <PieChart>
                    <defs>
                      {COLORS.map((c, i) => (
                        <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c} stopOpacity={1} />
                          <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={clusterData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={120} innerRadius={60}
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {clusterData.map((_, i) => <Cell key={i} fill={`url(#pie-grad-${i})`} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* --- ROW 2: Revenue bar + Radial distribution --- */}
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="panel" style={{ marginBottom: 0, padding: 0 }}>
                <div style={{ padding: "16px 20px 0" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>ST Bazlı Ciro Dağılımı</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Her bölgenin aylık toplam cirosu</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clusterData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="barGradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={fmtCurrency} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip suffix="₺" />} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="revenue" name="Ciro" fill="url(#barGradRevenue)" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="panel" style={{ marginBottom: 0, padding: 0 }}>
                <div style={{ padding: "16px 20px 0" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Bölge Müşteri Dağılımı</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Her bölgedeki müşteri sayısı</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clusterData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="barGradCustomer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip suffix="müşteri" />} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="count" name="Müşteri" fill="url(#barGradCustomer)" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* --- ROW 3: Daily distance area + Daily visits area --- */}
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="panel" style={{ marginBottom: 0, padding: 0 }}>
                <div style={{ padding: "16px 20px 0" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Gün Bazlı Toplam Mesafe</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Tüm ST'lerin günlük toplam mesafesi (km)</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dayData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="gradDistance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip suffix="km" />} />
                    <Area
                      type="monotone" dataKey="distance" name="Mesafe"
                      stroke="#10b981" strokeWidth={2.5} fill="url(#gradDistance)"
                      dot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: "#10b981", stroke: "#fff", strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="panel" style={{ marginBottom: 0, padding: 0 }}>
                <div style={{ padding: "16px 20px 0" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Gün Bazlı Ziyaret Sayısı</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Tüm ST'lerin günlük toplam müşteri ziyareti</p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dayData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip suffix="müşteri" />} />
                    <Area
                      type="monotone" dataKey="customers" name="Ziyaret"
                      stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradVisits)"
                      dot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: "#f59e0b", stroke: "#fff", strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* --- ROW 4: ST Daily Visit Count --- */}
            <div className="panel" style={{ marginTop: 16, padding: 0 }}>
              <div style={{ padding: "16px 20px 0" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>ST Bazlı Günlük Ziyaret Sayısı</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>Her satış temsilcisinin günlere göre ziyaret ettiği müşteri sayısı</p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stDayData} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip suffix="müşteri" />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  {stList.map((ci, i) => (
                    <Bar key={ci} dataKey={`ST ${ci}`} name={`ST ${ci}`} fill={COLORS[ci % COLORS.length]} radius={[4, 4, 0, 0]} barSize={28} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* --- ROW 5: Summary Table --- */}
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-header">
                <h3>Bölge Özeti — {stList.length} ST</h3>
                <button className="btn btn-default btn-sm" onClick={() => navigate(`/plans/${selectedPlan}`)}>Detaylı Görüntüle</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bölge</th>
                      <th>Müşteri</th>
                      <th>Toplam Ciro</th>
                      <th>Ort. Ciro</th>
                      <th>Haftalık Rota</th>
                      <th>Ciro Sapması</th>
                      <th>Ziyaret Sapması</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stList.map((ci) => {
                      const custs = results.clusters.filter((c) => c.cluster_index === ci);
                      const rev = custs.reduce((s, c) => s + c.monthly_revenue, 0);
                      const vis = custs.reduce((s, c) => s + c.visit_frequency, 0);
                      const routeCount = results.routes.filter((r) => r.cluster_index === ci).length;
                      const avgRev = results.clusters.reduce((s, c) => s + c.monthly_revenue, 0) / stList.length;
                      const avgVis = results.clusters.reduce((s, c) => s + c.visit_frequency, 0) / stList.length;
                      const devRev = avgRev > 0 ? ((rev - avgRev) / avgRev * 100) : 0;
                      const devVis = avgVis > 0 ? ((vis - avgVis) / avgVis * 100) : 0;
                      const badgeStyle = (v) => ({
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
                        borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: Math.abs(v) < 5 ? "#dcfce7" : Math.abs(v) < 15 ? "#fef9c3" : "#fee2e2",
                        color: Math.abs(v) < 5 ? "#15803d" : Math.abs(v) < 15 ? "#a16207" : "#dc2626",
                      });
                      return (
                        <tr key={ci}>
                          <td>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: 8,
                              background: COLORS[ci % COLORS.length], color: "#fff",
                              fontSize: 12, fontWeight: 700, marginRight: 8,
                            }}>
                              {ci}
                            </span>
                            ST {ci}
                          </td>
                          <td className="cell-mono">{custs.length}</td>
                          <td className="cell-mono">{Number(rev).toLocaleString("tr-TR")} ₺</td>
                          <td className="cell-mono">{custs.length > 0 ? Number(rev / custs.length).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺" : "—"}</td>
                          <td className="cell-mono">{routeCount} rota</td>
                          <td><span style={badgeStyle(devRev)}>{devRev >= 0 ? "+" : ""}{devRev.toFixed(1)}%</span></td>
                          <td><span style={badgeStyle(devVis)}>{devVis >= 0 ? "+" : ""}{devVis.toFixed(1)}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
