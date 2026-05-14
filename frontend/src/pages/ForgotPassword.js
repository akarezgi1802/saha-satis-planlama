import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState(null);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", {
        email,
        frontend_url: window.location.origin,
      });
      setSent(true);
      setMessage(res.data.detail);
      if (res.data.reset_link) {
        setResetLink(res.data.reset_link);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Bir hata oluştu");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <h1>Şifremi Unuttum</h1>
          <p>Kayıtlı e-posta adresinizi girin</p>
        </div>
        {sent ? (
          <div>
            <div className="auth-success" style={{ textAlign: "center" }}>
              {message}
            </div>
            {resetLink && (
              <div style={{ marginTop: 16, padding: 16, background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
                  E-posta servisi yapılandırılmadı. Aşağıdaki bağlantıyı kullanarak şifrenizi sıfırlayabilirsiniz:
                </div>
                <a
                  href={resetLink}
                  style={{ fontSize: 13, color: "#6366f1", wordBreak: "break-all", fontWeight: 600 }}
                >
                  Şifremi Sıfırla
                </a>
              </div>
            )}
            {!resetLink && (
              <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", textAlign: "center" }}>
                Lütfen gelen kutunuzu kontrol edin.
              </div>
            )}
            <div className="auth-footer" style={{ marginTop: 20 }}>
              <Link to="/login">Giriş sayfasına dön</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@firma.com"
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-emphasized auth-btn" disabled={loading}>
              {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </button>
            <div className="auth-footer" style={{ marginTop: 20 }}>
              <Link to="/login">Giriş sayfasına dön</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
