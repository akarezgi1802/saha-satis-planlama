import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api";

/* ── Haritada tıklayarak konum seçme bileşenleri ── */
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

function MapRecenter({ lat, lng, zoom }) {
  const map = useMap();
  const lastRef = useRef("");
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (lat && lng && key !== lastRef.current) {
      lastRef.current = key;
      map.flyTo([lat, lng], zoom || 14, { duration: 0.8 });
    }
  }, [lat, lng, zoom, map]);
  return null;
}

const ILLER = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin",
  "Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur",
  "Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan",
  "Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkâri","Hatay","Iğdır","Isparta",
  "İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kırıkkale",
  "Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin",
  "Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Şanlıurfa",
  "Siirt","Sinop","Sivas","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van",
  "Yalova","Yozgat","Zonguldak",
];

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,0.4);letter-spacing:-0.5px">D</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("table");
  const [depot, setDepot] = useState(null);
  const [search, setSearch] = useState("");
  const [filterFreq, setFilterFreq] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", x: "", y: "", monthly_revenue: "", visit_frequency: 1, customer_type: "", phone: "", il: "", ilce: "", mahalle: "", sokak: "", bina_no: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const suggestTimer = useRef(null);
  const fileRef = useRef();

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    api.get("/customers/?limit=500").then((r) => setCustomers(r.data));
    api.get("/customers/count").then((r) => setStats(r.data));
    api.get("/settings/depot").then((r) => setDepot(r.data));
  }

  const [uploadMsg, setUploadMsg] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Dosya yükleniyor... Adresler varsa konum tespiti yapılıyor, bu birkaç dakika sürebilir.");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/customers/upload-excel", form, { timeout: 600000 });
      const d = res.data;
      let msg = d.detail;
      if (d.errors && d.errors.length > 0) {
        msg += "\n\nKonumlandırılamayan satırlar:\n" + d.errors.join("\n");
      }
      alert(msg);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setUploading(false);
    setUploadMsg("");
    fileRef.current.value = "";
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    await api.delete(`/customers/${id}`);
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    loadData();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = (filteredIds) => {
    const allSelected = filteredIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const s = new Set(prev);
        filteredIds.forEach((id) => s.delete(id));
        return s;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size} müşteriyi silmek istediğinize emin misiniz?`)) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await api.delete(`/customers/${id}`);
      }
      setSelected(new Set());
      loadData();
    } catch (err) {
      alert("Silme hatası: " + (err.response?.data?.detail || err.message));
    }
    setDeleting(false);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setGeocodeMsg("");
    setEditForm({
      name: c.name,
      x: c.x,
      y: c.y,
      monthly_revenue: c.monthly_revenue,
      visit_frequency: c.visit_frequency,
      customer_type: c.customer_type || "",
      phone: c.phone || "",
      address: c.address || "",
      notes: c.notes || "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/customers/${editCustomer.id}`, {
        ...editForm,
        x: Number(editForm.x),
        y: Number(editForm.y),
        monthly_revenue: Number(editForm.monthly_revenue),
        visit_frequency: Number(editForm.visit_frequency),
        customer_type: editForm.customer_type || null,
        phone: editForm.phone || null,
        address: editForm.address || null,
        notes: editForm.notes || null,
      });
      setEditCustomer(null);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  const updateField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGeocode = async () => {
    if (!editForm.address) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const res = await api.get("/customers/geocode", { params: { address: editForm.address } });
      setEditForm((prev) => ({ ...prev, x: res.data.lat, y: res.data.lon }));
      setGeocodeMsg(`✓ Konum bulundu: ${res.data.display_name}`);
    } catch (err) {
      setGeocodeMsg(err.response?.data?.detail || "Konum bulunamadı");
    }
    setGeocoding(false);
  };

  const openCreate = () => {
    setCreateForm({ name: "", x: "", y: "", monthly_revenue: "", visit_frequency: 1, customer_type: "", phone: "", il: "", ilce: "", mahalle: "", sokak: "", bina_no: "", notes: "" });
    setGeocodeMsg("");
    setSuggestions([]);
    setActiveField(null);
    setMapCenter(null);
    setShowCreate(true);
  };

  const buildAddress = (f) => [f.sokak, f.bina_no ? `No:${f.bina_no}` : "", f.mahalle, f.ilce, f.il].filter(Boolean).join(", ");

  const handleCreate = async () => {
    setCreating(true);
    try {
      const address = buildAddress(createForm);
      await api.post("/customers/", {
        name: createForm.name.trim(),
        x: Number(createForm.x),
        y: Number(createForm.y),
        monthly_revenue: Number(createForm.monthly_revenue),
        visit_frequency: Number(createForm.visit_frequency),
        customer_type: createForm.customer_type || null,
        phone: createForm.phone || null,
        address: address || null,
        notes: createForm.notes || null,
      });
      setShowCreate(false);
      loadData();
    } catch (err) {
      alert("Hata: " + (err.response?.data?.detail || err.message));
    }
    setCreating(false);
  };

  const fetchSuggestions = useCallback((query, field) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!query || query.length < 2) { setSuggestions([]); return; }

    if (field === "il") {
      const lower = query.toLowerCase().replace("i̇", "i");
      setSuggestions(
        ILLER.filter((il) => il.toLowerCase().replace("İ", "i").startsWith(lower) || il.toLowerCase().startsWith(lower))
          .slice(0, 6)
          .map((il) => ({ label: il, value: il }))
      );
      setActiveField("il");
      return;
    }

    suggestTimer.current = setTimeout(async () => {
      let q = query;
      if (field === "ilce" && createForm.il) q = `${query}, ${createForm.il}`;
      if (field === "mahalle") {
        if (createForm.ilce && createForm.il) q = `${query}, ${createForm.ilce}, ${createForm.il}`;
        else if (createForm.il) q = `${query}, ${createForm.il}`;
      }
      try {
        const res = await api.get("/customers/geocode-suggest", { params: { q } });
        const seen = new Set();
        const items = res.data
          .map((r) => {
            const parts = r.display_name.split(",").map((s) => s.trim());
            const label = field === "ilce"
              ? (r.address?.town || r.address?.county || r.address?.city_district || r.address?.suburb || parts[0])
              : field === "mahalle"
                ? (r.address?.suburb || r.address?.neighbourhood || r.address?.quarter || parts[0])
                : parts[0];
            return { label, value: label, lat: r.lat, lon: r.lon, full: r.display_name };
          })
          .filter((item) => {
            if (seen.has(item.label)) return false;
            seen.add(item.label);
            return true;
          });
        setSuggestions(items);
        setActiveField(field);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [createForm.il, createForm.ilce]);

  const selectSuggestion = (item, field) => {
    if (field === "il") {
      setCreateForm((p) => ({ ...p, il: item.value, ilce: "", mahalle: "" }));
    } else if (field === "ilce") {
      setCreateForm((p) => ({ ...p, ilce: item.value, mahalle: "", x: item.lat || p.x, y: item.lon || p.y }));
      if (item.lat) setMapCenter({ lat: item.lat, lng: item.lon });
    } else if (field === "mahalle") {
      setCreateForm((p) => ({ ...p, mahalle: item.value, x: item.lat || p.x, y: item.lon || p.y }));
      if (item.lat) {
        setMapCenter({ lat: item.lat, lng: item.lon });
        setGeocodeMsg(`✓ Konum bulundu: ${item.full || item.label}`);
      }
    }
    setSuggestions([]);
    setActiveField(null);
  };

  const handleCreateGeocode = async () => {
    const f = createForm;
    if (!f.il && !f.sokak) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const params = {
        address: buildAddress(f),
        city: f.il || undefined,
        county: f.ilce || undefined,
        neighbourhood: f.mahalle || undefined,
        street: [f.sokak, f.bina_no ? `No:${f.bina_no}` : ""].filter(Boolean).join(" ") || undefined,
      };
      const res = await api.get("/customers/geocode", { params });
      setCreateForm((prev) => ({ ...prev, x: res.data.lat, y: res.data.lon }));
      setMapCenter({ lat: res.data.lat, lng: res.data.lon });
      setGeocodeMsg(`✓ Konum bulundu: ${res.data.display_name}`);
    } catch (err) {
      setGeocodeMsg(err.response?.data?.detail || "Konum bulunamadı. Haritaya tıklayarak seçebilirsiniz.");
    }
    setGeocoding(false);
  };

  const handleMapClick = async (latlng) => {
    setCreateForm((p) => ({ ...p, x: latlng.lat, y: latlng.lng }));
    setGeocodeMsg("");
    // Ters geocoding — tıklanan noktanın adresini göster
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&accept-language=tr`,
        { headers: { "User-Agent": "SahaSatisPlanlama/1.0" } }
      );
      const data = await resp.json();
      if (data.display_name) {
        setGeocodeMsg(`✓ ${data.display_name}`);
        // Adres parçalarını otomatik doldur
        const addr = data.address || {};
        setCreateForm((p) => ({
          ...p,
          il: addr.province || addr.state || p.il,
          ilce: addr.town || addr.county || addr.city_district || p.ilce,
          mahalle: addr.suburb || addr.neighbourhood || addr.quarter || p.mahalle,
          sokak: addr.road || addr.street || p.sokak,
        }));
      }
    } catch {
      /* sessizce geç */
    }
  };


  const center = depot
    ? [depot.depot_x, depot.depot_y]
    : customers.length > 0
      ? [customers.reduce((s, c) => s + c.x, 0) / customers.length, customers.reduce((s, c) => s + c.y, 0) / customers.length]
      : [38.6, 27.4];

  return (
    <div>
      <div className="page-toolbar">
        <h1>Müşteri Yönetimi</h1>
        <div className="toolbar-actions">
          <div className="seg-bar">
            <button className={`seg-item ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Tablo</button>
            <button className={`seg-item ${view === "map" ? "active" : ""}`} onClick={() => setView("map")}>Harita</button>
          </div>
          <input
            type="file"
            ref={fileRef}
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
          <button className="btn btn-emphasized" onClick={openCreate}>
            + Yeni Müşteri
          </button>
          <button
            className="btn btn-default"
            onClick={() => fileRef.current.click()}
            disabled={uploading}
          >
            {uploading ? "Yükleniyor..." : "Excel / CSV Yükle"}
          </button>
        </div>
      </div>
      {uploadMsg && (
        <div style={{ margin: "0 24px 12px", padding: "12px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
          {uploadMsg}
        </div>
      )}
      <div className="page-body">
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-label">Müşteri Sayısı</div>
            <div className="kpi-value">{stats?.count ?? "..."}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Toplam Ciro</div>
            <div className="kpi-value sm">
              {stats?.total_revenue
                ? Number(stats.total_revenue).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                : "..."}
              {stats?.total_revenue && <span className="kpi-unit">₺</span>}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Haftalık Ziyaret</div>
            <div className="kpi-value">{stats?.total_visits ?? "..."}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Ortalama Ciro</div>
            <div className="kpi-value sm">
              {stats?.count && stats?.total_revenue
                ? Math.round(stats.total_revenue / stats.count).toLocaleString("tr-TR")
                : "..."}
              {stats?.count && stats?.total_revenue && <span className="kpi-unit">₺</span>}
            </div>
          </div>
        </div>

        {view === "map" ? (
          <div className="panel">
            <div className="panel-header">
              <h3>{customers.length} müşteri haritada gösteriliyor</h3>
            </div>
            <div style={{ height: 550 }}>
              <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
                {customers.map((c) => (
                  <CircleMarker
                    key={c.id}
                    center={[c.x, c.y]}
                    radius={7}
                    fillColor="#6366f1"
                    color="#fff"
                    weight={2.5}
                    fillOpacity={0.9}
                  >
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 180 }}>
                        <strong>{c.name}</strong><br />
                        Ciro: {Number(c.monthly_revenue).toLocaleString("tr-TR")} ₺<br />
                        Ziyaret: {c.visit_frequency}x / hafta<br />
                        Koordinat: {c.x.toFixed(6)}, {c.y.toFixed(6)}
                        {c.phone && <><br />Tel: {c.phone}</>}
                        {c.address && <><br />Adres: {c.address}</>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                {depot && (
                  <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
                    <Popup>
                      <div style={{ fontSize: 13, minWidth: 140 }}>
                        <strong>DEPO</strong><br />
                        Enlem: {depot.depot_x.toFixed(6)}<br />
                        Boylam: {depot.depot_y.toFixed(6)}
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>
        ) : (() => {
          const freqs = [...new Set(customers.map((c) => c.visit_frequency))].sort((a, b) => a - b);
          const filtered = customers.filter((c) => {
            if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.address || "").toLowerCase().includes(search.toLowerCase())) return false;
            if (filterFreq && c.visit_frequency !== Number(filterFreq)) return false;
            return true;
          }).sort((a, b) => {
            if (sortBy === "revenue_desc") return b.monthly_revenue - a.monthly_revenue;
            if (sortBy === "revenue_asc") return a.monthly_revenue - b.monthly_revenue;
            if (sortBy === "visit_desc") return b.visit_frequency - a.visit_frequency;
            if (sortBy === "visit_asc") return a.visit_frequency - b.visit_frequency;
            if (sortBy === "name_asc") return a.name.localeCompare(b.name, "tr");
            if (sortBy === "name_desc") return b.name.localeCompare(a.name, "tr");
            return 0;
          });
          return (
            <div className="panel">
              <div className="panel-header">
                <h3>{filtered.length} / {customers.length} müşteri</h3>
              </div>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 200 }}
                  placeholder="Müşteri adı veya adres ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="form-input" style={{ width: 160 }} value={filterFreq} onChange={(e) => setFilterFreq(e.target.value)}>
                  <option value="">Tüm Sıklıklar</option>
                  {freqs.map((f) => (
                    <option key={f} value={f}>{f}x / hafta</option>
                  ))}
                </select>
                <select className="form-input" style={{ width: 190 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="">Sıralama: Varsayılan</option>
                  <option value="name_asc">İsim: A → Z</option>
                  <option value="name_desc">İsim: Z → A</option>
                  <option value="revenue_desc">Ciro: Büyükten Küçüğe</option>
                  <option value="revenue_asc">Ciro: Küçükten Büyüğe</option>
                  <option value="visit_desc">Ziyaret: Çoktan Aza</option>
                  <option value="visit_asc">Ziyaret: Azdan Çoğa</option>
                </select>
                {(search || filterFreq || sortBy) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setFilterFreq(""); setSortBy(""); }}>Temizle</button>
                )}
              </div>
              {selected.size > 0 && (
                <div style={{
                  padding: "10px 16px", background: "#fef2f2", borderBottom: "1px solid #fecaca",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>
                    {selected.size} müşteri seçildi
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Seçimi Kaldır</button>
                    <button className="btn btn-negative btn-sm" onClick={handleBulkDelete} disabled={deleting}>
                      {deleting ? "Siliniyor..." : `${selected.size} Müşteriyi Sil`}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                          onChange={() => toggleSelectAll(filtered.map((c) => c.id))}
                        />
                      </th>
                      <th>#</th>
                      <th>Müşteri Adı</th>
                      <th>Adres</th>
                      <th>Aylık Ciro</th>
                      <th>Ziyaret Sıklığı</th>
                      <th style={{ textAlign: "right" }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c.id} style={{ background: selected.has(c.id) ? "#fef2f2" : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td className="cell-dim">{i + 1}</td>
                        <td className="cell-bold">{c.name}</td>
                        <td className="cell-dim" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.address || ""}>{c.address || "—"}</td>
                        <td className="cell-mono">{Number(c.monthly_revenue).toLocaleString("tr-TR")} ₺</td>
                        <td>
                          <span className="badge-freq">{c.visit_frequency}x / hafta</span>
                        </td>
                        <td className="cell-right">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Düzenle</button>
                          <button className="btn btn-negative btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDelete(c.id)}>Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {editCustomer && (
        <div className="dialog-overlay" onClick={() => setEditCustomer(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Müşteri Düzenle</h2>
              <p>{editCustomer.name} — #{editCustomer.id}</p>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Müşteri Adı</label>
                <input className="form-input" value={editForm.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Adres ile Konum Bul</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editForm.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Detaylı adres girin (mahalle, cadde, ilçe, il)"
                  />
                  <button
                    className="btn btn-default"
                    type="button"
                    disabled={!editForm.address || geocoding}
                    onClick={handleGeocode}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {geocoding ? "Aranıyor..." : "Konum Bul"}
                  </button>
                </div>
                {geocodeMsg && (
                  <div style={{ marginTop: 6, fontSize: 12, color: geocodeMsg.startsWith("✓") ? "#10b981" : "#ef4444" }}>
                    {geocodeMsg}
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Enlem (X)</label>
                  <input className="form-input" type="number" step="any" value={editForm.x} onChange={(e) => updateField("x", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Boylam (Y)</label>
                  <input className="form-input" type="number" step="any" value={editForm.y} onChange={(e) => updateField("y", e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Aylık Ciro (₺)</label>
                  <input className="form-input" type="number" step="any" value={editForm.monthly_revenue} onChange={(e) => updateField("monthly_revenue", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ziyaret Sıklığı (haftalık)</label>
                  <input className="form-input" type="number" min={1} max={6} value={editForm.visit_frequency} onChange={(e) => updateField("visit_frequency", e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Müşteri Tipi</label>
                  <input className="form-input" value={editForm.customer_type} onChange={(e) => updateField("customer_type", e.target.value)} placeholder="Ör: A, B, C" />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input className="form-input" value={editForm.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="05XX XXX XXXX" />
                </div>
              </div>
              <div className="form-group">
                <label>Notlar</label>
                <input className="form-input" value={editForm.notes} onChange={(e) => updateField("notes", e.target.value)} />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => setEditCustomer(null)}>İptal</button>
              <button className="btn btn-emphasized" onClick={handleSave} disabled={saving || !editForm.name?.trim()}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="dialog-overlay" onClick={() => { setShowCreate(false); setSuggestions([]); }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="dialog-header">
              <h2>Yeni Müşteri Ekle</h2>
              <p>Müşteri bilgilerini girin</p>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Müşteri Adı *</label>
                <input className="form-input" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Müşteri adı" autoFocus />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0", paddingTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, display: "block" }}>Adres Bilgileri</label>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ position: "relative" }}>
                  <label>İl *</label>
                  <input
                    className="form-input"
                    value={createForm.il}
                    onChange={(e) => { setCreateForm((p) => ({ ...p, il: e.target.value, ilce: "", mahalle: "" })); fetchSuggestions(e.target.value, "il"); }}
                    onFocus={() => { if (createForm.il) fetchSuggestions(createForm.il, "il"); }}
                    onBlur={() => setTimeout(() => { if (activeField === "il") { setSuggestions([]); setActiveField(null); } }, 200)}
                    placeholder="İl yazın..."
                  />
                  {activeField === "il" && suggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 180, overflowY: "auto" }}>
                      {suggestions.map((s, i) => (
                        <div key={i} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}
                          onMouseDown={() => selectSuggestion(s, "il")}>
                          {s.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label>İlçe *</label>
                  <input
                    className="form-input"
                    value={createForm.ilce}
                    onChange={(e) => { setCreateForm((p) => ({ ...p, ilce: e.target.value, mahalle: "" })); fetchSuggestions(e.target.value, "ilce"); }}
                    onBlur={() => setTimeout(() => { if (activeField === "ilce") { setSuggestions([]); setActiveField(null); } }, 200)}
                    placeholder={createForm.il ? "İlçe yazın..." : "Önce il seçin"}
                    disabled={!createForm.il}
                  />
                  {activeField === "ilce" && suggestions.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 180, overflowY: "auto" }}>
                      {suggestions.map((s, i) => (
                        <div key={i} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}
                          onMouseDown={() => selectSuggestion(s, "ilce")}>
                          {s.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ position: "relative" }}>
                <label>Mahalle</label>
                <input
                  className="form-input"
                  value={createForm.mahalle}
                  onChange={(e) => { setCreateForm((p) => ({ ...p, mahalle: e.target.value })); fetchSuggestions(e.target.value, "mahalle"); }}
                  onBlur={() => setTimeout(() => { if (activeField === "mahalle") { setSuggestions([]); setActiveField(null); } }, 200)}
                  placeholder={createForm.ilce ? "Mahalle yazın..." : "Önce ilçe seçin"}
                  disabled={!createForm.ilce}
                />
                {activeField === "mahalle" && suggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 180, overflowY: "auto" }}>
                    {suggestions.map((s, i) => (
                      <div key={i} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}
                        onMouseDown={() => selectSuggestion(s, "mahalle")}>
                        {s.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Sokak / Cadde</label>
                  <input className="form-input" value={createForm.sokak} onChange={(e) => setCreateForm((p) => ({ ...p, sokak: e.target.value }))} placeholder="Sokak veya cadde adı" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Bina No</label>
                  <input className="form-input" value={createForm.bina_no} onChange={(e) => setCreateForm((p) => ({ ...p, bina_no: e.target.value }))} placeholder="No" />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0", paddingTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" }}>Konum Seç *</label>

                {!createForm.x && (
                  <div style={{ padding: "8px 12px", marginBottom: 8, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                    İlçeyi seçtikten sonra harita o bölgeye odaklanır. Haritaya tıklayarak müşterinin tam konumunu belirleyin.
                  </div>
                )}

                <div style={{ position: "relative", height: 260, borderRadius: 10, overflow: "hidden", border: createForm.x ? "2px solid #10b981" : "2px dashed #94a3b8", marginBottom: 6 }}>
                  <MapContainer
                    center={[depot?.depot_x || 38.62, depot?.depot_y || 27.42]}
                    zoom={12}
                    style={{ height: "100%", width: "100%", cursor: "crosshair" }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                    <MapClickHandler onClick={handleMapClick} />
                    {mapCenter && (
                      <MapRecenter lat={mapCenter.lat} lng={mapCenter.lng} zoom={17} />
                    )}
                    {createForm.x && createForm.y && (
                      <Marker position={[Number(createForm.x), Number(createForm.y)]} icon={pinIcon} />
                    )}
                  </MapContainer>
                  {!createForm.x && (
                    <div style={{
                      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                      background: "rgba(0,0,0,0.6)", color: "#fff", padding: "10px 20px", borderRadius: 8,
                      fontSize: 13, fontWeight: 600, pointerEvents: "none", zIndex: 1000,
                    }}>
                      Haritaya tıklayın
                    </div>
                  )}
                </div>
                {createForm.x && createForm.y && (
                  <div style={{ fontSize: 12, color: "#10b981", fontWeight: 500, marginBottom: 4 }}>
                    ✓ Konum seçildi: {Number(createForm.x).toFixed(5)}, {Number(createForm.y).toFixed(5)}
                  </div>
                )}
                {geocodeMsg && (
                  <div style={{ fontSize: 11, color: geocodeMsg.startsWith("✓") ? "#10b981" : "#ef4444", marginBottom: 4 }}>
                    {geocodeMsg}
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0", paddingTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, display: "block" }}>İş Bilgileri</label>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Aylık Ciro (₺) *</label>
                  <input className="form-input" type="number" step="any" value={createForm.monthly_revenue} onChange={(e) => setCreateForm((p) => ({ ...p, monthly_revenue: e.target.value }))} placeholder="Ör: 50000" />
                </div>
                <div className="form-group">
                  <label>Ziyaret Sıklığı (haftalık) *</label>
                  <input className="form-input" type="number" min={1} max={6} value={createForm.visit_frequency} onChange={(e) => setCreateForm((p) => ({ ...p, visit_frequency: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Müşteri Tipi</label>
                  <input className="form-input" value={createForm.customer_type} onChange={(e) => setCreateForm((p) => ({ ...p, customer_type: e.target.value }))} placeholder="Ör: A, B, C" />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input className="form-input" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} placeholder="05XX XXX XXXX" />
                </div>
              </div>
              <div className="form-group">
                <label>Notlar</label>
                <input className="form-input" value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-default" onClick={() => { setShowCreate(false); setSuggestions([]); }}>İptal</button>
              <button
                className="btn btn-emphasized"
                onClick={handleCreate}
                disabled={creating || !createForm.name?.trim() || !createForm.x || !createForm.y || !createForm.monthly_revenue}
              >
                {creating ? "Ekleniyor..." : "Müşteri Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
