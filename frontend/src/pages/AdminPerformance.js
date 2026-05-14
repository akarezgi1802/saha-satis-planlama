import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../api";

const COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function AdminPerformance() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [selectedRep, setSelectedRep] = useState(null);

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
  }, [tab, loadVisits]);

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
                                  background: COLORS[i % COLORS.length], color: "#fff",
                                  fontSize: 12, fontWeight: 700,
                                }}>
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
                                <span className="badge-freq">Bölge {rep.cluster_index + 1}</span>
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
                              {Number(v.sale_amount).toLocaleString("tr-TR")} ₺
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
