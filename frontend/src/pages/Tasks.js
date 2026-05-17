import { useState, useEffect, useCallback } from "react";
import api from "../api";

const PRIORITIES = [
  { key: "low", label: "Düşük", color: "#94a3b8" },
  { key: "normal", label: "Normal", color: "#6366f1" },
  { key: "high", label: "Yüksek", color: "#f59e0b" },
  { key: "urgent", label: "Acil", color: "#ef4444" },
];

const STATUSES = [
  { key: "open", label: "Bekliyor", color: "#6366f1" },
  { key: "in_progress", label: "Devam ediyor", color: "#f59e0b" },
  { key: "done", label: "Tamamlandı", color: "#10b981" },
  { key: "cancelled", label: "İptal", color: "#94a3b8" },
];

function getPrio(k) { return PRIORITIES.find(p => p.key === k) || PRIORITIES[1]; }
function getStat(k) { return STATUSES.find(s => s.key === k) || STATUSES[0]; }

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [reps, setReps] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all"); // all | open | done | overdue
  const [repFilter, setRepFilter] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", assigned_to_id: "",
    customer_id: "", priority: "normal", due_date: "",
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/tasks/"),
      api.get("/auth/users"),
      api.get("/customers/", { params: { limit: 500 } }),
    ])
      .then(([t, u, c]) => {
        setTasks(t.data || []);
        setReps((u.data || []).filter(x => x.role === "sales_rep"));
        setCustomers(c.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.assigned_to_id) return;
    setSaving(true);
    try {
      await api.post("/tasks/", {
        ...form,
        assigned_to_id: Number(form.assigned_to_id),
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        due_date: form.due_date || null,
      });
      setForm({ title: "", description: "", assigned_to_id: "", customer_id: "", priority: "normal", due_date: "" });
      setShowForm(false);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    await api.delete(`/tasks/${id}`);
    loadData();
  };

  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter(t => {
    if (repFilter && t.assigned_to_id !== Number(repFilter)) return false;
    if (filter === "open") return t.status === "open" || t.status === "in_progress";
    if (filter === "done") return t.status === "done";
    if (filter === "overdue") return t.due_date && t.due_date < today && t.status !== "done";
    return true;
  });

  const stats = {
    total: tasks.length,
    open: tasks.filter(t => t.status === "open" || t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
    overdue: tasks.filter(t => t.due_date && t.due_date < today && t.status !== "done").length,
  };

  return (
    <div>
      <div className="page-toolbar">
        <h1>Görev Yönetimi</h1>
        <div className="toolbar-actions">
          <button className="btn btn-emphasized" onClick={() => setShowForm(!showForm)}>
            {showForm ? "İptal" : "+ Yeni Görev"}
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-label">Toplam</div>
            <div className="kpi-value">{stats.total}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Aktif</div>
            <div className="kpi-value" style={{ color: "#6366f1" }}>{stats.open}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Tamamlanan</div>
            <div className="kpi-value" style={{ color: "#10b981" }}>{stats.done}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Gecikmiş</div>
            <div className="kpi-value" style={{ color: "#ef4444" }}>{stats.overdue}</div>
          </div>
        </div>

        {showForm && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Yeni Görev Oluştur</h3></div>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label>Başlık</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="örn. Çalışkan Otomotiv'le takip görüşmesi"
                />
              </div>
              <div className="form-group">
                <label>Açıklama (opsiyonel)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Detaylar, koşullar, beklentiler..."
                  style={{ resize: "vertical", minHeight: 70 }}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Atanacak Kişi</label>
                  <select
                    className="form-input"
                    value={form.assigned_to_id}
                    onChange={(e) => setForm(p => ({ ...p, assigned_to_id: e.target.value }))}
                  >
                    <option value="">Seç...</option>
                    {reps.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} {r.cluster_index != null ? `(Bölge ${r.cluster_index + 1})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Öncelik</label>
                  <select
                    className="form-input"
                    value={form.priority}
                    onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))}
                  >
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>İlgili Müşteri (opsiyonel)</label>
                  <select
                    className="form-input"
                    value={form.customer_id}
                    onChange={(e) => setForm(p => ({ ...p, customer_id: e.target.value }))}
                  >
                    <option value="">— Yok —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Son Tarih (opsiyonel)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
              </div>
              <button
                className="btn btn-emphasized"
                onClick={handleCreate}
                disabled={saving || !form.title.trim() || !form.assigned_to_id}
              >
                {saving ? "Kaydediliyor..." : "Görev Ata"}
              </button>
            </div>
          </div>
        )}

        {/* Filtre */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="seg-bar">
            <button className={`seg-item ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Tümü ({stats.total})</button>
            <button className={`seg-item ${filter === "open" ? "active" : ""}`} onClick={() => setFilter("open")}>Aktif ({stats.open})</button>
            <button className={`seg-item ${filter === "done" ? "active" : ""}`} onClick={() => setFilter("done")}>Tamamlanan ({stats.done})</button>
            <button className={`seg-item ${filter === "overdue" ? "active" : ""}`} onClick={() => setFilter("overdue")}>Gecikmiş ({stats.overdue})</button>
          </div>
          <select className="form-input" style={{ width: 220 }} value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
            <option value="">Tüm Temsilciler</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="panel" style={{ padding: 60, textAlign: "center" }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="panel" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <h3>Görev yok</h3>
            <p style={{ color: "#64748b" }}>Yeni bir görev oluşturarak temsilcilere atayabilirsiniz.</p>
          </div>
        ) : (
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Atanan</th>
                    <th>Müşteri</th>
                    <th>Öncelik</th>
                    <th>Durum</th>
                    <th>Son Tarih</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const prio = getPrio(t.priority);
                    const stat = getStat(t.status);
                    const overdue = t.due_date && t.due_date < today && t.status !== "done";
                    return (
                      <tr key={t.id}>
                        <td className="cell-bold">
                          {t.title}
                          {t.description ? (
                            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, marginTop: 2, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.description}
                            </div>
                          ) : null}
                        </td>
                        <td>{t.assigned_to_name}</td>
                        <td className="cell-dim">{t.customer?.name || "—"}</td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 6,
                            fontSize: 11, fontWeight: 700, color: "#fff", background: prio.color,
                          }}>{prio.label}</span>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 6,
                            fontSize: 11, fontWeight: 700, color: "#fff", background: stat.color,
                          }}>{stat.label}</span>
                        </td>
                        <td className={overdue ? "cell-bold" : "cell-dim"} style={overdue ? { color: "#ef4444" } : {}}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString("tr-TR") : "—"}
                        </td>
                        <td className="cell-right">
                          <button className="btn btn-negative btn-xs" onClick={() => handleDelete(t.id)}>Sil</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
