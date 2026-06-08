import { useState, useEffect, useCallback } from "react";
import api from "../api";

function timeAgo(iso) {
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "az önce";
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch { return ""; }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadCount = useCallback(() => {
    api.get("/notifications/unread-count").then((r) => setUnread(r.data?.count || 0)).catch(() => {});
  }, []);

  const loadList = useCallback(() => {
    api.get("/notifications/").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const iv = setInterval(loadCount, 30000); // 30 sn'de bir kontrol
    return () => clearInterval(iv);
  }, [loadCount]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const markAllRead = () => {
    api.post("/notifications/read-all").then(() => { setUnread(0); loadList(); }).catch(() => {});
  };

  const onItemClick = (n) => {
    if (!n.is_read) {
      api.post(`/notifications/${n.id}/read`).then(() => { loadCount(); loadList(); }).catch(() => {});
    }
  };

  return (
    <>
      <button
        onClick={toggle}
        title="Bildirimler"
        style={{
          position: "relative", background: "transparent", border: "none", cursor: "pointer",
          color: "#fff", padding: 6, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0, minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 10, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "fixed", bottom: 72, left: 16, width: 300, maxHeight: 420, zIndex: 1999,
            background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderBottom: "1px solid #f1f5f9",
            }}>
              <strong style={{ fontSize: 14, color: "#1e293b" }}>Bildirimler</strong>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ border: "none", background: "none", color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Tümünü okundu işaretle
                </button>
              )}
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {items.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                  Henüz bildiriminiz yok
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => onItemClick(n)}
                    style={{
                      padding: "10px 14px", borderBottom: "1px solid #f8fafc", cursor: "pointer",
                      background: n.is_read ? "#fff" : "#eef2ff",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                  >
                    <span style={{
                      marginTop: 4, width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: n.is_read ? "transparent" : "#6366f1",
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
