import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, StatusBar, ActivityIndicator, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, Tag, EmptyState } from '../components/ui';

const POLL_INTERVAL_MS = 15000;
const LAST_SEEN_KEY = 'announcements_last_seen_id';

const CATEGORY_LABELS = {
  general: { label: 'Genel', color: colors.brand, bg: colors.brandLight, icon: '📢' },
  urgent: { label: 'Acil', color: colors.negative, bg: colors.negativeBg, icon: '🚨' },
  warning: { label: 'Uyarı', color: colors.critical, bg: colors.criticalBg, icon: '⚠️' },
  info: { label: 'Bilgi', color: colors.informative, bg: colors.informativeBg, icon: 'ℹ️' },
  success: { label: 'Başarı', color: colors.positive, bg: colors.positiveBg, icon: '✅' },
};

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

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSeenId, setLastSeenId] = useState(0);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {} else {}
    try {
      const res = await api.get('/announcements/');
      setItems(res.data || []);
      const maxId = (res.data || []).reduce((m, a) => Math.max(m, a.id), 0);
      if (maxId > 0) {
        await AsyncStorage.setItem(LAST_SEEN_KEY, String(maxId));
        setLastSeenId(maxId);
      }
    } catch (e) {
      // silent fail on polling
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial last-seen
  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
      setLastSeenId(parseInt(v || '0', 10));
    })();
  }, []);

  // Polling while focused + active
  useFocusEffect(useCallback(() => {
    load();
    intervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') load({ silent: true });
    }, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => { appStateRef.current = s; });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => {
    const cat = getCategory(item.category);
    const isNew = item.id > lastSeenId;
    return (
      <View style={[styles.card, isNew && styles.cardNew]}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
            <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Tag label={cat.label} color={cat.color} bg={cat.bg} />
              {isNew ? <Tag label="Yeni" color="#fff" bg={colors.negative} /> : null}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.content}</Text>
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View>
          <Text style={styles.heroTitle}>Duyurular</Text>
          <Text style={styles.heroSub}>Her 15 saniyede bir güncellenir</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : items.length === 0 ? (
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
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 18 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow.sm,
  },
  cardNew: {
    borderColor: colors.negative,
    borderWidth: 1.5,
  },
  row: { flexDirection: 'row' },
  iconBox: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaText: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
  metaDot: { fontSize: 11, color: colors.textTertiary, marginHorizontal: 6 },
});
