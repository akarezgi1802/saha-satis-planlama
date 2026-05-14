import { useState, useEffect, useCallback } from "react";
import api from "../api";

const CATEGORIES = [
  { key: "general", label: "Genel", color: "#6366f1" },
  { key: "campaign", label: "Kampanya", color: "#f59e0b" },
  { key: "incentive", label: "Teşvik", color: "#10b981" },
  { key: "urgent", label: "Acil", color: "#ef4444" },
  { key: "info", label: "Bilgilendirme", color: "#3b82f6" },
];

function getCategoryInfo(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const loadData = useCallback(() => {
    setLoading(true);
    api.get("/announcements/")
      .then((r) => setAnnouncements(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await api.post("/announcements/", form);
      setForm({ title: "", content: "", category: "general" });
      setShowForm(false);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    await api.delete(`/announcements/${id}`);
    loadData();
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Az önce";
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return d.toLocaleDateString("tr-TR");
  };

  return (
    <div>
      <div className="page-toolbar">
        <h1>Duyurular</h1>
        <div className="toolbar-actions">
          {isAdmin && (
            <button className="btn btn-emphasized" onClick={() => setShowForm(!showForm)}>
              {showForm ? "İptal" : "Yeni Duyuru"}
            </button>
          )}
        </div>
      </div>
      <div className="page-body">
        {isAdmin && showForm && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Yeni Duyuru Oluştur</h3></div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Başlık</label>
                  <input
                    className="form-input"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Duyuru başlığı..."
                  />
                </div>
                <div className="form-group" style={{ width: "100%", maxWidth: 180, marginBottom: 0 }}>
                  <label>Kategori</label>
                  <select
                    className="form-input"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>İçerik</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Duyuru içeriğini yazın..."
                  style={{ resize: "vertical", minHeight: 80 }}
                />
              </div>
              <button
                className="btn btn-emphasized"
                onClick={handleCreate}
                disabled={saving || !form.title.trim() || !form.content.trim()}
              >
                {saving ? "Yayınlanıyor..." : "Yayınla"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}>
            <div className="spinner" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128227;</div>
            <h3 style={{ marginBottom: 8 }}>Henüz duyuru yok</h3>
            <p style={{ color: "#64748b" }}>
              {isAdmin ? "Yeni duyuru oluşturarak satış temsilcilerinize bilgi paylaşabilirsiniz." : "Yöneticiniz tarafından paylaşılan duyurular burada görünecektir."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {announcements.map((ann) => {
              const cat = getCategoryInfo(ann.category);
              return (
                <div key={ann.id} className="panel" style={{ marginBottom: 0 }}>
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{
                            display: "inline-block", padding: "2px 10px", borderRadius: 6,
                            fontSize: 11, fontWeight: 600, color: "#fff", background: cat.color,
                          }}>
                            {cat.label}
                          </span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{timeAgo(ann.created_at)}</span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#1e293b" }}>{ann.title}</h3>
                        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ann.content}</p>
                        <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                          {ann.author_name}
                        </div>
                      </div>
                      {isAdmin && (
                        <button className="btn btn-negative btn-sm" onClick={() => handleDelete(ann.id)} style={{ flexShrink: 0 }}>
                          Sil
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
