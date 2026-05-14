import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import api from "../api";

const TODAY = new Date().toISOString().slice(0, 10);

export default function Performance() {
  const [tab, setTab] = useState("entry");
  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: "", sale_amount: "", notes: "", visit_date: TODAY });
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const loadData = useCallback(() => {
    api.get("/performance/summary").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/performance/visits", { params: { start_date: getWeekStart(), end_date: TODAY } })
      .then((r) => setVisits(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    api.get("/customers/?limit=500").then((r) => setCustomers(r.data)).catch(() => {});
  }, [loadData]);

  const handleSave = async () => {
    if (!form.customer_id) return;
    setSaving(true);
    try {
      await api.post("/performance/visits", {
        customer_id: Number(form.customer_id),
        visit_date: form.visit_date,
        sale_amount: Number(form.sale_amount) || 0,
        visited: 1,
        notes: form.notes || null,
      });
      setForm((p) => ({ ...p, customer_id: "", sale_amount: "", notes: "" }));
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    await api.delete(`/performance/visits/${id}`);
    loadData();
  };

  const todayVisits = visits.filter((v) => v.visit_date === TODAY);

  return (
    <div>
      <div className="page-toolbar">
        <h1>Performans Paneli</h1>
        <div className="toolbar-actions">
          <span style={{ fontSize: 13, color: "#64748b" }}>{user.full_name} — Bölge {user.cluster_index !== null ? user.cluster_index + 1 : "—"}</span>
        </div>
      </div>
      <div className="page-body">
        {summary && (
          <div className="kpi-strip">
            <div className="kpi-tile">
              <div className="kpi-label">Bugün Satış</div>
              <div className="kpi-value sm">
                {Number(summary.today.total_sales).toLocaleString("tr-TR")}
                <span className="kpi-unit">₺</span>
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Bugün Ziyaret</div>
              <div className="kpi-value">{summary.today.visit_count}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Bu Hafta Satış</div>
              <div className="kpi-value sm">
                {Number(summary.this_week.total_sales).toLocaleString("tr-TR")}
                <span className="kpi-unit">₺</span>
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Bu Hafta Ziyaret</div>
              <div className="kpi-value">{summary.this_week.visit_count}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Bu Ay Satış</div>
              <div className="kpi-value sm">
                {Number(summary.this_month.total_sales).toLocaleString("tr-TR")}
                <span className="kpi-unit">₺</span>
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Bu Ay Müşteri</div>
              <div className="kpi-value">{summary.this_month.customer_count}</div>
            </div>
          </div>
        )}

        <div className="tab-bar">
          {[
            { key: "entry", label: "Satış Girişi" },
            { key: "daily", label: "Günlük Özet" },
            { key: "weekly", label: "Haftalık Grafik" },
          ].map((t) => (
            <button key={t.key} className={`tab-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "entry" && (
          <div className="grid-2">
            <div className="panel">
              <div className="panel-header">
                <h3>Yeni Ziyaret / Satış Kaydı</h3>
              </div>
              <div style={{ padding: 20 }}>
                <div className="form-group">
                  <label>Tarih</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.visit_date}
                    onChange={(e) => setForm((p) => ({ ...p, visit_date: e.target.value }))}
                  />
                </div>
                <SearchableCustomerSelect
                  customers={customers}
                  value={form.customer_id}
                  onChange={(val) => setForm((p) => ({ ...p, customer_id: val }))}
                />
                <div className="form-group">
                  <label>Satış Tutarı (₺)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="any"
                    value={form.sale_amount}
                    onChange={(e) => setForm((p) => ({ ...p, sale_amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Notlar</label>
                  <input
                    className="form-input"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Ziyaret notu..."
                  />
                </div>
                <button
                  className="btn btn-emphasized"
                  onClick={handleSave}
                  disabled={saving || !form.customer_id}
                  style={{ width: "100%" }}
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Bugünün Kayıtları ({todayVisits.length})</h3>
                <span className="panel-info">
                  {Number(todayVisits.reduce((s, v) => s + v.sale_amount, 0)).toLocaleString("tr-TR")} ₺
                </span>
              </div>
              {todayVisits.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>Henüz bugün için kayıt yok</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Müşteri</th>
                        <th>Satış</th>
                        <th>Not</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayVisits.map((v) => (
                        <tr key={v.id}>
                          <td className="cell-bold">{v.customer_name}</td>
                          <td className="cell-mono">{Number(v.sale_amount).toLocaleString("tr-TR")} ₺</td>
                          <td className="cell-dim">{v.notes || "—"}</td>
                          <td className="cell-right">
                            <button className="btn btn-negative btn-sm" onClick={() => handleDelete(v.id)}>Sil</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "daily" && (
          <div className="panel">
            <div className="panel-header">
              <h3>Bu Haftanın Tüm Kayıtları ({visits.length})</h3>
              <span className="panel-info">
                Toplam: {Number(visits.reduce((s, v) => s + v.sale_amount, 0)).toLocaleString("tr-TR")} ₺
              </span>
            </div>
            {visits.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>Bu hafta için kayıt yok</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Müşteri</th>
                      <th>Satış Tutarı</th>
                      <th>Not</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td className="cell-mono">{formatDate(v.visit_date)}</td>
                        <td className="cell-bold">{v.customer_name}</td>
                        <td className="cell-mono">{Number(v.sale_amount).toLocaleString("tr-TR")} ₺</td>
                        <td className="cell-dim">{v.notes || "—"}</td>
                        <td className="cell-right">
                          <button className="btn btn-negative btn-sm" onClick={() => handleDelete(v.id)}>Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "weekly" && summary && (
          <div className="grid-2">
            <div className="chart-panel">
              <h3>Günlük Satış (Bu Hafta)</h3>
              <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
                <BarChart data={summary.daily_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="day_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString("tr-TR") + " ₺"} />
                  <Bar dataKey="sales" name="Satış (₺)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-panel">
              <h3>Günlük Ziyaret Sayısı (Bu Hafta)</h3>
              <ResponsiveContainer width="100%" height={window.innerWidth <= 768 ? 200 : 280}>
                <LineChart data={summary.daily_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="day_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="visits" name="Ziyaret" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel" style={{ gridColumn: "1 / -1" }}>
              <div className="panel-header"><h3>Haftalık Performans Özeti</h3></div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Gün</th>
                      <th>Tarih</th>
                      <th>Ziyaret</th>
                      <th>Satış</th>
                      <th>Ortalama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.daily_breakdown.map((d) => (
                      <tr key={d.date} style={{ opacity: d.visits === 0 ? 0.4 : 1 }}>
                        <td className="cell-bold">{d.day_name}</td>
                        <td className="cell-mono">{formatDate(d.date)}</td>
                        <td>{d.visits > 0 ? <span className="badge-freq">{d.visits} ziyaret</span> : "—"}</td>
                        <td className="cell-mono">{Number(d.sales).toLocaleString("tr-TR")} ₺</td>
                        <td className="cell-mono">{d.visits > 0 ? Number(d.sales / d.visits).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺" : "—"}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td>Toplam</td>
                      <td></td>
                      <td>{summary.this_week.visit_count} ziyaret</td>
                      <td className="cell-mono">{Number(summary.this_week.total_sales).toLocaleString("tr-TR")} ₺</td>
                      <td className="cell-mono">
                        {summary.this_week.visit_count > 0
                          ? Number(summary.this_week.total_sales / summary.this_week.visit_count).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺"
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchableCustomerSelect({ customers, value, onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => String(c.id) === String(value));
  const filtered = search
    ? customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers;

  return (
    <div className="form-group" style={{ position: "relative" }}>
      <label>Müşteri</label>
      <input
        className="form-input"
        placeholder="Müşteri adı yazarak arayın..."
        value={open ? search : (selected ? selected.name : "")}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => { setOpen(true); setSearch(""); }}
      />
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
            maxHeight: 220, overflowY: "auto", background: "#fff",
            border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)",
            marginTop: 2,
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 13 }}>Sonuç bulunamadı</div>
            ) : (
              filtered.slice(0, 50).map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "8px 16px", cursor: "pointer", fontSize: 13,
                    background: String(c.id) === String(value) ? "var(--brand-light)" : "transparent",
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.target.style.background = String(c.id) === String(value) ? "var(--brand-light)" : "transparent")}
                  onClick={() => { onChange(String(c.id)); setOpen(false); setSearch(""); }}
                >
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  {c.address && <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 11 }}>{c.address}</span>}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
