import { useState, useEffect } from "react";
import api from "../api";

export default function Profile({ user, onUserUpdate }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    company: user?.company || "",
  });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name, email: user.email, company: user.company || "" });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await api.put(`/auth/profile`, {
        full_name: form.full_name,
        email: form.email,
        company: form.company || null,
      });
      onUserUpdate(res.data);
      setMsg("Profil güncellendi");
    } catch (err) {
      setMsg("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPwMsg("");
    if (pwForm.newPw.length < 6) {
      setPwMsg("Yeni şifre en az 6 karakter olmalı");
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg("Yeni şifreler eşleşmiyor");
      return;
    }
    setPwSaving(true);
    try {
      await api.put("/auth/password", {
        current_password: pwForm.current,
        new_password: pwForm.newPw,
      });
      setPwForm({ current: "", newPw: "", confirm: "" });
      setPwMsg("Şifre başarıyla değiştirildi");
    } catch (err) {
      setPwMsg("Hata: " + (err.response?.data?.detail || err.message));
    }
    setPwSaving(false);
  };

  return (
    <div>
      <div className="page-toolbar">
        <h1>Profil Ayarları</h1>
      </div>
      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900 }}>
          <div className="panel">
            <div className="panel-header"><h3>Kişisel Bilgiler</h3></div>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label>Ad Soyad</label>
                <input className="form-input" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Firma</label>
                <input className="form-input" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
              </div>
              {msg && (
                <div className={msg.startsWith("Hata") ? "auth-error" : "auth-success"} style={{ marginBottom: 12 }}>{msg}</div>
              )}
              <button className="btn btn-emphasized" onClick={handleProfileSave} disabled={saving || !form.full_name?.trim() || !form.email?.trim()}>
                {saving ? "Kaydediliyor..." : "Güncelle"}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>Şifre Değiştir</h3></div>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label>Mevcut Şifre</label>
                <input className="form-input" type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} placeholder="Mevcut şifreniz" />
              </div>
              <div className="form-group">
                <label>Yeni Şifre</label>
                <input className="form-input" type="password" value={pwForm.newPw} onChange={(e) => setPwForm((p) => ({ ...p, newPw: e.target.value }))} placeholder="En az 6 karakter" />
              </div>
              <div className="form-group">
                <label>Yeni Şifre (Tekrar)</label>
                <input className="form-input" type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Yeni şifrenizi tekrar girin" />
              </div>
              {pwMsg && (
                <div className={pwMsg.startsWith("Hata") ? "auth-error" : "auth-success"} style={{ marginBottom: 12 }}>{pwMsg}</div>
              )}
              <button className="btn btn-emphasized" onClick={handlePasswordChange} disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm}>
                {pwSaving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
              </button>
            </div>
          </div>
        </div>

        <div className="panel" style={{ maxWidth: 900, marginTop: 16 }}>
          <div className="panel-header"><h3>Hesap Bilgileri</h3></div>
          <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Rol</div>
              <div style={{ fontWeight: 600 }}>{user?.role === "admin" ? "Yönetici" : "Satış Temsilcisi"}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Hesap Durumu</div>
              <div style={{ fontWeight: 600, color: "#10b981" }}>Aktif</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Kayıt Tarihi</div>
              <div style={{ fontWeight: 600 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "—"}</div>
            </div>
            {user?.role === "sales_rep" && (
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Atanmış Bölge</div>
                <div style={{ fontWeight: 600 }}>{user.cluster_index !== null ? `Bölge ${user.cluster_index + 1}` : "Atanmadı"}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
