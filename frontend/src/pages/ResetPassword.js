import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Bir hata oluştu");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">SS</div>
            <h1>Geçersiz Bağlantı</h1>
          </div>
          <div className="auth-error" style={{ textAlign: "center" }}>Sıfırlama bağlantısı geçersiz.</div>
          <div className="auth-footer" style={{ marginTop: 20 }}>
            <Link to="/login">Giriş sayfasına dön</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <h1>Yeni Şifre Belirle</h1>
          <p>Yeni şifrenizi girin</p>
        </div>
        {done ? (
          <div>
            <div className="auth-success" style={{ textAlign: "center" }}>
              Şifreniz başarıyla değiştirildi!
            </div>
            <div className="auth-footer" style={{ marginTop: 20 }}>
              <Link to="/login">Giriş Yap</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Yeni Şifre</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                required
              />
            </div>
            <div className="form-group">
              <label>Yeni Şifre (Tekrar)</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Şifrenizi tekrar girin"
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-emphasized auth-btn" disabled={loading}>
              {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
