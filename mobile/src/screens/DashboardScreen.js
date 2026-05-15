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

// Frito-Lay marka renkleri
const BRAND_STYLES = {
  "Lay's": { bg: '#fcd34d', fg: '#92400e', emoji: '🥔' },
  "Doritos": { bg: '#dc2626', fg: '#fff', emoji: '🌶️' },
  "Cheetos": { bg: '#f97316', fg: '#fff', emoji: '🧀' },
  "Ruffles": { bg: '#1e40af', fg: '#fff', emoji: '〰️' },
  "Cipsi": { bg: '#0891b2', fg: '#fff', emoji: '🥨' },
  "Tang": { bg: '#fbbf24', fg: '#7c2d12', emoji: '🍊' },
};

function brandStyle(b) {
  return BRAND_STYLES[b] || { bg: colors.brand, fg: '#fff', emoji: '📦' };
}

function ProgressRing({ percent = 0, size = 92, stroke = 10, color = colors.positive }) {
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
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{`${Math.round(percent)}%`}</Text>
        </View>
      </View>
    </View>
  );
}

function formatTL(n, withSuffix = true) {
  if (n == null) return withSuffix ? '0 ₺' : '0';
  const s = Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  return withSuffix ? `${s} ₺` : s;
}

function daysLeft(until) {
  if (!until) return null;
  const ms = new Date(until) - new Date();
  return Math.ceil(ms / 86400000);
}

function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function dayOfMonth() { return new Date().getDate(); }

export default function DashboardScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, a, c] = await Promise.all([
        api.get('/performance/summary'),
        api.get('/announcements/'),
        api.get('/campaigns/', { params: { active_only: true } }).catch(() => ({ data: [] })),
      ]);
      setSummary(s.data);
      setAnnouncements(a.data || []);
      setCampaigns(c.data || []);
      refreshUser();
    } catch (e) {
      setError(e.response?.data?.detail || 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const today = new Date();
  const todayLabel = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()} ${DAY_NAMES_TR[today.getDay()]}`;

  const todaySales = summary?.today?.total_sales || 0;
  const todayVisits = summary?.today?.visit_count || 0;
  const todayCustomers = summary?.today?.customer_count || 0;
  const weekSales = summary?.this_week?.total_sales || 0;
  const monthSales = summary?.this_month?.total_sales || 0;
  const weekVisits = summary?.this_week?.visit_count || 0;

  // Gerçek hedef — admin atadıysa
  const monthlyTarget = user?.monthly_target || 0;
  const hasTarget = monthlyTarget > 0;
  const monthlyPercent = hasTarget ? Math.min(100, (monthSales / monthlyTarget) * 100) : 0;
  const remainingTL = Math.max(0, monthlyTarget - monthSales);
  const daysRemaining = Math.max(1, daysInCurrentMonth() - dayOfMonth() + 1);
  const dailyTargetNeeded = hasTarget ? remainingTL / daysRemaining : 0;
  const dailyTargetAvg = hasTarget ? monthlyTarget / daysInCurrentMonth() : 0;

  // Streak: bu hafta günde >= dailyTargetAvg yapılan gün sayısı
  const streak = summary?.daily_breakdown?.filter(d => hasTarget && d.sales >= dailyTargetAvg).length || 0;

  // Önceki haftaya kıyas yok backend'de — placeholder
  const onTrackToday = hasTarget && todaySales >= dailyTargetAvg;

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
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellWrap} activeOpacity={0.85}>
            <Text style={styles.bell}>🔔</Text>
            {(announcements?.length + campaigns?.length) ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {(announcements.length + campaigns.length) > 9 ? '9+' : (announcements.length + campaigns.length)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
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

            {/* Hedef kartı */}
            <Card style={{ marginTop: -36 }}>
              <View style={styles.goalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalLabel}>AYLIK HEDEF</Text>
                  {hasTarget ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Text style={styles.goalValue}>{formatTL(monthSales, false)}</Text>
                        <Text style={styles.goalSub}> / {formatTL(monthlyTarget)}</Text>
                      </View>
                      <View style={styles.goalChips}>
                        <View style={[styles.goalChip, { backgroundColor: monthlyPercent >= 80 ? colors.positiveBg : colors.criticalBg }]}>
                          <Text style={[styles.goalChipText, { color: monthlyPercent >= 80 ? colors.positive : colors.critical }]}>
                            {monthlyPercent >= 100 ? '🏆 Hedef aşıldı' : monthlyPercent >= 80 ? '✓ Hedefe yakın' : '↗ Devam'}
                          </Text>
                        </View>
                        <Text style={styles.goalDays}>{daysRemaining} gün kaldı</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.goalValue, { color: colors.textTertiary, marginTop: 6 }]}>—</Text>
                      <Text style={styles.goalNoTarget}>Yöneticin hedef atamamış</Text>
                    </>
                  )}
                </View>
                <ProgressRing
                  percent={monthlyPercent}
                  color={!hasTarget ? colors.border : monthlyPercent >= 80 ? colors.positive : colors.accent}
                />
              </View>

              {hasTarget && monthlyPercent < 100 ? (
                <View style={styles.dailyHint}>
                  <Text style={styles.dailyHintLabel}>Günlük hedefin</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={styles.dailyHintValue}>{formatTL(dailyTargetNeeded)}</Text>
                    <Text style={styles.dailyHintMeta}>· günde ortalama gerek</Text>
                  </View>
                </View>
              ) : null}
            </Card>

            <SectionTitle>Bugün</SectionTitle>
            <View style={styles.kpiRow}>
              <KpiTile label="Satış" value={formatTL(todaySales, false)} unit="₺" accent={onTrackToday ? colors.positive : colors.accent} />
              <KpiTile label="Ziyaret" value={todayVisits} unit="kişi" accent={colors.brand} />
              <KpiTile label="Müşteri" value={todayCustomers} unit="" accent={colors.brandPurple} />
            </View>

            <SectionTitle>Bu Hafta · Bu Ay</SectionTitle>
            <View style={styles.kpiRow}>
              <KpiTile label="Hafta Satış" value={formatTL(weekSales, false)} unit="₺" accent={colors.brandPurple} />
              <KpiTile label="Hafta Ziy." value={weekVisits} unit="" accent={colors.informative} />
              <KpiTile label="Streak" value={streak} unit="/7" accent={streak >= 5 ? colors.positive : colors.textTertiary} />
            </View>

            {/* Kampanyalar carousel */}
            {campaigns.length > 0 ? (
              <>
                <SectionTitle right={
                  <Text style={styles.linkText} onPress={() => navigation.navigate('Notifications', { tab: 'campaigns' })}>
                    Tümü →
                  </Text>
                }>
                  🎯 Aktif Kampanyalar ({campaigns.length})
                </SectionTitle>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingRight: 14 }}
                >
                  {campaigns.slice(0, 6).map(c => {
                    const bs = brandStyle(c.brand);
                    const left = daysLeft(c.valid_until);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('Notifications', { tab: 'campaigns' })}
                        style={styles.campCard}
                      >
                        <View style={[styles.campBanner, { backgroundColor: bs.bg }]}>
                          <Text style={[styles.campBrand, { color: bs.fg }]}>{bs.emoji} {c.brand}</Text>
                          {c.discount_text ? (
                            <View style={styles.campDiscount}>
                              <Text style={[styles.campDiscountText, { color: bs.fg }]}>{c.discount_text}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={{ padding: 12 }}>
                          <Text style={styles.campTitle} numberOfLines={2}>{c.title}</Text>
                          {left != null ? (
                            <Text style={[styles.campDays, { color: left <= 3 ? colors.critical : colors.textSecondary }]}>
                              {left < 0 ? 'süresi bitti' : `${left} gün kaldı`}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <SectionTitle right={
              <Text style={styles.linkText} onPress={() => navigation.navigate('Plan')}>Plan →</Text>
            }>
              Bu Hafta Grafiği
            </SectionTitle>
            <Card>
              {summary?.daily_breakdown?.map((d, i) => {
                const max = Math.max(1, ...(summary.daily_breakdown.map(x => x.sales)));
                const onTarget = hasTarget && d.sales >= dailyTargetAvg;
                return (
                  <View key={i} style={styles.dayRow}>
                    <Text style={styles.dayName}>{d.day_name}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { width: `${(d.sales / max) * 100}%`, backgroundColor: onTarget ? colors.positive : colors.brand }]} />
                      {hasTarget && dailyTargetAvg > 0 ? (
                        <View style={[styles.barTargetLine, { left: `${Math.min(100, (dailyTargetAvg / max) * 100)}%` }]} />
                      ) : null}
                    </View>
                    <Text style={styles.dayVal}>{formatTL(d.sales)}</Text>
                  </View>
                );
              })}
              {hasTarget && dailyTargetAvg > 0 ? (
                <View style={styles.legendRow}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>Kesik çizgi = günlük hedef ({formatTL(dailyTargetAvg)})</Text>
                </View>
              ) : null}
              {(!summary?.daily_breakdown || summary.daily_breakdown.every(d => d.sales === 0)) ? (
                <EmptyState icon="📊" title="Henüz satış yok" subtitle="İlk ziyaretini tamamladığında burada görünür" />
              ) : null}
            </Card>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <TouchableLink
                icon="👥"
                title="Müşteriler"
                subtitle="Bölgemdekiler"
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
              <Text style={styles.linkText} onPress={() => navigation.navigate('Notifications')}>Tümü →</Text>
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
    case 'campaign': return colors.accent;
    case 'incentive': return colors.positive;
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
  goalLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 },
  goalValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  goalSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  goalChips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  goalChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  goalChipText: { fontSize: 11, fontWeight: '800' },
  goalDays: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  goalNoTarget: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  dailyHint: {
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  dailyHintLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 },
  dailyHintValue: { fontSize: 16, fontWeight: '800', color: colors.brand },
  dailyHintMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },

  kpiRow: { flexDirection: 'row', gap: 10 },
  linkText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dayName: { width: 40, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 4, marginHorizontal: 10, position: 'relative', overflow: 'visible' },
  bar: { height: 8, borderRadius: 4 },
  barTargetLine: {
    position: 'absolute', top: -2, bottom: -2, width: 2,
    backgroundColor: colors.text, opacity: 0.5,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  legendDot: { width: 8, height: 2, backgroundColor: colors.text, opacity: 0.5 },
  legendText: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
  dayVal: { width: 90, fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'right' },

  // Kampanya carousel
  campCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  campBanner: { padding: 12, minHeight: 56 },
  campBrand: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  campDiscount: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full,
  },
  campDiscountText: { fontSize: 11, fontWeight: '800' },
  campTitle: { fontSize: 13, fontWeight: '800', color: colors.text, lineHeight: 18 },
  campDays: { fontSize: 10, fontWeight: '700', marginTop: 6 },

  annCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10, ...shadow.sm,
  },
  annDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12, marginTop: 6 },
  annTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  annContent: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  annMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 6, fontWeight: '600' },
  errorStrip: {
    backgroundColor: colors.criticalBg,
    borderColor: '#fde68a', borderWidth: 1,
    borderRadius: radius.md, padding: 12, marginBottom: 14,
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
