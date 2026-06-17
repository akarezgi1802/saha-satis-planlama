import { useState, useEffect, useCallback } from "react";
import api from "../api";

function safeNum(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function formatTL(v) {
  try { return safeNum(v).toLocaleString("tr-TR"); } catch { return "0"; }
}
function safeDate(v) {
  try { if (!v) return "-"; return new Date(v).toLocaleDateString("tr-TR"); } catch { return "-"; }
}

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customersList, setCustomersList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [period, setPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterCustomers, setFilterCustomers] = useState([]);

  const [showDetail, setShowDetail] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  const customers = Array.isArray(customersList) ? customersList : [];
  const users = Array.isArray(usersList) ? usersList : [];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    api.get("/auth/users").then((r) => {
      setUsersList(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
    api.get("/customers/", { params: { limit: 1000 } }).then((r) => {
      setCustomersList(Array.isArray(r.data) ? r.data : []);
    }).catch((e) => {
      console.error("Müşteri listesi yüklenemedi:", e);
      // Yedek deneme (trailing slash / param farkı ihtimaline karşı)
      api.get("/customers").then((r) => {
        setCustomersList(Array.isArray(r.data) ? r.data : []);
      }).catch((e2) => console.error("Müşteri listesi (yedek) yüklenemedi:", e2));
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = {};
      if (period) p.period = period;
      if (startDate && !period) p.start_date = startDate;
      if (endDate && !period) p.end_date = endDate;
      if (filterUser) p.user_id = filterUser;
      if (filterCustomers.length > 0) p.customer_ids = filterCustomers.join(",");

      // Diagnostic: console + UI banner — müşteri filtresi sorununu izlemek için
      const qs = new URLSearchParams(p).toString();
      // eslint-disable-next-line no-console
      console.log("[Reports] /reports/sales çağrılıyor:", qs || "(filtresiz)", "params:", p);

      const t0 = performance.now();
      const [salesRes, sumRes] = await Promise.all([
        api.get("/reports/sales", { params: p }),
        api.get("/reports/summary", { params: p }),
      ]);
      const ms = Math.round(performance.now() - t0);
      const rows = Array.isArray(salesRes.data) ? salesRes.data.length : 0;
      // eslint-disable-next-line no-console
      console.log(`[Reports] ✓ ${rows} satır, ${ms} ms`);
      setDebugInfo({ params: p, qs, rows, ms });

      setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      setSummary(sumRes.data && typeof sumRes.data === "object" ? sumRes.data : null);
    } catch (err) {
      console.error("Rapor yuklenemedi:", err);
      setError(err?.response?.data?.detail || err?.message || "Veriler yuklenemedi");
      setSales([]);
      setSummary(null);
      setDebugInfo({ error: err?.message || "?" });
    }
    setLoading(false);
  }, [period, startDate, endDate, filterUser, filterCustomers]);

  useEffect(() => { loadData(); }, [loadData]);

  const getExportParams = () => {
    const p = {};
    if (period) p.period = period;
    if (startDate && !period) p.start_date = startDate;
    if (endDate && !period) p.end_date = endDate;
    if (filterUser) p.user_id = filterUser;
    if (filterCustomers.length > 0) p.customer_ids = filterCustomers.join(",");
    return p;
  };

  const handleExportExcel = () => {
    try {
      const params = new URLSearchParams(getExportParams());
      const token = localStorage.getItem("token");
      const base = api.defaults.baseURL || "/api";
      window.open(`${base}/reports/export/excel?${params}&token=${token}`, "_blank");
    } catch (err) { alert("Hata: " + err.message); }
  };

  const handleExportPDF = () => {
    try {
      const params = new URLSearchParams(getExportParams());
      const token = localStorage.getItem("token");
      const base = api.defaults.baseURL || "/api";
      window.open(`${base}/reports/export/pdf?${params}&token=${token}`, "_blank");
    } catch (err) { alert("Hata: " + err.message); }
  };

  const totalSales = sales.reduce((s, v) => s + safeNum(v.sale_amount), 0);

  return (
    <div>
      <div className="page-toolbar">
        <h1>Satış Raporları</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={handleExportExcel} style={{ background: "#10b981", color: "#fff" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4,verticalAlign:"middle"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Excel
          </button>
          <button className="btn" onClick={handleExportPDF} style={{ background: "#ef4444", color: "#fff" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4,verticalAlign:"middle"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ padding: 12, marginBottom: 16, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* KPI */}
        {summary && (
          <div className="kpi-strip">
            <div className="kpi-tile">
              <div className="kpi-label">Toplam Kayıt</div>
              <div className="kpi-value">{safeNum(summary.total_records)}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Ziyaret Edilen</div>
              <div className="kpi-value" style={{ color: "#10b981" }}>{safeNum(summary.visited_count)}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Toplam Satış</div>
              <div className="kpi-value sm">{formatTL(summary.total_revenue)}<span className="kpi-unit">TL</span></div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Ort. Satış</div>
              <div className="kpi-value sm">{formatTL(summary.avg_sale)}<span className="kpi-unit">TL</span></div>
            </div>
          </div>
        )}

        {/* Filtreler */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header"><h3>Filtreler</h3></div>
          <div style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Dönem</div>
              <select className="form-input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 140 }}>
                <option value="">Tümü</option>
                <option value="today">Bugün</option>
                <option value="week">Bu Hafta</option>
                <option value="month">Bu Ay</option>
              </select>
            </div>
            {!period && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Başlangıç</div>
                  <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Bitiş</div>
                  <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 150 }} />
                </div>
                <button className="btn btn-emphasized btn-sm" onClick={loadData}>Ara</button>
              </>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Satış Temsilcisi</div>
              <select className="form-input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 160 }}>
                <option value="">Tümü</option>
                {users.filter((u) => u && u.role === "sales_rep").map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || "?"}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                Müşteri {customers.length > 0 ? `(${customers.length} kayıtlı)` : "(yükleniyor...)"}
              </div>
              <MultiCustomerSelect
                customers={customers}
                selected={filterCustomers}
                onChange={setFilterCustomers}
              />
            </div>
          </div>
        </div>

        {/* Debug bandı — müşteri filtresi sorununu izlemek için geçici */}
        {debugInfo ? (
          <div style={{
            margin: "0 0 12px", padding: "8px 12px",
            background: debugInfo.error ? "#fee2e2" : "#f1f5f9",
            border: `1px solid ${debugInfo.error ? "#fca5a5" : "#cbd5e1"}`,
            borderRadius: 8, fontSize: 11, color: "#475569",
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
            fontFamily: "JetBrains Mono, monospace",
          }}>
            {debugInfo.error ? (
              <span style={{ color: "#b91c1c" }}>❌ {debugInfo.error}</span>
            ) : (
              <>
                <span><b style={{ color: "#1e293b" }}>GET /reports/sales?{debugInfo.qs || "(filtresiz)"}</b></span>
                <span>→ <b style={{ color: debugInfo.rows > 0 ? "#10b981" : "#f59e0b" }}>{debugInfo.rows} satır</b></span>
                <span>· {debugInfo.ms} ms</span>
                <span style={{ marginLeft: "auto", color: "#94a3b8" }}>
                  filtre: {Object.keys(debugInfo.params).length === 0 ? "yok" : JSON.stringify(debugInfo.params)}
                </span>
              </>
            )}
          </div>
        ) : null}

        {/* ST Bazli Ozet */}
        {summary && Array.isArray(summary.rep_stats) && summary.rep_stats.length > 0 && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Temsilci Bazlı Özet</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Satış Temsilcisi</th>
                    <th>Ziyaret Sayısı</th>
                    <th>Toplam Satış</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rep_stats.map((rs, i) => (
                    <tr key={i}>
                      <td className="cell-bold">{rs.user_name || "-"}</td>
                      <td>{safeNum(rs.visit_count)}</td>
                      <td className="cell-mono" style={{ fontWeight: 700, color: "var(--brand)" }}>
                        {formatTL(rs.total_sales)} TL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Satis Kayitlari Listesi */}
        <div className="panel">
          <div className="panel-header">
            <h3>Satış Kayıtları</h3>
            <span className="panel-info">
              {sales.length} kayıt &middot; {formatTL(totalSales)} TL
            </span>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : sales.length === 0 ? (
            <div className="empty-state"><p>Satış kaydı bulunamadı. Filtrelerinizi değiştirin.</p></div>
          ) : isMobile ? (
            /* Mobil kart layout */
            <div style={{ padding: 12 }}>
              {sales.map((v) => (
                <div key={v.id} onClick={() => setShowDetail(v)} style={{
                  padding: 12, marginBottom: 8, borderRadius: 10, cursor: "pointer",
                  background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{v.customer_name || "-"}</strong>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      background: v.visited === 1 ? "#10b98122" : "#ef444422",
                      color: v.visited === 1 ? "#10b981" : "#ef4444",
                    }}>{v.visited === 1 ? "Ziyaret Edildi" : "Edilmedi"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                    {v.user_name || "-"} &middot; {safeDate(v.visit_date)}
                  </div>
                  {v.notes && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, fontStyle: "italic" }}>
                      {v.notes.length > 60 ? v.notes.substring(0, 60) + "..." : v.notes}
                    </div>
                  )}
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 15, color: "var(--brand)" }}>
                      {formatTL(v.sale_amount)} TL
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Masaustu tablo */
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tarih</th>
                    <th>Satış Temsilcisi</th>
                    <th>Müşteri</th>
                    <th>Satış Tutarı</th>
                    <th>Ziyaret</th>
                    <th>Notlar</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((v, idx) => (
                    <tr key={v.id} onClick={() => setShowDetail(v)} style={{ cursor: "pointer" }}>
                      <td>{idx + 1}</td>
                      <td>{safeDate(v.visit_date)}</td>
                      <td className="cell-bold">{v.user_name || "-"}</td>
                      <td className="cell-bold">{v.customer_name || "-"}</td>
                      <td className="cell-mono" style={{ fontWeight: 700, color: safeNum(v.sale_amount) > 0 ? "var(--brand)" : "var(--text-secondary)" }}>
                        {formatTL(v.sale_amount)} TL
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                          background: v.visited === 1 ? "#10b98122" : "#ef444422",
                          color: v.visited === 1 ? "#10b981" : "#ef4444",
                        }}>{v.visited === 1 ? "Evet" : "Hayır"}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 800, background: "var(--bg-secondary)" }}>
                    <td colSpan={4} style={{ textAlign: "right", padding: "12px 8px" }}>TOPLAM ({sales.length} kayıt)</td>
                    <td className="cell-mono" style={{ color: "var(--brand)", fontWeight: 800, fontSize: 14 }}>{formatTL(totalSales)} TL</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detay Dialog */}
      {showDetail && (
        <div className="dialog-overlay" onClick={() => setShowDetail(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? "95vw" : 500 }}>
            <div className="dialog-header">
              <h2>Satış Detayı</h2>
              <button className="dialog-close" onClick={() => setShowDetail(null)}>x</button>
            </div>
            <div className="dialog-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Müşteri</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{showDetail.customer_name || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Satış Temsilcisi</div>
                  <div style={{ fontWeight: 700 }}>{showDetail.user_name || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Tarih</div>
                  <div style={{ fontWeight: 600 }}>{safeDate(showDetail.visit_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Ziyaret Durumu</div>
                  <div style={{
                    fontWeight: 700,
                    color: showDetail.visited === 1 ? "#10b981" : "#ef4444",
                  }}>{showDetail.visited === 1 ? "Ziyaret Edildi" : "Ziyaret Edilmedi"}</div>
                </div>
                {showDetail.check_in_at && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Giriş Saati</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.check_in_at}</div>
                  </div>
                )}
                {showDetail.check_out_at && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Çıkış Saati</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.check_out_at}</div>
                  </div>
                )}
              </div>

              <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "var(--brand)" }}>
                  <span>Satış Tutarı</span>
                  <span>{formatTL(showDetail.sale_amount)} TL</span>
                </div>
              </div>

              {showDetail.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Notlar</div>
                  <div style={{
                    padding: 12, borderRadius: 8, background: "var(--bg-secondary)",
                    fontSize: 13, lineHeight: 1.5, color: "var(--text)",
                  }}>
                    {showDetail.notes}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setShowDetail(null)}>Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Türkçe karakterleri normalize ederek aksandan bağımsız arama sağlar
function trNorm(s) {
  return (s || "")
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase();
}

function MultiCustomerSelect({ customers, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const list = Array.isArray(customers) ? customers : [];
  const filtered = search
    ? list.filter((c) => trNorm(c.name).includes(trNorm(search)))
    : list;

  const toggle = (id) => {
    const sid = String(id);
    if (selected.includes(sid)) {
      onChange(selected.filter((x) => x !== sid));
    } else {
      onChange([...selected, sid]);
    }
  };

  const label =
    selected.length === 0
      ? "Tümü"
      : selected.length === 1
      ? (list.find((c) => String(c.id) === selected[0])?.name || "1 müşteri")
      : `${selected.length} müşteri seçili`;

  return (
    <div style={{ position: "relative", width: 200 }}>
      <button
        type="button"
        className="form-input"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        style={{
          width: "100%", textAlign: "left", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: selected.length === 0 ? "var(--text-secondary)" : "var(--text)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-secondary)" }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, marginTop: 2,
            background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-md)", maxHeight: 320, display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: 8, borderBottom: "1px solid var(--border-light)" }}>
              <input
                className="form-input"
                placeholder="Müşteri ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                style={{ width: "100%", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>{selected.length} seçili</span>
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} style={{ border: "none", background: "none", color: "var(--brand)", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                  Temizle
                </button>
              )}
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 13 }}>Sonuç bulunamadı</div>
              ) : (
                filtered.map((c) => {
                  const checked = selected.includes(String(c.id));
                  return (
                    <label key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      cursor: "pointer", fontSize: 13,
                      background: checked ? "var(--bg-secondary)" : "transparent",
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "?"}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
