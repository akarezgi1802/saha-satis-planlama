import { useState, useEffect, useCallback } from "react";
import api from "../api";

// Marka renkleri — Frito-Lay portföyü
const BRAND_COLORS = {
  "Lay's": { bg: "#fcd34d", fg: "#92400e", emoji: "🥔" },
  "Doritos": { bg: "#dc2626", fg: "#fff", emoji: "🌶️" },
  "Cheetos": { bg: "#f97316", fg: "#fff", emoji: "🧀" },
  "Ruffles": { bg: "#1e40af", fg: "#fff", emoji: "〰️" },
  "Cipsi": { bg: "#0891b2", fg: "#fff", emoji: "🥨" },
  "Tang": { bg: "#fbbf24", fg: "#7c2d12", emoji: "🍊" },
};

function brandColor(b) {
  return BRAND_COLORS[b] || { bg: "#6366f1", fg: "#fff", emoji: "📦" };
}

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR");
}

function daysLeft(until) {
  if (!until) return null;
  const ms = new Date(until) - new Date();
  const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return d;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all"); // all | active | expired
  const [brandFilter, setBrandFilter] = useState("");

  const [form, setForm] = useState({
    title: "",
    brand: "Lay's",
    description: "",
    discount_text: "",
    valid_from: "",
    valid_until: "",
  });
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/campaigns/", { params: { active_only: false } }),
      api.get("/campaigns/brands"),
    ])
      .then(([c, b]) => {
        setCampaigns(c.data || []);
        setBrands(b.data?.brands || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", brand: "Lay's", description: "", discount_text: "", valid_from: "", valid_until: "" });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      title: c.title,
      brand: c.brand,
      description: c.description,
      discount_text: c.discount_text || "",
      valid_from: c.valid_from || "",
      valid_until: c.valid_until || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        discount_text: form.discount_text || null,
      };
      if (editing) {
        await api.put(`/campaigns/${editing.id}`, payload);
      } else {
        await api.post("/campaigns/", payload);
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu kampanyayı silmek istediğinize emin misiniz?")) return;
    await api.delete(`/campaigns/${id}`);
    loadData();
  };

  const toggleActive = async (c) => {
    await api.put(`/campaigns/${c.id}`, { is_active: c.is_active ? 0 : 1 });
    loadData();
  };

  const filtered = campaigns.filter((c) => {
    if (brandFilter && c.brand !== brandFilter) return false;
    const left = daysLeft(c.valid_until);
    if (filter === "active") return c.is_active && (left == null || left >= 0);
    if (filter === "expired") return left != null && left < 0;
    return true;
  });

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.is_active && (daysLeft(c.valid_until) == null || daysLeft(c.valid_until) >= 0)).length,
    expired: campaigns.filter((c) => daysLeft(c.valid_until) != null && daysLeft(c.valid_until) < 0).length,
    brands: new Set(campaigns.map((c) => c.brand)).size,
  };

  return (
    <div>
      <div className="page-toolbar">
        <h1>Kampanyalar</h1>
        <div className="toolbar-actions">
          {isAdmin && (
            <button className="btn btn-emphasized" onClick={openCreate}>
              + Yeni Kampanya
            </button>
          )}
        </div>
      </div>
      <div className="page-body">
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-label">Toplam Kampanya</div>
            <div className="kpi-value">{stats.total}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Aktif</div>
            <div className="kpi-value" style={{ color: "#10b981" }}>{stats.active}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Süresi Bitmiş</div>
            <div className="kpi-value" style={{ color: "#94a3b8" }}>{stats.expired}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Marka Sayısı</div>
            <div className="kpi-value">{stats.brands}</div>
          </div>
        </div>

        {/* Filtre bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div className="seg-bar">
            <button className={`seg-item ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Tümü</button>
            <button className={`seg-item ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>Aktif</button>
            <button className={`seg-item ${filter === "expired" ? "active" : ""}`} onClick={() => setFilter("expired")}>Süresi Biten</button>
          </div>
          <select className="form-input" style={{ width: 180 }} value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Tüm Markalar</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3 style={{ marginBottom: 8 }}>Kampanya yok</h3>
            <p style={{ color: "#64748b" }}>
              {isAdmin
                ? "Yeni bir kampanya ekleyerek satış temsilcilerine duyurabilirsiniz."
                : "Aktif kampanya yok. Yeni eklenince burada görünür."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {filtered.map((c) => {
              const bc = brandColor(c.brand);
              const left = daysLeft(c.valid_until);
              const expired = left != null && left < 0;
              return (
                <div key={c.id} className="panel" style={{ overflow: "hidden", marginBottom: 0, opacity: c.is_active && !expired ? 1 : 0.6 }}>
                  {/* Banner */}
                  <div style={{ background: bc.bg, color: bc.fg, padding: "16px 20px", position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                        {bc.emoji} {c.brand}
                      </span>
                      {c.discount_text ? (
                        <span style={{
                          background: "rgba(0,0,0,0.15)", padding: "4px 10px",
                          borderRadius: 20, fontSize: 12, fontWeight: 800,
                        }}>
                          {c.discount_text}
                        </span>
                      ) : null}
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, marginTop: 10, lineHeight: 1.2 }}>{c.title}</h3>
                  </div>

                  {/* Body */}
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {c.description}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                        {c.valid_from || c.valid_until ? (
                          <>
                            {fmtDate(c.valid_from)} → {fmtDate(c.valid_until)}
                            {left != null && (
                              <div style={{ marginTop: 2, color: expired ? "#ef4444" : (left <= 3 ? "#f59e0b" : "#10b981") }}>
                                {expired ? "süresi bitti" : `${left} gün kaldı`}
                              </div>
                            )}
                          </>
                        ) : "Süresiz"}
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-default btn-xs"
                            onClick={() => toggleActive(c)}
                            title={c.is_active ? "Pasifleştir" : "Aktifleştir"}
                          >
                            {c.is_active ? "Pasif yap" : "Aktif yap"}
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c)}>Düzenle</button>
                          <button className="btn btn-negative btn-xs" onClick={() => handleDelete(c.id)}>Sil</button>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                      Oluşturan: {c.author_name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="dialog-overlay" onClick={() => setShowForm(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editing ? "Kampanya Düzenle" : "Yeni Kampanya"}</h2>
              <p>Frito-Lay marka portföyü içinden seç</p>
            </div>
            <div className="dialog-body">
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Başlık</label>
                  <input
                    className="form-input"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="örn. Lay's Klasik 100gr %15 İndirim"
                  />
                </div>
                <div className="form-group">
                  <label>Marka</label>
                  <select
                    className="form-input"
                    value={form.brand}
                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                  >
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>İndirim/Promosyon Metni</label>
                <input
                  className="form-input"
                  value={form.discount_text}
                  onChange={(e) => setForm((p) => ({ ...p, discount_text: e.target.value }))}
                  placeholder="örn. %15 indirim · 2 alana 1 bedava · 3+1"
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Kampanya kartında banner üzerinde büyük gösterilir
                </div>
              </div>

              <div className="form-group">
                <label>Açıklama</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Kampanya detayı: hangi ürünlerde geçerli, koşullar, hedef satış miktarı vs."
                  style={{ resize: "vertical", minHeight: 90 }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Başlangıç Tarihi</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Bitiş Tarihi</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowForm(false)}>İptal</button>
              <button
                className="btn btn-emphasized"
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.description.trim()}
              >
                {saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Yayınla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
