import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, StatusBar, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, Tag, EmptyState, SectionTitle } from '../components/ui';

const IS_WEB = Platform.OS === 'web';
// react-native-maps web'de yok — sadece native'de import et
let MapView, Marker, Polyline, PROVIDER_DEFAULT;
if (!IS_WEB) {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
}

const DAYS = [
  { key: 1, label: 'Pzt' },
  { key: 2, label: 'Salı' },
  { key: 3, label: 'Çar' },
  { key: 4, label: 'Per' },
  { key: 5, label: 'Cum' },
  { key: 6, label: 'Cmt' },
];

function todayKey() {
  const w = new Date().getDay();
  return w === 0 ? 1 : w;
}

export default function MyPlanScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [planData, setPlanData] = useState(null);
  const [latestPlan, setLatestPlan] = useState(null);
  const [depot, setDepot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(todayKey());
  // Web'de harita yok, varsayılan liste
  const [view, setView] = useState(IS_WEB ? 'list' : 'map'); // 'map' | 'list'
  const [visits, setVisits] = useState([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [plansRes, visitsRes, depotRes] = await Promise.all([
        api.get('/plans/'),
        api.get('/performance/visits'),
        api.get('/settings/depot').catch(() => ({ data: null })),
      ]);
      const plans = plansRes.data || [];
      const completed = plans.filter(p => p.status === 'completed');
      const latest = completed[0] || plans[0];
      setLatestPlan(latest || null);
      setVisits(visitsRes.data || []);
      if (depotRes.data) setDepot(depotRes.data);

      if (latest && user?.cluster_index != null) {
        try {
          const res = await api.get(`/plans/${latest.id}/my-plan`);
          setPlanData(res.data);
        } catch (e) {
          setPlanData(null);
          if (e.response?.status === 400) {
            setError('Sana atanmış bir bölge yok.');
          }
        }
      } else if (user?.cluster_index == null) {
        setError('Hesabına bölge atanmamış. Yöneticiyle iletişime geç.');
      } else if (!latest) {
        setError('Henüz tamamlanmış bir plan yok.');
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Plan yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cluster_index]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const route = planData?.routes?.find(r => r.day_of_week === selectedDay);
  const todayStops = route?.stops || [];

  const isVisited = useCallback((customerId) => {
    const today = new Date().toISOString().slice(0, 10);
    return visits.some(v => v.customer_id === customerId && v.visit_date === today && v.visited);
  }, [visits]);

  // Map region calc
  const region = useMemo(() => {
    if (!todayStops.length) {
      return {
        latitude: depot?.depot_x ?? 38.65,
        longitude: depot?.depot_y ?? 27.34,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    const lats = todayStops.map(s => s.x);
    const lngs = todayStops.map(s => s.y);
    if (depot) { lats.push(depot.depot_x); lngs.push(depot.depot_y); }
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.6),
    };
  }, [todayStops, depot]);

  // Polyline coords: depot → stops → depot
  const polylineCoords = useMemo(() => {
    if (!todayStops.length) return [];
    const pts = todayStops.map(s => ({ latitude: s.x, longitude: s.y }));
    if (depot) {
      pts.unshift({ latitude: depot.depot_x, longitude: depot.depot_y });
      pts.push({ latitude: depot.depot_x, longitude: depot.depot_y });
    }
    return pts;
  }, [todayStops, depot]);

  const visitedCount = todayStops.filter(s => isVisited(s.customer_id)).length;
  const progressPercent = todayStops.length ? Math.round((visitedCount / todayStops.length) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Bugünün Rotası</Text>
            <Text style={styles.heroSub}>
              {latestPlan ? latestPlan.name : 'Plan yok'} · Bölge {user?.cluster_index != null ? `#${user.cluster_index}` : '—'}
            </Text>
          </View>

          {/* View toggle — sadece native'de göster */}
          {!IS_WEB ? (
            <View style={styles.toggle}>
              <TouchableOpacity
                onPress={() => setView('map')}
                style={[styles.toggleBtn, view === 'map' && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, view === 'map' && styles.toggleTextActive]}>🗺️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setView('list')}
                style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, view === 'list' && styles.toggleTextActive]}>☰</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* Day selector */}
      <View style={styles.daysBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {DAYS.map(d => {
            const active = d.key === selectedDay;
            const dayRoute = planData?.routes?.find(r => r.day_of_week === d.key);
            const stops = dayRoute?.stops?.length || 0;
            return (
              <TouchableOpacity key={d.key} onPress={() => setSelectedDay(d.key)} activeOpacity={0.8}>
                <View style={[styles.dayPill, active && styles.dayPillActive, stops === 0 && styles.dayPillEmpty]}>
                  <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d.label}</Text>
                  {stops > 0 ? (
                    <View style={[styles.dayCount, active && { backgroundColor: '#fff' }]}>
                      <Text style={[styles.dayCountText, active && { color: colors.brand }]}>{stops}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={{ padding: 14 }}>
          <Card><EmptyState icon="⚠️" title="Plan yüklenemedi" subtitle={error} /></Card>
        </View>
      ) : !route || todayStops.length === 0 ? (
        <View style={{ padding: 14 }}>
          <Card>
            <EmptyState icon="🌴" title="Bu gün için ziyaret yok" subtitle="Başka bir gün seç ya da yöneticiyle iletişime geç" />
          </Card>
        </View>
      ) : view === 'map' ? (
        <MapPlanView
          stops={todayStops}
          depot={depot}
          region={region}
          polylineCoords={polylineCoords}
          isVisited={isVisited}
          progressPercent={progressPercent}
          visitedCount={visitedCount}
          totalDistance={route.total_distance}
          totalTime={route.total_time_minutes}
          onStopPress={(stop) => navigation.navigate('VisitDetail', {
            customerId: stop.customer_id,
            customerName: stop.customer_name,
            visitOrder: stop.visit_order,
            estimatedArrival: stop.estimated_arrival_minutes,
          })}
        />
      ) : (
        <ListPlanView
          stops={todayStops}
          isVisited={isVisited}
          progressPercent={progressPercent}
          visitedCount={visitedCount}
          totalDistance={route.total_distance}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          onStopPress={(stop) => navigation.navigate('VisitDetail', {
            customerId: stop.customer_id,
            customerName: stop.customer_name,
            visitOrder: stop.visit_order,
            estimatedArrival: stop.estimated_arrival_minutes,
          })}
        />
      )}
    </View>
  );
}

function MapPlanView({ stops, depot, region, polylineCoords, isVisited, progressPercent, visitedCount, totalDistance, totalTime, onStopPress }) {
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Depot */}
        {depot ? (
          <Marker
            coordinate={{ latitude: depot.depot_x, longitude: depot.depot_y }}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Depo"
          >
            <View style={styles.depotMarker}>
              <Text style={styles.depotMarkerText}>🏭</Text>
            </View>
          </Marker>
        ) : null}

        {/* Polyline */}
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.brand}
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        ) : null}

        {/* Stops */}
        {stops.map((s) => {
          const visited = isVisited(s.customer_id);
          return (
            <Marker
              key={s.customer_id}
              coordinate={{ latitude: s.x, longitude: s.y }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onStopPress(s)}
              title={s.customer_name}
              description={`Sıra ${s.visit_order} · ${fmtMin(s.estimated_arrival_minutes)}`}
            >
              <View style={[
                styles.stopMarker,
                visited && { backgroundColor: colors.positive, borderColor: colors.positive },
              ]}>
                <Text style={styles.stopMarkerText}>{visited ? '✓' : s.visit_order}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Bottom overlay: progress + summary */}
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
            <Text style={styles.overlayStatVal}>{totalDistance ? `${totalDistance.toFixed(1)}` : '—'}</Text>
            <Text style={styles.overlayStatLabel}>km</Text>
          </View>
          <View style={styles.overlayDiv} />
          <View style={styles.overlayStat}>
            <Text style={styles.overlayStatVal}>{totalTime ? `${(totalTime / 60).toFixed(1)}` : '—'}</Text>
            <Text style={styles.overlayStatLabel}>sa</Text>
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

function ListPlanView({ stops, isVisited, progressPercent, visitedCount, totalDistance, refreshControl, onStopPress }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={refreshControl}
    >
      <View style={styles.summaryRow}>
        <View style={[styles.summaryTile, { backgroundColor: colors.brandLight }]}>
          <Text style={styles.summaryNum}>{stops.length}</Text>
          <Text style={styles.summaryLabel}>Ziyaret</Text>
        </View>
        <View style={[styles.summaryTile, { backgroundColor: colors.positiveBg }]}>
          <Text style={[styles.summaryNum, { color: colors.positive }]}>{visitedCount}</Text>
          <Text style={styles.summaryLabel}>Tamamlandı</Text>
        </View>
        <View style={[styles.summaryTile, { backgroundColor: colors.criticalBg }]}>
          <Text style={[styles.summaryNum, { color: colors.critical }]}>
            {totalDistance ? totalDistance.toFixed(1) : '—'}
          </Text>
          <Text style={styles.summaryLabel}>km</Text>
        </View>
      </View>

      <SectionTitle>Sıralı Rota</SectionTitle>

      {stops.map((stop, idx) => {
        const visited = isVisited(stop.customer_id);
        const isLast = idx === stops.length - 1;
        return (
          <TouchableOpacity
            key={`${stop.customer_id}-${idx}`}
            activeOpacity={0.8}
            onPress={() => onStopPress(stop)}
          >
            <View style={styles.stopRow}>
              <View style={styles.timeline}>
                <View style={[
                  styles.stopBubble,
                  visited && { backgroundColor: colors.positive, borderColor: colors.positive },
                ]}>
                  {visited
                    ? <Text style={styles.stopBubbleCheck}>✓</Text>
                    : <Text style={styles.stopBubbleText}>{stop.visit_order}</Text>}
                </View>
                {!isLast ? <View style={styles.timelineLine} /> : null}
              </View>

              <View style={[styles.stopCard, visited && { opacity: 0.6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName} numberOfLines={1}>{stop.customer_name}</Text>
                    <Text style={styles.stopMeta}>
                      #{stop.customer_id} · Tahmini varış: {fmtMin(stop.estimated_arrival_minutes)}
                    </Text>
                  </View>
                  {visited
                    ? <Tag label="✓ Tamamlandı" color={colors.positive} bg={colors.positiveBg} />
                    : <Tag label="Bekliyor" color={colors.critical} bg={colors.criticalBg} />}
                </View>
                <View style={styles.stopFooter}>
                  <Text style={styles.stopAction}>{visited ? 'Detayı gör →' : 'Ziyarete git →'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function fmtMin(m) {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h > 0 ? `${h}sa ${mm}dk` : `${mm}dk`;
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 14 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  toggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full, padding: 3, gap: 2,
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 16 },
  toggleTextActive: { },
  daysBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  dayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
  },
  dayPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayPillEmpty: { opacity: 0.5 },
  dayPillText: { fontSize: 12, fontWeight: '700', color: colors.text },
  dayPillTextActive: { color: '#fff' },
  dayCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  dayCountText: { fontSize: 10, fontWeight: '800', color: colors.brand },

  // Map markers
  depotMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    ...shadow.md,
  },
  depotMarkerText: { fontSize: 16 },
  stopMarker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    ...shadow.md,
  },
  stopMarkerText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Overlay
  overlay: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: 14, ...shadow.lg,
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

  // List view
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  summaryTile: { flex: 1, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: '800', color: colors.brand },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  stopRow: { flexDirection: 'row', marginBottom: 10 },
  timeline: { width: 36, alignItems: 'center' },
  stopBubble: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  stopBubbleText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
  stopBubbleCheck: { color: '#fff', fontWeight: '800', fontSize: 14 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2, minHeight: 30 },
  stopCard: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginLeft: 4, ...shadow.sm,
  },
  stopName: { fontSize: 14, fontWeight: '800', color: colors.text },
  stopMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 3, fontWeight: '500' },
  stopFooter: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  stopAction: { color: colors.brand, fontWeight: '700', fontSize: 12 },
});
