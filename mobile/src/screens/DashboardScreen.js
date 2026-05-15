import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, StatusBar, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../AuthContext';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient, dashboardGradient, positiveGradient } from '../theme';
import { Card, KpiTile, SectionTitle, EmptyState } from '../components/ui';

const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function ProgressRing({ percent = 0, size = 84, stroke = 9, color = colors.positive }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{`${Math.round(percent)}%`}</Text>
        </View>
      </View>
    </View>
  );
}

function formatTL(n) {
  if (n == null) return '0 ₺';
  return `${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`;
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, a] = await Promise.all([
        api.get('/performance/summary'),
        api.get('/announcements/'),
      ]);
      setSummary(s.data);
      setAnnouncements(a.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const today = new Date();
  const todayLabel = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()} ${DAY_NAMES_TR[today.getDay()]}`;

  const todaySales = summary?.today?.total_sales || 0;
  const todayVisits = summary?.today?.visit_count || 0;
  const todayCustomers = summary?.today?.customer_count || 0;
  const weekSales = summary?.this_week?.total_sales || 0;
  const monthSales = summary?.this_month?.total_sales || 0;

  // Simple "goal" — 12M monthly target like the mockup
  const monthlyTarget = 12_000_000;
  const monthlyPercent = monthlyTarget ? Math.min(100, (monthSales / monthlyTarget) * 100) : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={dashboardGradient} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreet}>{greeting()}, {user?.full_name?.split(' ')[0] || ''}</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          <View style={styles.bellWrap}>
            <Text style={styles.bell}>🔔</Text>
            {announcements?.length ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{announcements.length > 9 ? '9+' : announcements.length}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {loading && !summary ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorStrip}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Hedefler kartı */}
            <Card style={{ marginTop: -36 }}>
              <View style={styles.goalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalLabel}>Hedefler</Text>
                  <Text style={styles.goalTitle}>Aylık Satış</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                    <Text style={styles.goalValue}>{formatTL(monthSales)}</Text>
                    <Text style={styles.goalSub}> / {formatTL(monthlyTarget)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text style={styles.goalDelta}>↗ {monthlyPercent.toFixed(1)}%</Text>
                    <Text style={styles.goalAuthor}>  {user?.full_name}</Text>
                  </View>
                </View>
                <ProgressRing percent={monthlyPercent} color={monthlyPercent >= 80 ? colors.positive : colors.accent} />
              </View>
              <View style={styles.goalFooter}>
                <Text style={[styles.goalFooterText, { color: monthlyPercent >= 80 ? colors.positive : colors.accent }]}>
                  {monthlyPercent >= 80 ? 'Minimum hedefe ulaşıldı' : 'Hedefin altında — devam et'}
                </Text>
              </View>
            </Card>

            <SectionTitle>Özet</SectionTitle>
            <View style={styles.kpiRow}>
              <KpiTile label="Bugün Satış" value={formatTL(todaySales).replace(' ₺', '')} unit="₺" accent={colors.positive} />
              <KpiTile label="Bugün Ziyaret" value={todayVisits} unit="kişi" accent={colors.brand} />
              <KpiTile label="Müşteri" value={todayCustomers} unit="kişi" accent={colors.accent} />
            </View>
            <View style={[styles.kpiRow, { marginTop: 10 }]}>
              <KpiTile label="Hafta Satış" value={formatTL(weekSales).replace(' ₺', '')} unit="₺" accent={colors.brandPurple} />
              <KpiTile label="Ay Satış" value={formatTL(monthSales).replace(' ₺', '')} unit="₺" accent={colors.informative} />
            </View>

            <SectionTitle right={
              <Text style={styles.linkText} onPress={() => navigation.navigate('Plan')}>Tümünü gör →</Text>
            }>
              Bu Hafta
            </SectionTitle>

            <Card>
              {summary?.daily_breakdown?.map((d, i) => {
                const max = Math.max(1, ...(summary.daily_breakdown.map(x => x.sales)));
                const h = Math.max(6, Math.round((d.sales / max) * 60));
                return (
                  <View key={i} style={styles.dayRow}>
                    <Text style={styles.dayName}>{d.day_name}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { width: `${(d.sales / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.dayVal}>{formatTL(d.sales)}</Text>
                  </View>
                );
              })}
              {(!summary?.daily_breakdown || summary.daily_breakdown.every(d => d.sales === 0)) ? (
                <EmptyState icon="📊" title="Henüz satış yok" subtitle="İlk ziyaretini tamamladığında burada görünür" />
              ) : null}
            </Card>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <TouchableLink
                icon="👥"
                title="Müşteriler"
                subtitle="Bölgemdeki müşteriler"
                onPress={() => navigation.navigate('Customers')}
              />
              <TouchableLink
                icon="🤖"
                title="AI Asistan"
                subtitle="Sohbet et / hazırlan"
                onPress={() => navigation.navigate('AI')}
                accent={colors.brandPurple}
              />
            </View>

            <SectionTitle right={
              <Text style={styles.linkText} onPress={() => navigation.navigate('Announcements')}>Tümü →</Text>
            }>
              Son Duyurular
            </SectionTitle>

            {announcements.length === 0 ? (
              <Card>
                <EmptyState icon="📭" title="Duyuru yok" subtitle="Yönetici duyuru paylaştığında burada görünür" />
              </Card>
            ) : (
              announcements.slice(0, 3).map((a) => (
                <View key={a.id} style={styles.annCard}>
                  <View style={[styles.annDot, { backgroundColor: categoryColor(a.category) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.annTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.annContent} numberOfLines={2}>{a.content}</Text>
                    <Text style={styles.annMeta}>{a.author_name} • {timeAgo(a.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TouchableLink({ icon, title, subtitle, onPress, accent = colors.brand }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.linkCard}>
      <View style={[styles.linkIcon, { backgroundColor: accent + '22' }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.linkChev, { color: accent }]}>›</Text>
    </TouchableOpacity>
  );
}

function categoryColor(cat) {
  switch ((cat || '').toLowerCase()) {
    case 'urgent': return colors.negative;
    case 'warning': return colors.critical;
    case 'info': return colors.informative;
    default: return colors.brand;
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 56 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroGreet: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  bellWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  bell: { fontSize: 20 },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.negative,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.informative,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  goalRow: { flexDirection: 'row', alignItems: 'center' },
  goalLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
  goalTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  goalValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  goalSub: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  goalDelta: { fontSize: 12, fontWeight: '700', color: colors.positive },
  goalAuthor: { fontSize: 12, color: colors.textSecondary },
  goalFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  goalFooterText: { fontSize: 12, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 10 },
  linkText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dayName: { width: 40, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 4, marginHorizontal: 10 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  dayVal: { width: 90, fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'right' },
  annCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...shadow.sm,
  },
  annDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12, marginTop: 6 },
  annTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  annContent: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  annMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 6, fontWeight: '600' },
  errorStrip: {
    backgroundColor: colors.criticalBg,
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: colors.critical, fontSize: 12, fontWeight: '600' },
  linkCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, ...shadow.sm,
  },
  linkIcon: {
    width: 40, height: 40, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  linkTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  linkSubtitle: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },
  linkChev: { fontSize: 22, fontWeight: '800' },
});
