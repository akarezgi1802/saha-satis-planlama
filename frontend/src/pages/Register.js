import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

export default function Register({ onLogin }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", company: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        ...form,
        company: form.company || null,
      });
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onLogin(res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Kayıt başarısız");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <h1>Saha Satış</h1>
          <p>Karar Destek Sistemi</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Ad Soyad</label>
            <input
              className="form-input"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Adınız Soyadınız"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="ornek@firma.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="En az 6 karakter"
              required
            />
          </div>
          <div className="form-group">
            <label>Firma Adı <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opsiyonel)</span></label>
            <input
              className="form-input"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Firma adınız"
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-emphasized auth-btn" disabled={loading}>
            {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </button>
        </form>
        <div className="auth-footer">
          Zaten hesabınız var mı? <Link to="/login">Giriş Yap</Link>
        </div>
      </div>
    </div>
  );
}
