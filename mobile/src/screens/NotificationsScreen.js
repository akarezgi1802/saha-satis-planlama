import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, StatusBar, ActivityIndicator,
  AppState, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, Tag, EmptyState } from '../components/ui';

const POLL_INTERVAL_MS = 15000;
const LAST_SEEN_KEY = 'announcements_last_seen_id';
const LAST_SEEN_CAMP_KEY = 'campaigns_last_seen_id';

const CATEGORY_LABELS = {
  general:   { label: 'Genel',  color: colors.brand,       bg: colors.brandLight,    icon: '📢' },
  urgent:    { label: 'Acil',   color: colors.negative,    bg: colors.negativeBg,    icon: '🚨' },
  warning:   { label: 'Uyarı',  color: colors.critical,    bg: colors.criticalBg,    icon: '⚠️' },
  info:      { label: 'Bilgi',  color: colors.informative, bg: colors.informativeBg, icon: 'ℹ️' },
  success:   { label: 'Başarı', color: colors.positive,    bg: colors.positiveBg,    icon: '✅' },
  campaign:  { label: 'Kampanya', color: colors.accent,    bg: colors.accentLight,   icon: '🎯' },
  incentive: { label: 'Teşvik', color: colors.positive,    bg: colors.positiveBg,    icon: '🏆' },
};

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

function getCategory(cat) {
  return CATEGORY_LABELS[(cat || '').toLowerCase()] || CATEGORY_LABELS.general;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = d.toDateString() === today.toDateString();
  const sameYesterday = d.toDateString() === yesterday.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `Bugün ${hh}:${mm}`;
  if (sameYesterday) return `Dün ${hh}:${mm}`;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${hh}:${mm}`;
}

function daysLeft(until) {
  if (!until) return null;
  const ms = new Date(until) - new Date();
  return Math.ceil(ms / 86400000);
}

function fmtDateOnly(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR');
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const routeParam = useRoute();
  const navigation = useNavigation();
  const [tab, setTab] = useState(routeParam.params?.tab === 'campaigns' ? 'campaigns' : 'announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSeenAnn, setLastSeenAnn] = useState(0);
  const [lastSeenCamp, setLastSeenCamp] = useState(0);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const load = useCallback(async () => {
    try {
      const [annR, campR] = await Promise.all([
        api.get('/announcements/'),
        api.get('/campaigns/', { params: { active_only: true } }).catch(() => ({ data: [] })),
      ]);
      setAnnouncements(annR.data || []);
      setCampaigns(campR.data || []);

      const maxAnn = (annR.data || []).reduce((m, a) => Math.max(m, a.id), 0);
      const maxCamp = (campR.data || []).reduce((m, a) => Math.max(m, a.id), 0);
      if (maxAnn > 0) {
        await AsyncStorage.setItem(LAST_SEEN_KEY, String(maxAnn));
        setLastSeenAnn(maxAnn);
      }
      if (maxCamp > 0) {
        await AsyncStorage.setItem(LAST_SEEN_CAMP_KEY, String(maxCamp));
        setLastSeenCamp(maxCamp);
      }
    } catch (e) {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const a = await AsyncStorage.getItem(LAST_SEEN_KEY);
      const c = await AsyncStorage.getItem(LAST_SEEN_CAMP_KEY);
      setLastSeenAnn(parseInt(a || '0', 10));
      setLastSeenCamp(parseInt(c || '0', 10));
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    intervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') load();
    }, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => { appStateRef.current = s; });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [load]));

  // Eğer route'tan tab parametresi gelirse sekmeyi değiştir
  useEffect(() => {
    if (routeParam.params?.tab === 'campaigns') setTab('campaigns');
  }, [routeParam.params?.tab]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const annUnread = announcements.filter(a => a.id > lastSeenAnn).length;
  const campUnread = campaigns.filter(c => c.id > lastSeenCamp).length;

  const renderAnnouncement = ({ item }) => {
    const cat = getCategory(item.category);
    const isNew = item.id > lastSeenAnn;
    return (
      <View style={[styles.annCard, isNew && styles.cardNew]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
            <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Tag label={cat.label} color={cat.color} bg={cat.bg} />
              {isNew ? <Tag label="Yeni" color="#fff" bg={colors.negative} /> : null}
            </View>
            <Text style={styles.annTitle}>{item.title}</Text>
            <Text style={styles.annBody}>{item.content}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.author_name || '—'}</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{fmtDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCampaign = ({ item }) => {
    const bs = brandStyle(item.brand);
    const left = daysLeft(item.valid_until);
    const isNew = item.id > lastSeenCamp;
    const expired = left != null && left < 0;
    return (
      <View style={[styles.campCard, isNew && styles.cardNew, expired && { opacity: 0.6 }]}>
        {/* Banner */}
        <View style={[styles.campBanner, { backgroundColor: bs.bg }]}>
          <View style={styles.campBannerRow}>
            <Text style={[styles.campBrand, { color: bs.fg }]}>{bs.emoji} {item.brand}</Text>
            {item.discount_text ? (
              <View style={styles.campDiscount}>
                <Text style={[styles.campDiscountText, { color: bs.fg }]}>{item.discount_text}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.campTitle, { color: bs.fg }]}>{item.title}</Text>
          {isNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>YENİ</Text>
            </View>
          ) : null}
        </View>
        {/* Body */}
        <View style={{ padding: 14 }}>
          <Text style={styles.campDesc}>{item.description}</Text>
          <View style={styles.campFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.campDates}>
                {fmtDateOnly(item.valid_from)} → {fmtDateOnly(item.valid_until)}
              </Text>
              {left != null ? (
                <Text style={[styles.campLeft, { color: expired ? colors.negative : (left <= 3 ? colors.critical : colors.positive) }]}>
                  {expired ? '⏳ Süresi bitti' : `⏱ ${left} gün kaldı`}
                </Text>
              ) : null}
            </View>
            <Text style={styles.campAuthor}>{item.author_name}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.heroTitle}>Bildirimler</Text>
            <Text style={styles.heroSub}>Her 15 saniyede bir güncellenir</Text>
          </View>
        </View>

        <View style={styles.segments}>
          <SegButton
            label="Duyurular"
            count={announcements.length}
            badge={annUnread}
            active={tab === 'announcements'}
            onPress={() => setTab('announcements')}
          />
          <SegButton
            label="Kampanyalar"
            count={campaigns.length}
            badge={campUnread}
            active={tab === 'campaigns'}
            onPress={() => setTab('campaigns')}
          />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : tab === 'announcements' ? (
        announcements.length === 0 ? (
          <View style={{ padding: 16 }}>
            <Card>
              <EmptyState
                icon="📭"
                title="Henüz duyuru yok"
                subtitle="Yöneticin yeni bir duyuru paylaştığında otomatik olarak burada görünecek"
              />
            </Card>
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(i) => 'a-' + i.id}
            renderItem={renderAnnouncement}
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )
      ) : (
        campaigns.length === 0 ? (
          <View style={{ padding: 16 }}>
            <Card>
              <EmptyState
                icon="🎯"
                title="Aktif kampanya yok"
                subtitle="Yöneticin Frito-Lay markası için kampanya oluşturduğunda burada görünecek"
              />
            </Card>
          </View>
        ) : (
          <FlatList
            data={campaigns}
            keyExtractor={(i) => 'c-' + i.id}
            renderItem={renderCampaign}
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )
      )}
    </View>
  );
}

function SegButton({ label, count, badge, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.segBtn, active && styles.segBtnActive]}>
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>{label}</Text>
      <View style={[styles.segCount, active && styles.segCountActive]}>
        <Text style={[styles.segCountText, active && styles.segCountTextActive]}>{count}</Text>
      </View>
      {badge > 0 ? (
        <View style={styles.segBadge}>
          <Text style={styles.segBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -4 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  segments: {
    flexDirection: 'row', gap: 6, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full, padding: 3,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: radius.full, gap: 6,
    position: 'relative',
  },
  segBtnActive: { backgroundColor: '#fff' },
  segLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 12 },
  segLabelActive: { color: colors.brand },
  segCount: {
    minWidth: 20, height: 18, borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  segCountActive: { backgroundColor: colors.brandLight },
  segCountText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  segCountTextActive: { color: colors.brand },
  segBadge: {
    position: 'absolute', top: -2, right: 4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.negative,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.brand,
  },
  segBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Announcement card
  annCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, ...shadow.sm,
  },
  cardNew: { borderColor: colors.negative, borderWidth: 1.5 },
  row: { flexDirection: 'row' },
  iconBox: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  annTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 },
  annBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaText: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
  metaDot: { fontSize: 11, color: colors.textTertiary, marginHorizontal: 6 },

  // Campaign card
  campCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  campBanner: { padding: 16, position: 'relative' },
  campBannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  campBrand: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  campDiscount: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.full,
  },
  campDiscountText: { fontSize: 13, fontWeight: '800' },
  campTitle: { fontSize: 18, fontWeight: '900', marginTop: 8, lineHeight: 22 },
  newBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.negative,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.sm,
  },
  newBadgeText: { color: '#fff', fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },
  campDesc: { fontSize: 13, color: colors.text, lineHeight: 19, fontWeight: '500' },
  campFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  campDates: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  campLeft: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  campAuthor: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
});
