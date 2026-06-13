import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [stCount, setStCount] = useState(4);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPlans();
  }, []);

  // Calisan plan varsa otomatik yenile (sayfadan cikip geri geldildiginde)
  useEffect(() => {
    const hasRunning = plans.some((p) =>
      ["clustering", "assignment", "routing"].includes(p.status)
    );
    if (!hasRunning) return;
    const interval = setInterval(loadPlans, 5000);
    return () => clearInterval(interval);
  }, [plans]);

  function loadPlans() {
    api.get("/plans/").then((r) => setPlans(r.data));
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post("/plans/", { name: name.trim(), st_count: Number(stCount) });
      setShowModal(false);
      setName("");
      setStCount(4);
      navigate(`/plans/${res.data.id}`);
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setCreating(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Bu planı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/plans/${id}`);
      loadPlans();
    } catch (err) {
      alert("Silme hatası: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleActivate = async (e, id) => {
    e.stopPropagation();
    try {
      await api.post(`/plans/${id}/activate`);
      loadPlans();
    } catch (err) {
      alert("Aktif yapma hatası: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <div className="page-toolbar">
        <h1>Plan Yönetimi</h1>
        <div className="toolbar-actions">
          <button className="btn btn-emphasized" onClick={() => setShowModal(true)}>
            + Yeni Plan
          </button>
        </div>
      </div>
      <div className="page-body">
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "10px 14px",
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          Yalnızca AKTİF plan Gösterge Paneli'nde ve Satış Temsilcileri'nin "Benim Planım" sayfasında görünür. Aynı anda yalnızca 1 plan aktif olabilir.
        </div>
        <div className="panel">
          {plans.length === 0 ? (
            <div className="empty-state">
              <p>Henüz plan oluşturulmadı. Yeni bir plan oluşturarak başlayabilirsiniz.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Plan Adı</th>
                  <th>ST Sayısı</th>
                  <th>Durum</th>
                  <th>Aktif</th>
                  <th>Toplam Mesafe</th>
                  <th>Çözüm Süresi</th>
                  <th>Oluşturulma Tarihi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const isActive = p.is_active === 1;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/plans/${p.id}`)}
                      style={{
                        cursor: "pointer",
                        borderLeft: isActive ? "4px solid #10b981" : undefined,
                        background: isActive ? "#f0fdf4" : undefined,
                      }}
                    >
                      <td className="cell-bold">{p.name}</td>
                      <td>{p.st_count}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {isActive ? (
                          <span
                            style={{
                              display: "inline-block",
                              background: "#10b98122",
                              color: "#10b981",
                              padding: "3px 10px",
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              letterSpacing: 0.3,
                            }}
                          >
                            ● AKTİF
                          </span>
                        ) : p.status === "completed" ? (
                          <button
                            className="btn btn-sm"
                            style={{
                              background: "#10b981",
                              color: "#fff",
                              border: "none",
                            }}
                            onClick={(e) => handleActivate(e, p.id)}
                          >
                            Aktif Yap
                          </button>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                      <td className="cell-mono">
                        {p.total_distance != null ? p.total_distance.toFixed(2) + " km" : "—"}
                      </td>
                      <td className="cell-mono">
                        {p.solve_time_seconds != null ? formatDuration(p.solve_time_seconds) : "—"}
                      </td>
                      <td className="cell-dim">{new Date(p.created_at).toLocaleString("tr-TR")}</td>
                      <td className="cell-right">
                        <button
                          className="btn btn-negative btn-sm"
                          onClick={(e) => handleDelete(e, p.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="dialog-overlay" onClick={() => setShowModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Yeni Plan Oluştur</h2>
              <p>Optimizasyon parametreleri otomatik uygulanır</p>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Plan Adı</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örneğin: Mayıs 2026 Planı"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Satış Temsilcisi (ST) Sayısı</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={stCount}
                  onChange={(e) => setStCount(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowModal(false)}>
                İptal
              </button>
              <button
                className="btn btn-emphasized"
                onClick={handleCreate}
                disabled={!name.trim() || creating}
              >
                {creating ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "completed")
    return <span className="status status-completed"><span className="status-dot" />Tamamlandi</span>;
  if (status === "clustering")
    return <span className="status status-running"><span className="status-dot" />Kumeleme (MILP)</span>;
  if (status === "assignment")
    return <span className="status status-running"><span className="status-dot" />Haftalik Atama</span>;
  if (status === "routing")
    return <span className="status status-running"><span className="status-dot" />Rota Optimizasyonu</span>;
  if (status === "pending")
    return <span className="status status-pending"><span className="status-dot" />Bekliyor</span>;
  if (status === "cancelled")
    return <span className="status status-pending"><span className="status-dot" />Durduruldu</span>;
  if (status === "interrupted")
    return <span className="status status-error"><span className="status-dot" />Kesintiye Ugradi</span>;
  if (status && status.startsWith("error:"))
    return <span className="status status-error" title={status}><span className="status-dot" />Hata</span>;
  return <span className="status status-error"><span className="status-dot" />Hata</span>;
}

function formatDuration(seconds) {
  if (seconds < 60) return seconds.toFixed(1) + " sn";
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min} dk ${sec} sn`;
}
