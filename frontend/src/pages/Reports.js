import { useState, useEffect, useCallback } from "react";
import api from "../api";

const STATUS_MAP = { draft: "Taslak", approved: "Onaylandi", paid: "Odendi", cancelled: "Iptal" };
const STATUS_COLORS = { draft: "#f59e0b", approved: "#3b82f6", paid: "#10b981", cancelled: "#ef4444" };

export default function Reports() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtreler
  const [period, setPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Fatura dialog
  const [showDialog, setShowDialog] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [formMode, setFormMode] = useState("quick");

  // Fatura formu
  const [formCustomer, setFormCustomer] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formTaxRate, setFormTaxRate] = useState(20);
  const [formNotes, setFormNotes] = useState("");
  const [formQuickTotal, setFormQuickTotal] = useState("");
  const [formItems, setFormItems] = useState([{ product_name: "", quantity: 1, unit: "adet", unit_price: 0 }]);
  const [saving, setSaving] = useState(false);

  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    api.get("/auth/users").then((r) => setUsers(r.data || [])).catch(() => {});
    api.get("/customers").then((r) => setCustomers(r.data || [])).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (period) p.period = period;
      if (startDate && !period) p.start_date = startDate;
      if (endDate && !period) p.end_date = endDate;
      if (filterUser) p.user_id = filterUser;
      if (filterCustomer) p.customer_id = filterCustomer;
      if (filterStatus) p.status = filterStatus;

      const [invRes, sumRes] = await Promise.all([
        api.get("/reports/invoices", { params: p }),
        api.get("/reports/summary", { params: p }),
      ]);
      setInvoices(invRes.data || []);
      setSummary(sumRes.data || null);
    } catch (err) {
      console.error("Rapor yuklenemedi:", err);
      setInvoices([]);
      setSummary(null);
    }
    setLoading(false);
  }, [period, startDate, endDate, filterUser, filterCustomer, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCustomDateSearch = () => {
    loadData();
  };

  const getExportParams = () => {
    const p = {};
    if (period) p.period = period;
    if (startDate && !period) p.start_date = startDate;
    if (endDate && !period) p.end_date = endDate;
    if (filterUser) p.user_id = filterUser;
    if (filterCustomer) p.customer_id = filterCustomer;
    if (filterStatus) p.status = filterStatus;
    return p;
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams(getExportParams());
    const token = localStorage.getItem("token");
    window.open(`${api.defaults.baseURL}/reports/export/excel?${params}&token=${token}`, "_blank");
  };

  const handleExportPDF = () => {
    const params = new URLSearchParams(getExportParams());
    const token = localStorage.getItem("token");
    window.open(`${api.defaults.baseURL}/reports/export/pdf?${params}&token=${token}`, "_blank");
  };

  const handleInvoicePDF = (inv) => {
    const token = localStorage.getItem("token");
    window.open(`${api.defaults.baseURL}/reports/invoices/${inv.id}/pdf?token=${token}`, "_blank");
  };

  const handleStatusChange = async (inv, newStatus) => {
    try {
      await api.put(`/reports/invoices/${inv.id}`, { status: newStatus });
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`${inv.invoice_no} faturasini silmek istediginize emin misiniz?`)) return;
    try {
      await api.delete(`/reports/invoices/${inv.id}`);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const addItem = () => setFormItems([...formItems, { product_name: "", quantity: 1, unit: "adet", unit_price: 0 }]);
  const removeItem = (i) => setFormItems(formItems.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const items = [...formItems];
    items[i][field] = value;
    setFormItems(items);
  };

  const handleCreateInvoice = async () => {
    if (!formCustomer) { alert("Musteri secin"); return; }
    setSaving(true);
    try {
      const body = {
        customer_id: Number(formCustomer),
        invoice_date: formDate,
        tax_rate: formTaxRate,
        notes: formNotes || null,
      };
      if (formMode === "quick") {
        body.quick_total = Number(formQuickTotal) || 0;
        body.items = [];
      } else {
        body.items = formItems.filter((it) => it.product_name.trim());
      }
      await api.post("/reports/invoices", body);
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormCustomer("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormTaxRate(20);
    setFormNotes("");
    setFormQuickTotal("");
    setFormItems([{ product_name: "", quantity: 1, unit: "adet", unit_price: 0 }]);
    setFormMode("quick");
  };

  const detailedSubtotal = formItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  return (
    <div>
      <div className="page-toolbar">
        <h1>Raporlar & Faturalar</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-emphasized" onClick={() => { resetForm(); setShowDialog(true); }}>
            + Yeni Fatura
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI */}
        {summary && (
          <div className="kpi-strip">
            <div className="kpi-tile">
              <div className="kpi-label">Toplam Fatura</div>
              <div className="kpi-value">{summary.total_invoices}</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Toplam Ciro</div>
              <div className="kpi-value sm">{Number(summary.total_revenue).toLocaleString("tr-TR")}<span className="kpi-unit">TL</span></div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Toplam KDV</div>
              <div className="kpi-value sm">{Number(summary.total_tax).toLocaleString("tr-TR")}<span className="kpi-unit">TL</span></div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Odenen</div>
              <div className="kpi-value" style={{ color: "#10b981" }}>{summary.paid_count}</div>
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
                <button className="btn btn-emphasized btn-sm" onClick={handleCustomDateSearch}>Ara</button>
              </>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Satis Temsilcisi</div>
              <select className="form-input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 160 }}>
                <option value="">Tumu</option>
                {users.filter((u) => u.role === "sales_rep").map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Musteri</div>
              <select className="form-input" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} style={{ width: 160 }}>
                <option value="">Tumu</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Durum</div>
              <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 130 }}>
                <option value="">Tumu</option>
                <option value="draft">Taslak</option>
                <option value="approved">Onaylandi</option>
                <option value="paid">Odendi</option>
                <option value="cancelled">Iptal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Disa Aktarma */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn" onClick={handleExportExcel} style={{ background: "#10b981", color: "#fff" }}>
            Excel'e Aktar
          </button>
          <button className="btn" onClick={handleExportPDF} style={{ background: "#ef4444", color: "#fff" }}>
            PDF'e Aktar
          </button>
        </div>

        {/* Fatura Listesi */}
        <div className="panel">
          <div className="panel-header">
            <h3>Faturalar</h3>
            <span className="panel-info">{invoices.length} kayit</span>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : invoices.length === 0 ? (
            <div className="empty-state"><p>Fatura bulunamadi. Filtrelerinizi degistirin veya yeni fatura olusturun.</p></div>
          ) : isMobile ? (
            /* Mobil kart layout */
            <div style={{ padding: 12 }}>
              {invoices.map((inv) => (
                <div key={inv.id} style={{
                  padding: 12, marginBottom: 8, borderRadius: 10,
                  background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{inv.invoice_no}</strong>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      background: STATUS_COLORS[inv.status] + "22", color: STATUS_COLORS[inv.status],
                    }}>{STATUS_MAP[inv.status]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                    {inv.customer_name} &middot; {inv.user_name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                    {new Date(inv.invoice_date).toLocaleDateString("tr-TR")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 15, color: "var(--brand)" }}>
                      {Number(inv.total).toLocaleString("tr-TR")} TL
                    </strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-xs" onClick={() => setShowDetail(inv)}>Detay</button>
                      <button className="btn btn-xs" onClick={() => handleInvoicePDF(inv)}>PDF</button>
                    </div>
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
                    <th>Fatura No</th>
                    <th>Tarih</th>
                    <th>Musteri</th>
                    <th>Satis Temsilcisi</th>
                    <th>Ara Toplam</th>
                    <th>KDV</th>
                    <th>Toplam</th>
                    <th>Durum</th>
                    <th>Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="cell-bold" style={{ cursor: "pointer", color: "var(--brand)" }} onClick={() => setShowDetail(inv)}>
                        {inv.invoice_no}
                      </td>
                      <td>{new Date(inv.invoice_date).toLocaleDateString("tr-TR")}</td>
                      <td className="cell-bold">{inv.customer_name}</td>
                      <td>{inv.user_name}</td>
                      <td className="cell-mono">{Number(inv.subtotal).toLocaleString("tr-TR")} TL</td>
                      <td className="cell-mono">{Number(inv.tax_amount).toLocaleString("tr-TR")} TL</td>
                      <td className="cell-mono" style={{ fontWeight: 700 }}>{Number(inv.total).toLocaleString("tr-TR")} TL</td>
                      <td>
                        <select
                          className="form-input"
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv, e.target.value)}
                          style={{
                            width: 110, fontSize: 11, fontWeight: 700, padding: "4px 6px",
                            color: STATUS_COLORS[inv.status], borderColor: STATUS_COLORS[inv.status],
                          }}
                        >
                          <option value="draft">Taslak</option>
                          <option value="approved">Onaylandi</option>
                          <option value="paid">Odendi</option>
                          <option value="cancelled">Iptal</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-xs" onClick={() => setShowDetail(inv)}>Detay</button>
                          <button className="btn btn-xs" onClick={() => handleInvoicePDF(inv)}>PDF</button>
                          <button className="btn btn-xs btn-negative" onClick={() => handleDeleteInvoice(inv)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fatura Detay Dialog */}
      {showDetail && (
        <div className="dialog-overlay" onClick={() => setShowDetail(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? "95vw" : 650 }}>
            <div className="dialog-header">
              <h2>Fatura Detay - {showDetail.invoice_no}</h2>
              <button className="dialog-close" onClick={() => setShowDetail(null)}>x</button>
            </div>
            <div className="dialog-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Musteri</div>
                  <div style={{ fontWeight: 700 }}>{showDetail.customer_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Satis Temsilcisi</div>
                  <div style={{ fontWeight: 700 }}>{showDetail.user_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Tarih</div>
                  <div style={{ fontWeight: 600 }}>{new Date(showDetail.invoice_date).toLocaleDateString("tr-TR")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Durum</div>
                  <div style={{ fontWeight: 700, color: STATUS_COLORS[showDetail.status] }}>{STATUS_MAP[showDetail.status]}</div>
                </div>
                {showDetail.customer_tax_number && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Vergi No</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.customer_tax_number}</div>
                  </div>
                )}
                {showDetail.customer_tax_office && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Vergi Dairesi</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.customer_tax_office}</div>
                  </div>
                )}
                {showDetail.customer_address && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Adres</div>
                    <div style={{ fontWeight: 600 }}>{showDetail.customer_address}</div>
                  </div>
                )}
              </div>

              {/* Kalemler */}
              {showDetail.items && showDetail.items.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Urun Kalemleri</div>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>Urun</th><th>Miktar</th><th>Birim Fiyat</th><th>Tutar</th></tr>
                    </thead>
                    <tbody>
                      {showDetail.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.product_name}</td>
                          <td>{it.quantity} {it.unit}</td>
                          <td className="cell-mono">{Number(it.unit_price).toLocaleString("tr-TR")} TL</td>
                          <td className="cell-mono">{Number(it.line_total).toLocaleString("tr-TR")} TL</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>Ara Toplam:</span>
                  <strong>{Number(showDetail.subtotal).toLocaleString("tr-TR")} TL</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>KDV (%{showDetail.tax_rate}):</span>
                  <strong>{Number(showDetail.tax_amount).toLocaleString("tr-TR")} TL</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--brand)", borderTop: "2px solid var(--border)", paddingTop: 8 }}>
                  <span>GENEL TOPLAM:</span>
                  <span>{Number(showDetail.total).toLocaleString("tr-TR")} TL</span>
                </div>
              </div>

              {showDetail.notes && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                  <strong>Notlar:</strong> {showDetail.notes}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => handleInvoicePDF(showDetail)} style={{ background: "#ef4444", color: "#fff" }}>
                  PDF Indir
                </button>
                <button className="btn" onClick={() => setShowDetail(null)}>Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Fatura Dialog */}
      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isMobile ? "95vw" : 650 }}>
            <div className="dialog-header">
              <h2>Yeni Fatura Olustur</h2>
              <button className="dialog-close" onClick={() => setShowDialog(false)}>x</button>
            </div>
            <div className="dialog-body">
              {/* Mod secimi */}
              <div className="seg-bar" style={{ marginBottom: 16 }}>
                <button className={`seg-item ${formMode === "quick" ? "active" : ""}`} onClick={() => setFormMode("quick")}>
                  Hizli Fis
                </button>
                <button className={`seg-item ${formMode === "detailed" ? "active" : ""}`} onClick={() => setFormMode("detailed")}>
                  Detayli Fatura
                </button>
              </div>

              <div className="form-group">
                <label>Musteri</label>
                <select className="form-input" value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)}>
                  <option value="">Musteri Secin...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Tarih</label>
                  <input className="form-input" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>KDV Orani (%)</label>
                  <input className="form-input" type="number" value={formTaxRate} onChange={(e) => setFormTaxRate(Number(e.target.value))} />
                </div>
              </div>

              {formMode === "quick" ? (
                <div className="form-group">
                  <label>Toplam Tutar (KDV Haric)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={formQuickTotal} onChange={(e) => setFormQuickTotal(e.target.value)} />
                  {formQuickTotal && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      KDV: {(Number(formQuickTotal) * formTaxRate / 100).toLocaleString("tr-TR")} TL &middot;
                      Toplam: {(Number(formQuickTotal) * (1 + formTaxRate / 100)).toLocaleString("tr-TR")} TL
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Urun Kalemleri</div>
                  {formItems.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input className="form-input" placeholder="Urun adi" value={item.product_name}
                        onChange={(e) => updateItem(i, "product_name", e.target.value)}
                        style={{ flex: 2, minWidth: 120 }} />
                      <input className="form-input" type="number" placeholder="Miktar" value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                        style={{ width: 70 }} />
                      <input className="form-input" placeholder="Birim" value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        style={{ width: 70 }} />
                      <input className="form-input" type="number" placeholder="Fiyat" value={item.unit_price}
                        onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))}
                        style={{ width: 90 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 70, textAlign: "right" }}>
                        {(item.quantity * item.unit_price).toLocaleString("tr-TR")} TL
                      </span>
                      {formItems.length > 1 && (
                        <button className="btn btn-xs btn-negative" onClick={() => removeItem(i)}>x</button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-sm" onClick={addItem} style={{ marginBottom: 8 }}>+ Kalem Ekle</button>
                  <div style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: "var(--brand)" }}>
                    Ara Toplam: {detailedSubtotal.toLocaleString("tr-TR")} TL &middot;
                    KDV: {(detailedSubtotal * formTaxRate / 100).toLocaleString("tr-TR")} TL &middot;
                    Toplam: {(detailedSubtotal * (1 + formTaxRate / 100)).toLocaleString("tr-TR")} TL
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Notlar</label>
                <textarea className="form-input" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Siparis veya fatura notu..." />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="btn" onClick={() => setShowDialog(false)}>Iptal</button>
                <button className="btn btn-emphasized" onClick={handleCreateInvoice} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Fatura Olustur"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
