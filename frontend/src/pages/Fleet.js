import { useState, useEffect } from "react";
import api from "../api";

const FUEL_LABELS = { diesel: "Dizel", gasoline: "Benzin", lpg: "LPG", electric: "Elektrik" };

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

  // ── Arac Tipi CRUD ──
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
    if (!window.confirm("Bu arac tipini silmek istediginize emin misiniz?")) return;
    try { await api.delete(`/fleet/vehicle-types/${id}`); loadAll(); }
    catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
  };

  // ── Arac CRUD ──
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
    if (!window.confirm("Bu araci silmek istediginize emin misiniz?")) return;
    try { await api.delete(`/fleet/vehicles/${id}`); loadAll(); }
    catch (err) { alert("Hata: " + (err.response?.data?.detail || err.message)); }
  };

  // Atanmamis ST'ler
  const assignedIds = new Set(vehicles.map((v) => v.assigned_user_id).filter(Boolean));

  return (
    <div>
      <div className="page-toolbar">
        <h1>Filo Yonetimi</h1>
        <div className="toolbar-actions">
          {tab === "types" && (
            <button className="btn btn-emphasized" onClick={openCreateType}>+ Arac Tipi</button>
          )}
          {tab === "vehicles" && (
            <button className="btn btn-emphasized" onClick={openCreateVehicle} disabled={types.length === 0}>+ Arac</button>
          )}
        </div>
      </div>
      <div className="page-body">
        {/* Tab Bar */}
        <div className="seg-bar" style={{ marginBottom: 16 }}>
          {[
            { key: "types", label: "Arac Tipleri" },
            { key: "vehicles", label: "Araclar" },
          ].map((t) => (
            <button
              key={t.key}
              className={`seg-btn${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>

        {/* Arac Tipleri */}
        {tab === "types" && (
          <div className="panel">
            <div className="panel-header"><h3>Arac Tipleri</h3></div>
            {types.length === 0 ? (
              <div className="empty-state"><p>Henuz arac tipi tanimlanmadi. Yeni bir tip ekleyin.</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tip Adi</th>
                      <th>Yakit Turu</th>
                      <th>Tuketim (L/100km)</th>
                      <th>Varsayilan</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((t) => (
                      <tr key={t.id}>
                        <td className="cell-bold">{t.name}</td>
                        <td>{FUEL_LABELS[t.fuel_type] || t.fuel_type}</td>
                        <td className="cell-mono">{t.fuel_consumption_l_per_100km}</td>
                        <td>{t.is_default ? <span style={{ color: "#10b981", fontWeight: 700 }}>Evet</span> : "—"}</td>
                        <td className="cell-right" style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEditType(t)}>Duzenle</button>
                          <button className="btn btn-negative btn-sm" onClick={() => deleteType(t.id)}>Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Araclar */}
        {tab === "vehicles" && (
          <div className="panel">
            <div className="panel-header"><h3>Araclar</h3></div>
            {types.length === 0 ? (
              <div className="empty-state"><p>Once arac tipi tanimlayin.</p></div>
            ) : vehicles.length === 0 ? (
              <div className="empty-state"><p>Henuz arac eklenmedi.</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Plaka</th>
                      <th>Arac Tipi</th>
                      <th>Yakit</th>
                      <th>Tuketim</th>
                      <th>Atanan ST</th>
                      <th>Notlar</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id}>
                        <td className="cell-bold">{v.plate_number}</td>
                        <td>{v.vehicle_type_name || "?"}</td>
                        <td>{FUEL_LABELS[v.fuel_type] || v.fuel_type || "?"}</td>
                        <td className="cell-mono">{v.fuel_consumption || "?"} L/100km</td>
                        <td>{v.assigned_user_name || <span style={{ color: "#94a3b8" }}>Atanmadi</span>}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.notes || "—"}</td>
                        <td className="cell-right" style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEditVehicle(v)}>Duzenle</button>
                          <button className="btn btn-negative btn-sm" onClick={() => deleteVehicle(v.id)}>Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Arac Tipi Dialog */}
      {showTypeDialog && (
        <div className="dialog-overlay" onClick={() => setShowTypeDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editType ? "Arac Tipini Duzenle" : "Yeni Arac Tipi"}</h2>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Tip Adi</label>
                <input className="form-input" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Ornegin: Dizel Sedan" autoFocus />
              </div>
              <div className="form-group">
                <label>Yakit Turu</label>
                <select className="form-input" value={typeForm.fuel_type} onChange={(e) => setTypeForm({ ...typeForm, fuel_type: e.target.value })}>
                  <option value="diesel">Dizel</option>
                  <option value="gasoline">Benzin</option>
                  <option value="lpg">LPG</option>
                  <option value="electric">Elektrik</option>
                </select>
              </div>
              <div className="form-group">
                <label>Yakit Tuketimi (L/100km)</label>
                <input className="form-input" type="number" step="0.1" min="0" value={typeForm.fuel_consumption_l_per_100km} onChange={(e) => setTypeForm({ ...typeForm, fuel_consumption_l_per_100km: Number(e.target.value) })} />
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={typeForm.is_default} onChange={(e) => setTypeForm({ ...typeForm, is_default: e.target.checked })} id="is_default" />
                <label htmlFor="is_default" style={{ margin: 0 }}>Varsayilan tip olarak ayarla</label>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowTypeDialog(false)}>Iptal</button>
              <button className="btn btn-emphasized" onClick={saveType} disabled={!typeForm.name.trim() || saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arac Dialog */}
      {showVehicleDialog && (
        <div className="dialog-overlay" onClick={() => setShowVehicleDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>{editVehicle ? "Araci Duzenle" : "Yeni Arac"}</h2>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Plaka</label>
                <input className="form-input" value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })} placeholder="34 ABC 123" autoFocus />
              </div>
              <div className="form-group">
                <label>Arac Tipi</label>
                <select className="form-input" value={vehicleForm.vehicle_type_id} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type_id: Number(e.target.value) })}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({FUEL_LABELS[t.fuel_type]}, {t.fuel_consumption_l_per_100km} L/100km)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Atanan Satis Temsilcisi</label>
                <select className="form-input" value={vehicleForm.assigned_user_id} onChange={(e) => setVehicleForm({ ...vehicleForm, assigned_user_id: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">— Atanmadi —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} disabled={assignedIds.has(u.id) && editVehicle?.assigned_user_id !== u.id}>
                      {u.full_name}{assignedIds.has(u.id) && editVehicle?.assigned_user_id !== u.id ? " (baska araca atanmis)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Notlar</label>
                <input className="form-input" value={vehicleForm.notes} onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} placeholder="Opsiyonel" />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setShowVehicleDialog(false)}>Iptal</button>
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
