/**
 * Mobile WEB için Leaflet ile harita.
 * react-native-maps web'de yok; bu component sadece web build'de yüklenir.
 * Metro bundler `.web.js` uzantısını otomatik seçer.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, radius, shadow } from '../theme';

// Custom marker icon — depo
const depotIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#1e293b;width:36px;height:36px;border-radius:18px;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 10px rgba(0,0,0,0.3);">🏭</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const stopIcon = (visitOrder, visited) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:${visited ? '#10b981' : '#6366f1'};width:32px;height:32px;border-radius:16px;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;box-shadow:0 4px 10px rgba(0,0,0,0.3);">${visited ? '✓' : visitOrder}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, bounds]);
  return null;
}

export default function LeafletPlanMap({
  stops, depot, polylineCoords, isVisited,
  liveRoute, liveLoading, onRefreshLive,
  visitedCount, progressPercent, totalDistance, totalTime,
  activeStop, onActiveDirections,
  onStopPress,
}) {
  // Bottom overlay collapsed = sadece aktif adım + butonlar (kompakt)
  // expanded = + progress bar + 3 stat (geniş)
  // Trafik banner: tek satır kompakt pill (collapsed) / detay (expanded)
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [trafficOpen, setTrafficOpen] = useState(false);
  // Map bounds için tüm koordinatlar
  const bounds = React.useMemo(() => {
    const pts = [];
    if (depot) pts.push([depot.depot_x, depot.depot_y]);
    stops.forEach(s => pts.push([s.x, s.y]));
    return pts.length ? pts : null;
  }, [stops, depot]);

  // Leaflet için polyline koordinatları [[lat, lng], ...] formatı
  const leafletPolyline = (polylineCoords || []).map(p => [p.latitude, p.longitude]);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <View style={{ flex: 1 }}>
        <MapContainer
          style={{ height: '100%', width: '100%' }}
          center={depot ? [depot.depot_x, depot.depot_y] : [38.65, 27.34]}
          zoom={11}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {bounds ? <FitBounds bounds={bounds} /> : null}

          {/* Depot */}
          {depot ? (
            <Marker position={[depot.depot_x, depot.depot_y]} icon={depotIcon}>
              <Tooltip permanent={false}>Depo</Tooltip>
            </Marker>
          ) : null}

          {/* Polyline */}
          {leafletPolyline.length > 1 ? (
            <Polyline
              positions={leafletPolyline}
              pathOptions={{ color: colors.brand, weight: 4, opacity: 0.85 }}
            />
          ) : null}

          {/* Stops */}
          {stops.map((s) => {
            const visited = isVisited(s.customer_id);
            return (
              <Marker
                key={s.customer_id}
                position={[s.x, s.y]}
                icon={stopIcon(s.visit_order, visited)}
                eventHandlers={{
                  click: () => onStopPress && onStopPress(s),
                }}
              >
                <Tooltip>{`${s.visit_order}. ${s.customer_name}`}</Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
      </View>

      {/* Trafik pill — kompakt, tıklayınca açılır */}
      {liveRoute ? (
        <View style={styles.trafficStack}>
          <TouchableOpacity
            onPress={() => setTrafficOpen(!trafficOpen)}
            activeOpacity={0.85}
            style={trafficOpen ? styles.trafficBanner : styles.trafficPill}
          >
            {trafficOpen ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trafficText}>{liveRoute.summary_text}</Text>
                  <Text style={styles.trafficProvider}>
                    {liveRoute.provider === 'tomtom' ? '⚡ Canlı trafik' : '📐 Tahmini süre'}
                    {liveRoute.remaining_count != null && liveRoute.handled_count > 0
                      ? ` · ${liveRoute.remaining_count} müşteri kaldı`
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation && e.stopPropagation(); onRefreshLive && onRefreshLive(); }}
                  disabled={liveLoading}
                  style={styles.trafficRefresh}
                >
                  {liveLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.trafficRefreshText}>↻</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.trafficPillIcon}>{liveRoute.provider === 'tomtom' ? '⚡' : '📐'}</Text>
                <Text style={styles.trafficPillText} numberOfLines={1}>{liveRoute.summary_text}</Text>
                <Text style={styles.trafficPillChevron}>▾</Text>
              </>
            )}
          </TouchableOpacity>
          {liveRoute.incidents?.length ? (
            <View style={styles.incidentBanner}>
              <Text style={styles.incidentIcon}>{liveRoute.incidents[0].icon || '⚠️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.incidentTitle}>
                  {liveRoute.incidents[0].type}
                  {liveRoute.incidents[0].delay_minutes ? ` · +${liveRoute.incidents[0].delay_minutes} dk gecikme` : ''}
                </Text>
                <Text style={styles.incidentText} numberOfLines={2}>
                  {liveRoute.incidents[0].description}
                  {liveRoute.incidents.length > 1 ? ` · ve ${liveRoute.incidents.length - 1} olay daha` : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : liveLoading ? (
        <View style={styles.trafficStack}>
          <View style={styles.trafficPill}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.trafficPillText, { marginLeft: 8 }]}>Trafik yükleniyor…</Text>
          </View>
        </View>
      ) : null}

      {/* Bottom overlay: aktif adım kompakt; chevron ile progress + stats açılır */}
      <View style={styles.overlay}>
        {activeStop ? (
          <View style={styles.activeStepRow}>
            <View style={styles.activeStepLeft}>
              <Text style={styles.activeStepLabel}>SIRADAKI · {visitedCount}/{stops.length}</Text>
              <Text style={styles.activeStepName} numberOfLines={1}>
                {activeStop.visit_order}. {activeStop.customer_name}
              </Text>
              <Text style={styles.activeStepMeta}>
                Varış {fmtMin(activeStop.estimated_arrival_minutes)}
                {totalDistance ? ` · ${Number(totalDistance).toFixed(1)} km` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.activeNavBtn} onPress={onActiveDirections} activeOpacity={0.85}>
              <Text style={styles.activeNavBtnText}>🧭</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.activeDetailBtn} onPress={() => onStopPress(activeStop)} activeOpacity={0.85}>
              <Text style={styles.activeDetailIcon}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overlayChevronBtn} onPress={() => setOverlayOpen(!overlayOpen)} activeOpacity={0.7}>
              <Text style={styles.overlayChevron}>{overlayOpen ? '▾' : '▴'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.allDoneRow}>
            <Text style={styles.allDoneIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.allDoneTitle}>Bugün için tüm ziyaretler tamamlandı</Text>
              <Text style={styles.allDoneText}>Depoya dönebilirsin · {visitedCount}/{stops.length} ziyaret</Text>
            </View>
            <TouchableOpacity style={styles.overlayChevronBtn} onPress={() => setOverlayOpen(!overlayOpen)} activeOpacity={0.7}>
              <Text style={styles.overlayChevron}>{overlayOpen ? '▾' : '▴'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {overlayOpen ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.overlayStats}>
              <View style={styles.overlayStat}>
                <Text style={styles.overlayStatVal}>{visitedCount}/{stops.length}</Text>
                <Text style={styles.overlayStatLabel}>ziyaret</Text>
              </View>
              <View style={styles.overlayDiv} />
              <View style={styles.overlayStat}>
                <Text style={styles.overlayStatVal}>{totalDistance ? Number(totalDistance).toFixed(1) : '—'}</Text>
                <Text style={styles.overlayStatLabel}>km</Text>
              </View>
              <View style={styles.overlayDiv} />
              <View style={styles.overlayStat}>
                <Text style={styles.overlayStatVal}>
                  {liveRoute?.traffic_time_min
                    ? `${Math.floor(liveRoute.traffic_time_min / 60)}:${String(liveRoute.traffic_time_min % 60).padStart(2, '0')}`
                    : totalTime ? `${(totalTime / 60).toFixed(1)}` : '—'}
                </Text>
                <Text style={styles.overlayStatLabel}>{liveRoute ? 'sa:dk' : 'sa'}</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

// estimated_arrival_minutes backend tarafından "günün başlangıcından
// (08:00 = 480 dk) itibaren toplam dakika" olarak gönderilir.
// Bunu "yolda kalan süre" değil, varış SAATİ olarak göstermek doğru.
// Örn: 497 -> "08:17" (yolda 8 saat değil, saat 08:17'de varır).
function fmtMin(m) {
  if (m == null) return '—';
  const total = Math.max(0, Math.round(m));
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  trafficStack: { position: 'absolute', top: 8, left: 10, right: 10, gap: 6, zIndex: 500 },
  trafficPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    maxWidth: '100%',
    ...shadow.md,
  },
  trafficPillIcon: { fontSize: 12 },
  trafficPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  trafficPillChevron: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginLeft: 2 },
  trafficBanner: {
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center',
    ...shadow.md,
  },
  trafficText: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
  trafficProvider: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 1 },
  trafficRefresh: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  trafficRefreshText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  overlay: {
    position: 'absolute', left: 10, right: 10, bottom: 10,
    backgroundColor: '#fff', borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    zIndex: 500,
    ...shadow.lg,
  },
  progressTrack: {
    height: 5, backgroundColor: colors.borderLight,
    borderRadius: 3, marginTop: 6, overflow: 'hidden',
  },
  progressFill: { height: 5, backgroundColor: colors.brand, borderRadius: 3 },
  overlayStats: {
    flexDirection: 'row', marginTop: 6,
    backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5,
  },
  overlayStat: { flex: 1, alignItems: 'center' },
  overlayDiv: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  overlayStatVal: { fontSize: 13, fontWeight: '800', color: colors.text },
  overlayStatLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  overlayChevronBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  overlayChevron: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },

  activeStepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  activeStepLeft: { flex: 1, minWidth: 0 },
  activeStepLabel: { fontSize: 8, fontWeight: '900', color: colors.brand, letterSpacing: 1 },
  activeStepName: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 1 },
  activeStepMeta: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },
  activeNavBtn: {
    backgroundColor: colors.brand,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  activeNavBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  activeDetailBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activeDetailIcon: { color: colors.brand, fontSize: 18, fontWeight: '800' },
  allDoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  allDoneIcon: { fontSize: 22 },
  allDoneTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  allDoneText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },
  incidentBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    ...shadow.md,
  },
  incidentIcon: { fontSize: 18 },
  incidentTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  incidentText: { color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '600', marginTop: 1, lineHeight: 14 },
});
