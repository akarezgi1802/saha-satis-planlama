import { useState, useEffect } from "react";
import api from "../api";

// Yakıt türü bilgileri — CO₂ katsayısı = yoğunluk (kg/L) × emisyon faktörü (kg CO₂/kg)
const FUEL_INFO = {
  diesel: { label: "Dizel", co2: 2.65, color: "#64748b", bg: "#64748b18" },
  gasoline: { label: "Benzin", co2: 2.35, color: "#f59e0b", bg: "#f59e0b18" },
  lpg: { label: "LPG", co2: 1.63, color: "#3b82f6", bg: "#3b82f618" },
  electric: { label: "Elektrik", co2: 0, color: "#10b981", bg: "#10b98118" },
};
const fuelLabel = (f) => FUEL_INFO[f]?.label || f;

export default function Fleet() {
  const [tab, setTab] = useState("types");
  const [types, setTypes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [editType, setEditType] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [typeForm, setTypeForm] = useState({ name: "", fuel_type: "diesel", fuel_consumption_l_per_100km: 7.5, is_default: false });
  const [vehicleForm, setVehicleForm] = useState({ plate_number: "", vehicle_type_id: "", assigned_user_id: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    api.get("/fleet/vehicle-types").then((r) => setTypes(r.data)).catch(() => {});
    api.get("/fleet/vehicles").then((r) => setVehicles(r.data)).catch(() => {});
    api.get("/auth/users").then((r) => setUsers(Array.isArray(r.data) ? r.data.filter((u) => u.role === "sales_rep") : [])).catch(() => {});
  }

  // ── Araç Tipi CRUD ──
  const openCreateType = () => {
    setEditType(null);
    setTypeForm({ name: "", fuel_type: "diesel", fuel_consumption_l_per_100km: 7.5, is_default: false });
    setShowTypeDialog(true);
  };
  const openEditType = (t) => {
    setEditType(t);
    setTypeForm({ name: t.name, fuel_type: t.fuel_type, fuel_consumption_l_per_100km: t.fuel_consumption_l_per_100km, is_default: t.is_default });
    setShowTypeDialog(true);
  };
  const saveType = async () => {
    setSaving(true);
    try {
      if (editType) {
        await api.put(`/fleet/vehicle-types/${editType.id}`, typeForm);
      } else {
        await api.post("/fleet/vehicle-types", typeForm);
      }
      setShowTypeDialog(false);
      loadAll();
    } catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
    setSaving(false);
  };
  const deleteType = async (id) => {
    if (!window.confirm("Bu araç tipini silmek istediğinize emin misiniz?")) return;
    try { await api.delete(`/fleet/vehicle-types/${id}`); loadAll(); }
    catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
  };

  // ── Araç CRUD ──
  const openCreateVehicle = () => {
    setEditVehicle(null);
    setVehicleForm({ plate_number: "", vehicle_type_id: types[0]?.id || "", assigned_user_id: "", notes: "" });
    setShowVehicleDialog(true);
  };
  const openEditVehicle = (v) => {
    setEditVehicle(v);
    setVehicleForm({ plate_number: v.plate_number, vehicle_type_id: v.vehicle_type_id, assigned_user_id: v.assigned_user_id || "", notes: v.notes || "" });
    setShowVehicleDialog(true);
  };
  const saveVehicle = async () => {
    setSaving(true);
    try {
      const payload = { ...vehicleForm, assigned_user_id: vehicleForm.assigned_user_id || null };
      if (editVehicle) {
        await api.put(`/fleet/vehicles/${editVehicle.id}`, payload);
      } else {
        await api.post("/fleet/vehicles", payload);
      }
      setShowVehicleDialog(false);
      loadAll();
    } catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
    setSaving(false);
  };
  const deleteVehicle = async (id) => {
    if (!window.confirm("Bu aracı silmek istediğinize emin misiniz?")) return;
    try { await api.delete(`/fleet/vehicles/${id}`); loadAll(); }
    catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
  };

  // Atanmamış ST'ler
  const assignedIds = new Set(vehicles.map((v) => v.assigned_user_id).filter(Boolean));

  return (
    <div>
      <div className="page-toolbar">
        <h1>Filo Yönetimi</h1>
        <div className="toolbar-actions">
          {tab === "types" && (
            <button className="btn btn-emphasized" onClick={openCreateType}>+ Yeni Araç Tipi</button>
          )}
          {tab === "vehicles" && (
            <button className="btn btn-emphasized" onClick={openCreateVehicle} disabled={types.length === 0}>+ Yeni Araç</button>
          )}
        </div>
      </div>
      <div className="page-body">
        {/* Bilgilendirme kutusu — Filo yönetimi ne işe yarar */}
        <div style={{
          display: "flex", gap: 14, padding: 16, marginBottom: 16, borderRadius: 12,
          background: "linear-gradient(135deg, #10b98112, #3b82f612)", border: "1px solid #10b98133",
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🌱</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
            <strong>Filo yönetimi neden var?</strong> Satış temsilcilerinin saha ziyaretlerinde harcadığı yakıtı ve oluşan
            <strong> karbon emisyonunu (CO₂)</strong> hesaplamak için kullanılır.
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, color: "var(--text-secondary)" }}>
              <span><strong style={{ color: "var(--text)" }}>1. Araç Tipi tanımla:</strong> Yakıt türü (dizel/benzin/LPG) ve yakıt tüketimi (L/100km) bilgisini girersin. Örn: "Dizel Kamyonet — 9.5 L/100km".</span>
              <span><strong style={{ color: "var(--text)" }}>2. Araç ekle ve ST'ye ata:</strong> Plaka tanımlar, bir araç tipi seçer ve bir satış temsilcisine atarsın.</span>
              <span><strong style={{ color: "var(--text)" }}>3. Otomatik hesaplama:</strong> ST ziyaretlerde giriş/çıkış (check-in) yaptıkça GPS'ten katedilen mesafe bulunur. <em>Mesafe × yakıt tüketimi × CO₂ katsayısı</em> ile günlük emisyon hesaplanır.</span>
              <span><strong style={{ color: "var(--text)" }}>4. Raporla:</strong> Sonuçlar <strong>Gösterge Paneli</strong>'ndeki karbon grafiklerinde ve <strong>Performans → Karbon</strong> sekmesinde görünür.</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="seg-bar" style={{ marginBottom: 16 }}>
          {[
            { key: "types", label: `Araç Tipleri (${types.length})` },
            { key: "vehicles", label: `Araçlar (${vehicles.length})` },
          ].map((t) => (
            <button
              key={t.key}
              className={`seg-btn${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>

        {/* Araç Tipleri */}
        {tab === "types" && (
          <div className="panel">
            <div className="panel-header">
              <h3>Araç Tipleri</h3>
              <span className="panel-info">Yakıt türü ve tüketim oranı tanımları</span>
            </div>
            {types.length === 0 ? (
              <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🚙</div>
                <p style={{ marginBottom: 12 }}>Henüz araç tipi tanımlanmadı.</p>
                <button className="btn btn-emphasized" onClick={openCreateType}>+ İlk Araç Tipini Ekle</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, padding: 16 }}>
                {types.map((t) => {
                  const info = FUEL_INFO[t.fuel_type] || {};
                  const co2PerKm = ((t.fuel_consumption_l_per_100km / 100) * (info.co2 || 0)).toFixed(3);
                  return (
                    <div key={t.id} style={{
                      border: "1px solid var(--border-light)", borderRadius: 12, padding: 16,
                      background: "#fff", position: "relative", boxShadow: "var(--shadow-sm)",
                    }}>
                      {t.is_default && (
                        <span style={{
                          position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 20, background: "#10b98122", color: "#10b981",
                        }}>VARSAYILAN</span>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, paddingRight: 70 }}>{t.name}</div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                        padding: "3px 10px", borderRadius: 20, background: info.bg, color: info.color, marginBottom: 14,
                      }}>
                        ⛽ {fuelLabel(t.fuel_type)}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Yakıt Tüketimi</span>
                          <strong>{t.fuel_consumption_l_per_100km} L/100km</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>CO₂ Katsayısı</span>
                          <strong>{info.co2 || 0} kg/L</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed var(--border-light)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>≈ Km Başına Emisyon</span>
                          <strong style={{ color: "#ef4444" }}>{co2PerKm} kg/km</strong>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openEditType(t)}>Düzenle</button>
                        <button className="btn btn-negative btn-sm" onClick={() => deleteType(t.id)}>Sil</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Araçlar */}
        {tab === "vehicles" && (
          <div className="panel">
            <div className="panel-header">
              <h3>Araçlar</h3>
              <span className="panel-info">Plakalar ve satış temsilcisi atamaları</span>
            </div>
            {types.length === 0 ? (
              <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
                <p style={{ marginBottom: 12 }}>Önce en az bir <strong>araç tipi</strong> tanımlamalısınız.</p>
                <button className="btn" onClick={() => setTab("types")}>Araç Tiplerine Git</button>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🚚</div>
                <p style={{ marginBottom: 12 }}>Henüz araç eklenmedi.</p>
                <button className="btn btn-emphasized" onClick={openCreateVehicle}>+ İlk Aracı Ekle</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, padding: 16 }}>
                {vehicles.map((v) => {
                  const info = FUEL_INFO[v.fuel_type] || {};
                  return (
                    <div key={v.id} style={{
                      border: "1px solid var(--border-light)", borderRadius: 12, padding: 16,
                      background: "#fff", boxShadow: "var(--shadow-sm)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{
                          fontWeight: 800, fontSize: 16, fontFamily: "monospace", letterSpacing: 0.5,
                          padding: "4px 10px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
                        }}>{v.plate_number}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                          background: info.bg, color: info.color,
                        }}>⛽ {fuelLabel(v.fuel_type)}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Araç Tipi</span>
                          <strong>{v.vehicle_type_name || "—"}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Tüketim</span>
                          <strong>{v.fuel_consumption || "—"} L/100km</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Atanan ST</span>
                          {v.assigned_user_name
                            ? <strong style={{ color: "#10b981" }}>{v.assigned_user_name}</strong>
                            : <span style={{ color: "#94a3b8" }}>Atanmadı</span>}
                        </div>
                        {v.notes && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", paddingTop: 6, borderTop: "1px dashed var(--border-light)" }}>
                            {v.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openEditVehicle(v)}>Düzenle</button>
                        <button className="btn btn-negative btn-sm" onClick={() => deleteVehicle(v.id)}>Sil</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Araç Tipi Dialog */}
      {showTypeDialog && (
        <div className="dialog-overlay" onClick={() => setShowTypeDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editType ? "Araç Tipini Düzenle" : "Yeni Araç Tipi"}</h2>
            </div>
            <div className="dialog-body">
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, padding: 10, borderRadius: 8, background: "var(--bg-secondary)" }}>
                Bu bilgiler satış temsilcilerinin saha ziyaretlerindeki <strong>karbon emisyonunu</strong> hesaplamak için kullanılır.
              </div>
              <div className="form-group">
                <label>Tip Adı</label>
                <input className="form-input" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Örnek: Dizel Kamyonet" autoFocus />
              </div>
              <div className="form-group">
                <label>Yakıt Türü</label>
                <select className="form-input" value={typeForm.fuel_type} onChange={(e) => setTypeForm({ ...typeForm, fuel_type: e.target.value })}>
                  <option value="diesel">Dizel (2.65 kg CO₂/L)</option>
                  <option value="gasoline">Benzin (2.35 kg CO₂/L)</option>
                  <option value="lpg">LPG (1.63 kg CO₂/L)</option>
                  <option value="electric">Elektrik (0 direkt emisyon)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Yakıt Tüketimi (L/100km)</label>
                <input className="form-input" type="number" step="0.1" min="0" value={typeForm.fuel_consumption_l_per_100km} onChange={(e) => setTypeForm({ ...typeForm, fuel_consumption_l_per_100km: Number(e.target.value) })} />
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Aracın 100 km'de kaç litre yakıt harcadığı. Tipik değerler: binek 6-8, kamyonet 9-12.</div>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={typeForm.is_default} onChange={(e) => setTypeForm({ ...typeForm, is_default: e.target.checked })} id="is_default" />
                <label htmlFor="is_default" style={{ margin: 0 }}>Varsayılan tip yap (aracı olmayan ST'ler için bu tip kullanılır)</label>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowTypeDialog(false)}>İptal</button>
              <button className="btn btn-emphasized" onClick={saveType} disabled={!typeForm.name.trim() || saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Araç Dialog */}
      {showVehicleDialog && (
        <div className="dialog-overlay" onClick={() => setShowVehicleDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editVehicle ? "Aracı Düzenle" : "Yeni Araç"}</h2>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Plaka</label>
                <input className="form-input" value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })} placeholder="34 ABC 123" autoFocus />
              </div>
              <div className="form-group">
                <label>Araç Tipi</label>
                <select className="form-input" value={vehicleForm.vehicle_type_id} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type_id: Number(e.target.value) })}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({fuelLabel(t.fuel_type)}, {t.fuel_consumption_l_per_100km} L/100km)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Atanan Satış Temsilcisi</label>
                <select className="form-input" value={vehicleForm.assigned_user_id} onChange={(e) => setVehicleForm({ ...vehicleForm, assigned_user_id: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">— Atanmadı —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} disabled={assignedIds.has(u.id) && editVehicle?.assigned_user_id !== u.id}>
                      {u.full_name}{assignedIds.has(u.id) && editVehicle?.assigned_user_id !== u.id ? " (başka araca atanmış)" : ""}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Her satış temsilcisi yalnızca bir araca atanabilir.</div>
              </div>
              <div className="form-group">
                <label>Notlar</label>
                <input className="form-input" value={vehicleForm.notes} onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} placeholder="Opsiyonel" />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowVehicleDialog(false)}>İptal</button>
              <button className="btn btn-emphasized" onClick={saveVehicle} disabled={!vehicleForm.plate_number.trim() || saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
