/**
 * Geçmiş Ziyaretlerim — ST kendi son N günlük ziyaret ve satış kayıtlarını
 * gün gün, kart kart görür. Backend: GET /performance/visits?start_date&end_date
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, EmptyState } from '../components/ui';

const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_NAMES_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const RANGES = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu hafta' },
  { key: 'month', label: 'Bu ay' },
];

// Tarih yardımcıları — yerel zaman dilimi, ISO YYYY-MM-DD
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekMon(d) {
  // Pazartesi = haftanın ilk günü (TR). JS getDay: Pzr=0..Cmt=6 → Pzt'ye geri sar
  const x = new Date(d);
  const wd = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() - (wd - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeBounds(key) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (key === 'week') {
    return { start: startOfWeekMon(today), end: today };
  }
  if (key === 'month') {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
  // 'today' (varsayılan): tek gün
  return { start: today, end: today };
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const sec = Math.max(0, (new Date(endIso) - new Date(startIso)) / 1000);
  if (sec < 60) return `${Math.round(sec)} sn`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}

function fmtTL(n) {
  if (!n) return '0 ₺';
  return `${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`;
}

function fmtDateLabel(dateStr) {
  // dateStr "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (ymd(dt) === ymd(today)) return 'Bugün';
  if (ymd(dt) === ymd(yesterday)) return 'Dün';
  return `${DAY_NAMES_TR[dt.getDay()]}, ${dt.getDate()} ${MONTH_NAMES_TR[dt.getMonth()]}`;
}

export default function HistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rangeKey, setRangeKey] = useState('today');
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { start, end } = rangeBounds(rangeKey);
    try {
      const res = await api.get('/performance/visits', {
        params: { start_date: ymd(start), end_date: ymd(end) },
      });
      setVisits(res.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Geçmiş yüklenemedi');
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  // Gün gün grupla — sadece visited=1 olanlar sayılır
  const grouped = useMemo(() => {
    const buckets = {};
    visits.forEach(v => {
      const d = v.visit_date;
      if (!buckets[d]) buckets[d] = [];
      buckets[d].push(v);
    });
    const days = Object.keys(buckets).sort((a, b) => b.localeCompare(a)); // en yeni gün üstte
    return days.map(d => {
      const items = buckets[d];
      const visitedItems = items.filter(v => v.visited);
      const sales = items.reduce((s, v) => s + (v.sale_amount || 0), 0);
      return { date: d, items, visitedCount: visitedItems.length, totalCount: items.length, sales };
    });
  }, [visits]);

  const totals = useMemo(() => {
    const visitedCount = visits.filter(v => v.visited).length;
    const sales = visits.reduce((s, v) => s + (v.sale_amount || 0), 0);
    const customerSet = new Set(visits.filter(v => v.visited).map(v => v.customer_id));
    return { visitedCount, sales, customerCount: customerSet.size };
  }, [visits]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>📜 Geçmiş Ziyaretlerim</Text>
            <Text style={styles.heroSub}>
              {RANGES.find(r => r.key === rangeKey)?.label} · {totals.visitedCount} ziyaret · {fmtTL(totals.sales)}
            </Text>
          </View>
        </View>

        {/* Aralık seçici */}
        <View style={styles.rangeBar}>
          {RANGES.map(r => {
            const active = r.key === rangeKey;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => setRangeKey(r.key)}
                style={[styles.rangeBtn, active && styles.rangeBtnActive]}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiTile, { backgroundColor: colors.brandLight }]}>
            <Text style={styles.kpiVal}>{totals.visitedCount}</Text>
            <Text style={styles.kpiLabel}>Ziyaret</Text>
          </View>
          <View style={[styles.kpiTile, { backgroundColor: colors.positiveBg }]}>
            <Text style={[styles.kpiVal, { color: colors.positive }]}>{totals.customerCount}</Text>
            <Text style={[styles.kpiLabel, { color: colors.positive }]}>Müşteri</Text>
          </View>
          <View style={[styles.kpiTile, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.kpiVal, { color: '#92400e', fontSize: 18 }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtTL(totals.sales)}
            </Text>
            <Text style={[styles.kpiLabel, { color: '#92400e' }]}>Satış</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : error ? (
          <Card><EmptyState icon="⚠️" title="Geçmiş yüklenemedi" subtitle={error} /></Card>
        ) : grouped.length === 0 ? (
          <Card>
            <EmptyState
              icon="📭"
              title="Bu aralıkta ziyaret yok"
              subtitle="Mobil planın üzerinden müşteri ziyareti yapıldığında burada gün gün listelenir"
            />
          </Card>
        ) : (
          grouped.map(day => (
            <View key={day.date} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{fmtDateLabel(day.date)}</Text>
                <View style={styles.dayStats}>
                  <Text style={styles.dayStatsText}>
                    {day.visitedCount}/{day.totalCount} ziyaret · {fmtTL(day.sales)}
                  </Text>
                </View>
              </View>

              {day.items.map(v => {
                const visited = !!v.visited;
                const time = fmtTime(v.check_in_at);
                const duration = fmtDuration(v.check_in_at, v.check_out_at);
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('VisitDetail', {
                      customerId: v.customer_id,
                      customerName: v.customer_name,
                    })}
                    style={[styles.visitRow, !visited && { opacity: 0.6 }]}
                  >
                    <View style={[styles.visitDot, {
                      backgroundColor: visited ? colors.positive : colors.borderLight,
                    }]}>
                      <Text style={[styles.visitDotText, { color: visited ? '#fff' : colors.textTertiary }]}>
                        {visited ? '✓' : '·'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.visitCustomer} numberOfLines={1}>{v.customer_name || `Müşteri #${v.customer_id}`}</Text>
                      <View style={styles.visitMetaRow}>
                        {time ? <Text style={styles.visitMeta}>🕓 {time}</Text> : null}
                        {duration ? <Text style={styles.visitMeta}>⏱ {duration}</Text> : null}
                        {!visited ? <Text style={[styles.visitMeta, { color: colors.critical }]}>Atlandı</Text> : null}
                      </View>
                      {v.notes ? (
                        <Text style={styles.visitNote} numberOfLines={2}>📝 {v.notes}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.visitAmount, v.sale_amount > 0 && { color: colors.positive }]}>
                        {fmtTL(v.sale_amount)}
                      </Text>
                      <Text style={styles.visitChev}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 14, paddingBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  rangeBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full, padding: 3, gap: 2,
    marginTop: 12,
  },
  rangeBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.full },
  rangeBtnActive: { backgroundColor: '#fff' },
  rangeText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  rangeTextActive: { color: colors.brand },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  kpiTile: { flex: 1, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '900', color: colors.brand },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: colors.brand, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  dayBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dayLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  dayStats: {},
  dayStatsText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  visitRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  visitDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  visitDotText: { fontSize: 13, fontWeight: '900' },
  visitCustomer: { fontSize: 13, fontWeight: '800', color: colors.text },
  visitMetaRow: { flexDirection: 'row', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  visitMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  visitNote: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  visitAmount: { fontSize: 13, fontWeight: '800', color: colors.text },
  visitChev: { fontSize: 18, color: colors.textTertiary, fontWeight: '300', marginTop: 2 },
});
