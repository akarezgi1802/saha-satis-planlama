import { useState, useEffect } from "react";
import api from "../api";

export default function Staff() {
  const [users, setUsers] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", company: "", role: "sales_rep", cluster_index: "", monthly_target: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    api.get("/auth/users").then((r) => setUsers(r.data));
  }

  const openCreate = () => {
    setEditUser(null);
    setForm({ full_name: "", email: "", password: "", company: "", role: "sales_rep", cluster_index: "", monthly_target: "" });
    setShowDialog(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      password: "",
      company: u.company || "",
      role: u.role,
      cluster_index: u.cluster_index ?? "",
      monthly_target: u.monthly_target ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const buildPayload = () => ({
        ...form,
        cluster_index: form.cluster_index === "" ? null : Number(form.cluster_index),
        monthly_target: form.monthly_target === "" || form.monthly_target === null ? 0 : Number(form.monthly_target),
      });
      if (editUser) {
        const payload = buildPayload();
        if (!payload.password) delete payload.password;
        await api.put(`/auth/users/${editUser.id}`, payload);
      } else {
        if (!form.password || form.password.length < 6) {
          alert("Şifre en az 6 karakter olmalı");
          setSaving(false);
          return;
        }
        await api.post("/auth/users", buildPayload());
      }
      setShowDialog(false);
      loadUsers();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`"${u.full_name}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      loadUsers();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/auth/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      loadUsers();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
  };

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const admins = users.filter((u) => u.role === "admin");
  const reps = users.filter((u) => u.role === "sales_rep");

  return (
    <div>
      <div className="page-toolbar">
        <h1>Personel Yönetimi</h1>
        <div className="toolbar-actions">
          <button className="btn btn-emphasized" onClick={openCreate}>
            + Yeni Personel Ekle
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-label">Toplam Personel</div>
            <div className="kpi-value">{users.length}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Yönetici</div>
            <div className="kpi-value">{admins.length}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Satış Temsilcisi</div>
            <div className="kpi-value">{reps.length}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Aktif</div>
            <div className="kpi-value">{users.filter((u) => u.is_active).length}</div>
          </div>
        </div>

        {reps.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3>Satış Temsilcileri ({reps.length})</h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ad Soyad</th>
                    <th>Email</th>
                    <th>Firma</th>
                    <th>Bölge (Küme)</th>
                    <th>Aylık Hedef</th>
                    <th>Durum</th>
                    <th style={{ textAlign: "right" }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((u, i) => (
                    <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                      <td className="cell-dim">{i + 1}</td>
                      <td className="cell-bold">{u.full_name}</td>
                      <td className="cell-mono">{u.email}</td>
                      <td className="cell-dim">{u.company || "—"}</td>
                      <td>
                        {u.cluster_index !== null ? (
                          <span className="badge-freq">Bölge {u.cluster_index + 1}</span>
                        ) : (
                          <span className="cell-dim">Atanmadı</span>
                        )}
                      </td>
                      <td className="cell-mono">
                        {u.monthly_target && u.monthly_target > 0
                          ? `${Number(u.monthly_target).toLocaleString("tr-TR")} ₺`
                          : <span className="cell-dim">—</span>}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${u.is_active ? "status-completed" : "status-pending"}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleActive(u)}
                          title="Durumu değiştirmek için tıklayın"
                        >
                          {u.is_active ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="cell-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Düzenle</button>
                        <button className="btn btn-negative btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDelete(u)}>Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {admins.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3>Yöneticiler ({admins.length})</h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ad Soyad</th>
                    <th>Email</th>
                    <th>Firma</th>
                    <th>Durum</th>
                    <th style={{ textAlign: "right" }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((u, i) => (
                    <tr key={u.id}>
                      <td className="cell-dim">{i + 1}</td>
                      <td className="cell-bold">{u.full_name}</td>
                      <td className="cell-mono">{u.email}</td>
                      <td className="cell-dim">{u.company || "—"}</td>
                      <td>
                        <span className="status-pill status-completed">Aktif</span>
                      </td>
                      <td className="cell-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Düzenle</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editUser ? "Personel Düzenle" : "Yeni Personel Ekle"}</h2>
              <p>{editUser ? `${editUser.full_name} — #${editUser.id}` : "Satış temsilcisi veya yönetici hesabı oluşturun"}</p>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Ad Soyad</label>
                <input className="form-input" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Adı Soyadı" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="ornek@firma.com" />
                </div>
                <div className="form-group">
                  <label>{editUser ? "Yeni Şifre (boş bırakılabilir)" : "Şifre"}</label>
                  <input className="form-input" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder={editUser ? "Değiştirmek için yazın" : "En az 6 karakter"} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Firma</label>
                  <input className="form-input" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Firma adı" />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select className="form-input" value={form.role} onChange={(e) => update("role", e.target.value)}>
                    <option value="sales_rep">Satış Temsilcisi</option>
                    <option value="admin">Yönetici</option>
                  </select>
                </div>
              </div>
              {form.role === "sales_rep" && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Atanacak Bölge (Küme No)</label>
                    <input className="form-input" type="number" min="0" value={form.cluster_index} onChange={(e) => update("cluster_index", e.target.value)} placeholder="0, 1, 2..." />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      Tamamlanmış planlardaki küme numarası
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Aylık Satış Hedefi (₺)</label>
                    <input className="form-input" type="number" min="0" step="1000" value={form.monthly_target} onChange={(e) => update("monthly_target", e.target.value)} placeholder="örn. 500000" />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      Mobil app'te hedef ilerlemesi olarak gösterilir
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowDialog(false)}>İptal</button>
              <button className="btn btn-emphasized" onClick={handleSave} disabled={saving || !form.full_name?.trim() || !form.email?.trim()}>
                {saving ? "Kaydediliyor..." : editUser ? "Güncelle" : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
