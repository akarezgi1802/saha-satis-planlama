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
  const [filterCustomer, setFilterCustomer] = useState("");

  const [showDetail, setShowDetail] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

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
    api.get("/customers").then((r) => {
      setCustomersList(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
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
      if (filterCustomer) p.customer_id = filterCustomer;

      const [salesRes, sumRes] = await Promise.all([
        api.get("/reports/sales", { params: p }),
        api.get("/reports/summary", { params: p }),
      ]);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      setSummary(sumRes.data && typeof sumRes.data === "object" ? sumRes.data : null);
    } catch (err) {
      console.error("Rapor yuklenemedi:", err);
      setError(err?.response?.data?.detail || err?.message || "Veriler yuklenemedi");
      setSales([]);
      setSummary(null);
    }
    setLoading(false);
  }, [period, startDate, endDate, filterUser, filterCustomer]);

  useEffect(() => { loadData(); }, [loadData]);

  const getExportParams = () => {
    const p = {};
    if (period) p.period = period;
    if (startDate && !period) p.start_date = startDate;
    if (endDate && !period) p.end_date = endDate;
    if (filterUser) p.user_id = filterUser;
    if (filterCustomer) p.customer_id = filterCustomer;
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
        <h1>Satis Raporlari</h1>
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
              <div className="kpi-label">Toplam Kayit</div>
              <div className="kpi-value">{safeNum(summary.total_records)}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Ziyaret Edilen</div>
              <div className="kpi-value" style={{ color: "#10b981" }}>{safeNum(summary.visited_count)}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Toplam Satis</div>
              <div className="kpi-value sm">{formatTL(summary.total_revenue)}<span className="kpi-unit">TL</span></div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Ort. Satis</div>
              <div className="kpi-value sm">{formatTL(summary.avg_sale)}<span className="kpi-unit">TL</span></div>
            </div>
          </div>
        )}

        {/* Filtreler */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header"><h3>Filtreler</h3></div>
          <div style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Donem</div>
              <select className="form-input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 140 }}>
                <option value="">Tumu</option>
                <option value="today">Bugun</option>
                <option value="week">Bu Hafta</option>
                <option value="month">Bu Ay</option>
              </select>
            </div>
            {!period && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Baslangic</div>
                  <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Bitis</div>
                  <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 150 }} />
                </div>
                <button className="btn btn-emphasized btn-sm" onClick={loadData}>Ara</button>
              </>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Satis Temsilcisi</div>
              <select className="form-input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 160 }}>
                <option value="">Tumu</option>
                {users.filter((u) => u && u.role === "sales_rep").map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || "?"}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Musteri</div>
              <select className="form-input" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} style={{ width: 160 }}>
                <option value="">Tumu</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || "?"}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ST Bazli Ozet */}
        {summary && Array.isArray(summary.rep_stats) && summary.rep_stats.length > 0 && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Temsilci Bazli Ozet</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Satis Temsilcisi</th>
                    <th>Ziyaret Sayisi</th>
                    <th>Toplam Satis</th>
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
            <h3>Satis Kayitlari</h3>
            <span className="panel-info">
              {sales.length} kayit &middot; {formatTL(totalSales)} TL
            </span>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : sales.length === 0 ? (
            <div className="empty-state"><p>Satis kaydi bulunamadi. Filtrelerinizi degistirin.</p></div>
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
                    <th>Satis Temsilcisi</th>
                    <th>Musteri</th>
                    <th>Satis Tutari</th>
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
                        }}>{v.visited === 1 ? "Evet" : "Hayir"}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
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
              <h2>Satis Detayi</h2>
              <button className="dialog-close" onClick={() => setShowDetail(null)}>x</button>
            </div>
            <div className="dialog-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Musteri</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{showDetail.customer_name || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Satis Temsilcisi</div>
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
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Giris Saati</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.check_in_at}</div>
                  </div>
                )}
                {showDetail.check_out_at && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Cikis Saati</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.check_out_at}</div>
                  </div>
                )}
              </div>

              <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "var(--brand)" }}>
                  <span>Satis Tutari</span>
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
