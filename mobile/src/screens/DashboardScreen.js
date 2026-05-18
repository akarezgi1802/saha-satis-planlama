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
import { colors, radius, spacing, shadow, brandGradient, positiveGradient } from '../theme';
import { Card, KpiTile, SectionTitle, EmptyState } from '../components/ui';
import HeaderActions from '../components/HeaderActions';

const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const BRAND_STYLES = {
  "Lay's":   { bg: '#fcd34d', fg: '#92400e', emoji: '🥔' },
  "Doritos": { bg: '#dc2626', fg: '#fff',    emoji: '🌶️' },
  "Cheetos": { bg: '#f97316', fg: '#fff',    emoji: '🧀' },
  "Ruffles": { bg: '#1e40af', fg: '#fff',    emoji: '〰️' },
  "Cipsi":   { bg: '#0891b2', fg: '#fff',    emoji: '🥨' },
  "Tang":    { bg: '#fbbf24', fg: '#7c2d12', emoji: '🍊' },
};

function brandStyle(b) {
  return BRAND_STYLES[b] || { bg: colors.brand, fg: '#fff', emoji: '📦' };
}

function ProgressRing({ percent = 0, size = 96, stroke = 10, color = colors.positive, label }) {
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
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{label != null ? label : `${Math.round(percent)}%`}</Text>
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

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState(null);
  const [todayTarget, setTodayTarget] = useState(null);
  const [sustainability, setSustainability] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, t, sus, a, c] = await Promise.all([
        api.get('/performance/summary'),
        api.get('/performance/today-target').catch(() => ({ data: null })),
        api.get('/performance/sustainability').catch(() => ({ data: null })),
        api.get('/announcements/'),
        api.get('/campaigns/', { params: { active_only: true } }).catch(() => ({ data: [] })),
      ]);
      setSummary(s.data);
      setTodayTarget(t.data);
      setSustainability(sus.data);
      setAnnouncements(a.data || []);
      setCampaigns(c.data || []);
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
  const weekVisits = summary?.this_week?.visit_count || 0;

  const planned = todayTarget?.planned || 0;
  const completed = todayTarget?.completed || 0;
  const remaining = Math.max(0, planned - completed);
  const targetPercent = planned ? Math.round((completed / planned) * 100) : 0;
  const isWeekend = todayTarget?.is_weekend;

  const susWeek = sustainability?.this_week || {};
  const treesWeek = susWeek.trees_equivalent || 0;
  const co2Week = susWeek.co2_saved_kg || 0;
  const kmSavedWeek = susWeek.km_saved || 0;

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
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View style={styles.heroRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.85}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.full_name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.heroGreet}>{greeting()}, {user?.full_name?.split(' ')[0] || ''}</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          <HeaderActions />
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

            {/* Bugünün ziyaret hedefi kartı */}
            <Card style={{ marginTop: -36 }}>
              <View style={styles.targetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetLabel}>BUGÜN'ÜN ZİYARET HEDEFİ</Text>
                  {isWeekend ? (
                    <>
                      <Text style={styles.targetValue}>Hafta sonu</Text>
                      <Text style={styles.targetSubtle}>Bugün rota yok — dinlenmenin keyfini çıkar ☕</Text>
                    </>
                  ) : planned > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Text style={styles.targetValue}>{completed}</Text>
                        <Text style={styles.targetSub}> / {planned} ziyaret</Text>
                      </View>
                      <View style={styles.targetChips}>
                        {targetPercent >= 100 ? (
                          <View style={[styles.targetChip, { backgroundColor: colors.positiveBg }]}>
                            <Text style={[styles.targetChipText, { color: colors.positive }]}>🏆 Bugün tamamlandı</Text>
                          </View>
                        ) : remaining > 0 ? (
                          <View style={[styles.targetChip, { backgroundColor: colors.criticalBg }]}>
                            <Text style={[styles.targetChipText, { color: colors.critical }]}>{remaining} ziyaret kaldı</Text>
                          </View>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.targetValue, { color: colors.textTertiary }]}>—</Text>
                      <Text style={styles.targetSubtle}>Bugün için planlanmış ziyaret yok</Text>
                    </>
                  )}
                </View>
                <ProgressRing
                  percent={targetPercent}
                  color={targetPercent >= 100 ? colors.positive : targetPercent >= 50 ? colors.brand : colors.accent}
                  label={planned > 0 ? `${completed}/${planned}` : '—'}
                />
              </View>

              {planned > 0 && !isWeekend ? (
                <View style={styles.targetBar}>
                  <View style={[styles.targetBarFill, {
                    width: `${Math.min(100, targetPercent)}%`,
                    backgroundColor: targetPercent >= 100 ? colors.positive : colors.brand,
                  }]} />
                </View>
              ) : null}

              {planned > 0 && !isWeekend ? (
                <TouchableOpacity onPress={() => navigation.navigate('Plan')} activeOpacity={0.8} style={styles.planLink}>
                  <Text style={styles.planLinkText}>📍 Bugünün rotasını gör →</Text>
                </TouchableOpacity>
              ) : null}
            </Card>

            <SectionTitle>Bugün</SectionTitle>
            <View style={styles.kpiRow}>
              <KpiTile label="Satış" value={formatTL(todaySales, false)} unit="₺" accent={colors.positive} />
              <KpiTile label="Tamamlanan" value={todayVisits} unit="ziyaret" accent={colors.brand} />
              <KpiTile label="Müşteri" value={todayCustomers} unit="" accent={colors.brandPurple} />
            </View>

            {/* AI Asistan — büyük çekici CTA kartı */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('AIAssistant')}
              style={{ marginTop: spacing.md }}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.aiCta}
              >
                <View style={styles.aiCtaIcon}>
                  <Text style={{ fontSize: 28 }}>🤖</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiCtaTitle}>AI Asistan</Text>
                  <Text style={styles.aiCtaSub}>
                    Bugünkü özetini iste, satış tavsiyesi al, müşteri için hazırlan
                  </Text>
                </View>
                <Text style={styles.aiCtaChev}>›</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Kampanyalar */}
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

            {/* Hızlı erişim — Müşteriler + Görevler */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
              <TouchableLink
                icon="👥"
                title="Müşteriler"
                subtitle="Bölgemdekiler"
                onPress={() => navigation.navigate('Customers')}
              />
              <TouchableLink
                icon="📝"
                title="Görevlerim"
                subtitle="Yapılacaklar"
                onPress={() => navigation.navigate('Tasks')}
                accent={colors.accent}
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
  heroGreet: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  heroDate: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  avatar: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },

  // Target card
  targetRow: { flexDirection: 'row', alignItems: 'center' },
  targetLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 },
  targetValue: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  targetSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  targetSubtle: { fontSize: 12, color: colors.textTertiary, marginTop: 4, fontWeight: '500' },
  targetChips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  targetChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  targetChipText: { fontSize: 11, fontWeight: '800' },
  targetBar: {
    height: 8, backgroundColor: colors.borderLight,
    borderRadius: 4, marginTop: 14, overflow: 'hidden',
  },
  targetBarFill: { height: 8, borderRadius: 4 },
  planLink: { marginTop: 12, alignItems: 'flex-start' },
  planLinkText: { color: colors.brand, fontWeight: '800', fontSize: 13 },

  // Sustainability card
  susCard: {
    marginTop: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#a7f3d0',
    ...shadow.sm,
  },
  susBanner: { padding: 16 },
  susBannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  susLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  susTreesValue: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  susTreesUnit: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  susSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  susBigEmoji: { fontSize: 56 },
  susStats: {
    flexDirection: 'row',
    paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: colors.positiveBg,
  },
  susStat: { flex: 1, alignItems: 'center' },
  susDivider: { width: 1, backgroundColor: '#a7f3d0', marginVertical: 4 },
  susStatVal: { fontSize: 18, fontWeight: '900', color: colors.positive },
  susStatLabel: { fontSize: 10, fontWeight: '700', color: colors.positive, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  kpiRow: { flexDirection: 'row', gap: 10 },
  linkText: { color: colors.brand, fontWeight: '700', fontSize: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dayName: { width: 40, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 4, marginHorizontal: 10, position: 'relative', overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  dayVal: { width: 90, fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'right' },

  // Kampanya carousel
  campCard: {
    width: 220, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm,
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
    backgroundColor: colors.surface, borderRadius: radius.md,
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

  // AI CTA kartı
  aiCta: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md,
    padding: 16, gap: 14,
    ...shadow.md,
  },
  aiCtaIcon: {
    width: 54, height: 54, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  aiCtaTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  aiCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  aiCtaChev: { color: '#fff', fontSize: 32, fontWeight: '300' },
});
