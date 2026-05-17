/**
 * Mobile WEB için Leaflet ile harita.
 * react-native-maps web'de yok; bu component sadece web build'de yüklenir.
 * Metro bundler `.web.js` uzantısını otomatik seçer.
 */
import React, { useEffect, useRef } from 'react';
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
  onStopPress,
}) {
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

      {/* Trafik bilgisi banner */}
      {liveRoute ? (
        <View style={styles.trafficBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trafficText}>{liveRoute.summary_text}</Text>
            <Text style={styles.trafficProvider}>
              {liveRoute.provider === 'tomtom'
                ? '⚡ TomTom · canlı trafik'
                : '📐 Tahmini (TomTom key ekleyince canlı olur)'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefreshLive}
            disabled={liveLoading}
            style={styles.trafficRefresh}
          >
            {liveLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.trafficRefreshText}>↻</Text>}
          </TouchableOpacity>
        </View>
      ) : liveLoading ? (
        <View style={styles.trafficBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={[styles.trafficText, { marginLeft: 8 }]}>Trafik yükleniyor…</Text>
        </View>
      ) : null}

      {/* Bottom overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayHeader}>
          <Text style={styles.overlayTitle}>{visitedCount}/{stops.length} ziyaret tamamlandı</Text>
          <Text style={styles.overlayPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.overlayStats}>
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
          <View style={styles.overlayDiv} />
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatVal}>{stops.length - visitedCount}</Text>
            <Text style={styles.overlayStatLabel}>kaldı</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trafficBanner: {
    position: 'absolute', top: 14, left: 14, right: 14,
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row', alignItems: 'center',
    zIndex: 500,
    ...shadow.lg,
  },
  trafficText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  trafficProvider: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  trafficRefresh: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  trafficRefreshText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  overlay: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: 14,
    zIndex: 500,
    ...shadow.lg,
  },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overlayTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  overlayPercent: { fontSize: 18, fontWeight: '800', color: colors.brand },
  progressTrack: {
    height: 8, backgroundColor: colors.borderLight,
    borderRadius: 4, marginTop: 8, overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.brand, borderRadius: 4 },
  overlayStats: {
    flexDirection: 'row', marginTop: 12,
    backgroundColor: colors.bg, borderRadius: radius.md, padding: 10,
  },
  overlayStat: { flex: 1, alignItems: 'center' },
  overlayDiv: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  overlayStatVal: { fontSize: 16, fontWeight: '800', color: colors.text },
  overlayStatLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
});
