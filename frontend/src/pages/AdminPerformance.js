import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import api from "../api";

// Plan haritasıyla (PlanDetail) aynı bölge renk paleti
const COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48"];
// Grafikler için pastel tonlar (UI öğeleri COLORS kullanır)
const CHART_COLORS = ["#a5b4fc", "#fca5a5", "#6ee7b7", "#fcd34d", "#93c5fd", "#c4b5fd", "#f9a8d4", "#5eead4", "#fdba74", "#67e8f9", "#bef264", "#fda4af"];

export default function AdminPerformance() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [selectedRep, setSelectedRep] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [trend, setTrend] = useState(null);
  const [trendRep, setTrendRep] = useState(""); // "" = Tümü

  const getDateRange = useCallback(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start;
    if (period === "week") {
      const d = new Date(today);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      start = d.toISOString().slice(0, 10);
    } else if (period === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else if (period === "year") {
      start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    } else {
      start = end;
    }
    return { start, end };
  }, [period]);

  const loadData = useCallback(() => {
    setLoading(true);
    const { start, end } = getDateRange();
    api.get("/performance/admin/all", { params: { start_date: start, end_date: end } })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [getDateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadVisits = useCallback(() => {
    const { start, end } = getDateRange();
    const params = { start_date: start, end_date: end };
    if (selectedRep) params.user_id = selectedRep;
    api.get("/performance/admin/visits", { params })
      .then((r) => setVisits(r.data))
      .catch(() => {});
  }, [getDateRange, selectedRep]);

  useEffect(() => {
    if (tab === "details") loadVisits();
    if (tab === "distance" || tab === "carbon") {
      const { start, end } = getDateRange();
      api.get("/carbon/comparison", { params: { start_date: start, end_date: end } })
        .then((r) => setComparison(Array.isArray(r.data?.data) ? r.data.data : []))
        .catch(() => setComparison([]));
    }
    if (tab === "trend") {
      const { start, end } = getDateRange();
      const granularity = period === "year" ? "month" : "day";
      api.get("/performance/admin/trend", { params: { start_date: start, end_date: end, granularity } })
        .then((r) => setTrend(r.data))
        .catch(() => setTrend(null));
    }
  }, [tab, period, loadVisits, getDateRange]);

  const totalSales = data.reduce((s, d) => s + d.total_sales, 0);
  const totalVisits = data.reduce((s, d) => s + d.visit_count, 0);
  const totalCustomers = data.reduce((s, d) => s + d.customer_count, 0);
  const activeReps = data.filter((d) => d.is_active).length;

  const chartData = data.map((d) => ({
    name: d.full_name.split(" ")[0],
    sales: d.total_sales,
    visits: d.visit_count,
    customers: d.customer_count,
  }));

  return (
    <div>
      <div className="page-toolbar">
        <h1>Performans Takibi</h1>
        <div className="toolbar-actions">
          <div className="seg-bar">
            {[
              { key: "today", label: "Bugün" },
              { key: "week", label: "Bu Hafta" },
              { key: "month", label: "Bu Ay" },
              { key: "year", label: "Bu Yıl" },
            ].map((p) => (
              <button key={p.key} className={`seg-item ${period === p.key ? "active" : ""}`} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="page-body">
        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}>
            <div className="spinner" />
            <p style={{ marginTop: 12, color: "#64748b" }}>Veriler yükleniyor...</p>
          </div>
        ) : (
          <>
            <div className="kpi-strip">
              <div className="kpi-tile">
                <div className="kpi-label">Aktif ST</div>
                <div className="kpi-value">{activeReps}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Satış</div>
                <div className="kpi-value sm">
                  {Number(totalSales).toLocaleString("tr-TR")}
                  <span className="kpi-unit">₺</span>
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Toplam Ziyaret</div>
                <div className="kpi-value">{totalVisits}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Ziyaret Edilen Müşteri</div>
                <div className="kpi-value">{totalCustomers}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Ort. Satış / ST</div>
                <div className="kpi-value sm">
                  {activeReps > 0 ? Number(totalSales / activeReps).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "0"}
                  <span className="kpi-unit">₺</span>
                </div>
              </div>
            </div>

            <div className="tab-bar">
              {[
                { key: "overview", label: "Genel Bakış" },
                { key: "comparison", label: "Karşılaştırma" },
                { key: "details", label: "Detay Kayıtlar" },
                { key: "distance", label: "Mesafe & Süre" },
                { key: "carbon", label: "Karbon" },
                { key: "trend", label: "Satış Trendi" },
              ].map((t) => (
                <button key={t.key} className={`tab-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <h3>Satış Temsilcisi Performansı</h3>
                    <span className="panel-info">{data.length} temsilci</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>ST</th>
                          <th>Bölge</th>
                          <th>Ziyaret</th>
                          <th>Müşteri</th>
                          <th>Satış</th>
                          <th>Ort. Satış</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((rep, i) => (
                          <tr key={rep.user_id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  width: 28, height: 28, borderRadius: 8, display: "inline-flex",
                                  alignItems: "center", justifyContent: "center",
                                  background: rep.cluster_index != null ? COLORS[rep.cluster_index % COLORS.length] : "#94a3b8",
                                  color: "#fff",
                                  fontSize: 12, fontWeight: 700,
                                }} title={rep.cluster_index != null ? `Bölge ${rep.cluster_index + 1}` : "Bölge atanmadı"}>
                                  {rep.full_name.charAt(0)}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{rep.full_name}</div>
                                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{rep.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {rep.cluster_index !== null ? (
                                <span className="badge-freq" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[rep.cluster_index % COLORS.length], border: "1px solid rgba(0,0,0,0.1)" }} />
                                  Bölge {rep.cluster_index + 1}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                            <td className="cell-mono">{rep.visit_count}</td>
                            <td className="cell-mono">{rep.customer_count}</td>
                            <td className="cell-mono" style={{ fontWeight: 600 }}>
                              {Number(rep.total_sales).toLocaleString("tr-TR")} ₺
                            </td>
                            <td className="cell-mono">
                              {rep.visit_count > 0
                                ? Number(rep.total_sales / rep.visit_count).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺"
                                : "—"}
                            </td>
                            <td>
                              {rep.visit_count > 0 ? (
                                <span style={{ color: "#10b981", fontWeight: 600, fontSize: 12 }}>Aktif</span>
                              ) : (
                                <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 12 }}>Kayıt Yok</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {data.length > 0 && (
                          <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                            <td>Toplam</td>
                            <td></td>
                            <td className="cell-mono">{totalVisits}</td>
                            <td className="cell-mono">{totalCustomers}</td>
                            <td className="cell-mono">{Number(totalSales).toLocaleString("tr-TR")} ₺</td>
                            <td className="cell-mono">
                              {totalVisits > 0
                                ? Number(totalSales / totalVisits).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺"
                                : "—"}
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {data.length > 0 && data.some((d) => d.daily_breakdown.length > 0) && (
                  <div className="panel" style={{ marginTop: 16 }}>
                    <div className="panel-header"><h3>Günlük Kırılım</h3></div>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>ST</th>
                            {(() => {
                              const allDates = [...new Set(data.flatMap((d) => d.daily_breakdown.map((b) => b.date)))].sort();
                              return allDates.map((dt) => (
                                <th key={dt} style={{ textAlign: "center", fontSize: 11 }}>
                                  {new Date(dt + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                </th>
                              ));
                            })()}
                            <th style={{ textAlign: "right" }}>Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((rep) => {
                            const allDates = [...new Set(data.flatMap((d) => d.daily_breakdown.map((b) => b.date)))].sort();
                            const dayMap = {};
                            rep.daily_breakdown.forEach((b) => { dayMap[b.date] = b; });
                            return (
                              <tr key={rep.user_id}>
                                <td className="cell-bold" style={{ fontSize: 12 }}>{rep.full_name}</td>
                                {allDates.map((dt) => {
                                  const d = dayMap[dt];
                                  return (
                                    <td key={dt} style={{ textAlign: "center", fontSize: 12 }}>
                                      {d ? (
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{Number(d.sales).toLocaleString("tr-TR")} ₺</div>
                                          <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.visits} ziyaret</div>
                                        </div>
                                      ) : (
                                        <span style={{ color: "#e2e8f0" }}>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="cell-mono" style={{ textAlign: "right", fontWeight: 600 }}>
                                  {Number(rep.total_sales).toLocaleString("tr-TR")} ₺
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "comparison" && (
              <div className="grid-2">
                <div className="chart-panel">
                  <h3>Satış Karşılaştırması (₺)</h3>
                  <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => Number(v).toLocaleString("tr-TR") + " ₺"} />
                      <Bar dataKey="sales" name="Satış" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-panel">
                  <h3>Ziyaret Karşılaştırması</h3>
                  <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="visits" name="Ziyaret" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-panel">
                  <h3>Müşteri Sayısı Karşılaştırması</h3>
                  <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="customers" name="Müşteri" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="panel">
                  <div className="panel-header"><h3>Sıralama (Satışa Göre)</h3></div>
                  <div style={{ padding: 16 }}>
                    {[...data].sort((a, b) => b.total_sales - a.total_sales).map((rep, i) => (
                      <div key={rep.user_id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                        borderBottom: i < data.length - 1 ? "1px solid var(--border-light)" : "none",
                      }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: "50%", display: "inline-flex",
                          alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                          background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#e2e8f0",
                          color: i < 3 ? "#fff" : "#64748b",
                        }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{rep.full_name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{rep.visit_count} ziyaret</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {Number(rep.total_sales).toLocaleString("tr-TR")} ₺
                        </div>
                      </div>
                    ))}
                    {data.length === 0 && (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Henüz veri yok</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "details" && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Ziyaret Kayıtları</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      className="form-input"
                      style={{ width: "100%", maxWidth: 200, height: 32, fontSize: 12 }}
                      value={selectedRep || ""}
                      onChange={(e) => setSelectedRep(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Tüm Temsilciler</option>
                      {data.map((rep) => (
                        <option key={rep.user_id} value={rep.user_id}>{rep.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {visits.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Bu dönem için kayıt bulunamadı</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Satış Temsilcisi</th>
                          <th>Müşteri</th>
                          <th>Satış Tutarı</th>
                          <th>Giriş</th>
                          <th>Çıkış</th>
                          <th>Süre</th>
                          <th>Mesafe</th>
                          <th>Not</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visits.map((v) => (
                          <tr key={v.id}>
                            <td className="cell-mono">
                              {new Date(v.visit_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                            </td>
                            <td className="cell-bold">{v.user_name}</td>
                            <td>{v.customer_name}</td>
                            <td className="cell-mono" style={{ fontWeight: 600 }}>
                              {Number(v.sale_amount).toLocaleString("tr-TR")} TL
                            </td>
                            <td className="cell-mono" style={{ fontSize: 11 }}>
                              {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="cell-mono" style={{ fontSize: 11 }}>
                              {v.check_out_at ? new Date(v.check_out_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="cell-mono" style={{ fontSize: 11 }}>
                              {v.duration_minutes != null ? (v.duration_minutes < 60 ? `${Math.round(v.duration_minutes)} dk` : `${Math.floor(v.duration_minutes / 60)}sa ${Math.round(v.duration_minutes % 60)}dk`) : "—"}
                            </td>
                            <td className="cell-mono" style={{ fontSize: 11 }}>
                              {v.distance_from_customer_m != null ? `${Math.round(v.distance_from_customer_m)}m` : "—"}
                            </td>
                            <td className="cell-dim">{v.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "distance" && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Tahmini vs Gerçekleşen Mesafe & Süre</h3>
                  <span className="panel-info">ST bazlı karşılaştırma</span>
                </div>
                {!comparison || comparison.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                    <p>Bu dönem için mesafe/süre karşılaştırma verisi bulunamadı.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Satış Temsilcisi</th>
                            <th>Tahmini Mesafe</th>
                            <th>Gerçek Mesafe</th>
                            <th>Mesafe Fark</th>
                            <th>Tahmini Süre</th>
                            <th>Gerçek Süre</th>
                            <th>Süre Fark</th>
                            <th>Ziyaret</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.map((c, i) => {
                            const distDiff = c.estimated_distance_km > 0 ? ((c.actual_distance_km - c.estimated_distance_km) / c.estimated_distance_km * 100) : 0;
                            const timeDiff = c.estimated_time_min > 0 ? ((c.actual_time_min - c.estimated_time_min) / c.estimated_time_min * 100) : 0;
                            return (
                              <tr key={i}>
                                <td className="cell-bold">{c.user_name}</td>
                                <td className="cell-mono">{(c.estimated_distance_km || 0).toFixed(1)} km</td>
                                <td className="cell-mono">{(c.actual_distance_km || 0).toFixed(1)} km</td>
                                <td className="cell-mono" style={{ color: distDiff > 10 ? "#ef4444" : distDiff < -10 ? "#10b981" : "#64748b", fontWeight: 600 }}>
                                  {distDiff > 0 ? "+" : ""}{distDiff.toFixed(1)}%
                                </td>
                                <td className="cell-mono">{Math.round(c.estimated_time_min || 0)} dk</td>
                                <td className="cell-mono">{Math.round(c.actual_time_min || 0)} dk</td>
                                <td className="cell-mono" style={{ color: timeDiff > 10 ? "#ef4444" : timeDiff < -10 ? "#10b981" : "#64748b", fontWeight: 600 }}>
                                  {timeDiff > 0 ? "+" : ""}{timeDiff.toFixed(1)}%
                                </td>
                                <td className="cell-mono">{c.visit_count || 0}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid-2" style={{ marginTop: 20 }}>
                      <div className="panel" style={{ border: "none", boxShadow: "none" }}>
                        <div className="panel-header"><h3>Mesafe Karşılaştırması (km)</h3></div>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={comparison.map(c => ({ name: (c.user_name || "").split(" ")[0], tahmini: Number((c.estimated_distance_km || 0).toFixed(1)), gercek: Number((c.actual_distance_km || 0).toFixed(1)) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="tahmini" name="Tahmini" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="gercek" name="Gerçekleşen" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="panel" style={{ border: "none", boxShadow: "none" }}>
                        <div className="panel-header"><h3>Süre Karşılaştırması (dk)</h3></div>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={comparison.map(c => ({ name: (c.user_name || "").split(" ")[0], tahmini: Math.round(c.estimated_time_min || 0), gercek: Math.round(c.actual_time_min || 0) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="tahmini" name="Tahmini" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="gercek" name="Gerçekleşen" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "carbon" && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Karbon Emisyonu Analizi</h3>
                  <span className="panel-info">ST bazlı CO2 emisyonu</span>
                </div>
                {!comparison || comparison.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                    <p>Bu dönem için karbon emisyonu verisi bulunamadı.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Satış Temsilcisi</th>
                            <th>Araç Tipi</th>
                            <th>Mesafe (km)</th>
                            <th>Yakıt (L)</th>
                            <th>CO2 (kg)</th>
                            <th>Ziyaret</th>
                            <th>CO2/Ziyaret</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.map((c, i) => {
                            const co2PerVisit = c.visit_count > 0 ? (c.co2_kg || 0) / c.visit_count : 0;
                            return (
                              <tr key={i}>
                                <td className="cell-bold">{c.user_name}</td>
                                <td>{c.vehicle_type || "Varsayılan"}</td>
                                <td className="cell-mono">{(c.actual_distance_km || 0).toFixed(1)}</td>
                                <td className="cell-mono">{(c.fuel_consumed || 0).toFixed(2)}</td>
                                <td className="cell-mono" style={{ fontWeight: 600, color: "#ef4444" }}>{(c.co2_kg || 0).toFixed(2)}</td>
                                <td className="cell-mono">{c.visit_count || 0}</td>
                                <td className="cell-mono">{co2PerVisit.toFixed(2)} kg</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid-2" style={{ marginTop: 20 }}>
                      <div className="panel" style={{ border: "none", boxShadow: "none" }}>
                        <div className="panel-header"><h3>ST Bazlı CO2 Emisyonu (kg)</h3></div>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={comparison.map(c => ({ name: (c.user_name || "").split(" ")[0], co2: Number((c.co2_kg || 0).toFixed(2)) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => `${v} kg CO2`} />
                            <Bar dataKey="co2" name="CO2" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="panel" style={{ border: "none", boxShadow: "none" }}>
                        <div className="panel-header"><h3>CO2 Dağılımı</h3></div>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={comparison.filter(c => (c.co2_kg || 0) > 0).map((c, i) => ({ name: c.user_name, value: Number((c.co2_kg || 0).toFixed(2)) }))}
                              cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                              dataKey="value" label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                            >
                              {comparison.filter(c => (c.co2_kg || 0) > 0).map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${v} kg CO2`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "trend" && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Satış Temsilcisi Bazlı Satış Trendi</h3>
                  <select
                    className="form-input"
                    style={{ width: "100%", maxWidth: 220, height: 32, fontSize: 12 }}
                    value={trendRep}
                    onChange={(e) => setTrendRep(e.target.value)}
                  >
                    <option value="">Tümü</option>
                    {(trend?.series || []).map((s) => (
                      <option key={s.user_id} value={s.user_id}>{s.user_name}</option>
                    ))}
                  </select>
                </div>
                {!trend || !trend.series || trend.series.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                    <p>Bu dönem için satış verisi bulunamadı.</p>
                  </div>
                ) : (() => {
                  const shownSeries = trendRep === ""
                    ? trend.series
                    : trend.series.filter((s) => String(s.user_id) === String(trendRep));
                  const chartData = (trend.labels || []).map((lab, i) => {
                    const row = { name: lab };
                    (trend.series || []).forEach((s) => { row[`u${s.user_id}`] = s.data[i]; });
                    return row;
                  });
                  return (
                    <div style={{ padding: "8px 0" }}>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => `${Number(v).toLocaleString("tr-TR")} ₺`} />
                          <Legend />
                          {shownSeries.map((s) => (
                            <Line
                              key={s.user_id}
                              type="monotone"
                              dataKey={`u${s.user_id}`}
                              name={s.user_name}
                              stroke={s.cluster_index != null ? CHART_COLORS[s.cluster_index % CHART_COLORS.length] : "#94a3b8"}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>
            )}

            {data.length === 0 && !loading && (
              <div className="panel" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⊘</div>
                <h3 style={{ marginBottom: 8 }}>Henüz performans verisi yok</h3>
                <p style={{ color: "#64748b" }}>Satış temsilcileri ziyaret ve satış kayıtlarını girdikçe burada görünecektir.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
