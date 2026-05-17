import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, RefreshControl,
  TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Tag, EmptyState, Card } from '../components/ui';
import HeaderActions from '../components/HeaderActions';

export default function CustomersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'mine'
  const [myCustomerIds, setMyCustomerIds] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const r = await api.get('/customers/', { params: { limit: 500 } });
      setItems(r.data || []);

      // Kullanıcının bölgesindeki müşterileri bul
      if (user?.cluster_index != null) {
        try {
          const plansRes = await api.get('/plans/');
          const completed = (plansRes.data || []).filter(p => p.status === 'completed');
          const latest = completed[0];
          if (latest) {
            const mine = await api.get(`/plans/${latest.id}/my-plan`);
            const ids = new Set((mine.data?.clusters || []).map(c => c.customer_id));
            setMyCustomerIds(ids);
          }
        } catch {}
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cluster_index]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'mine') list = list.filter(c => myCustomerIds.has(c.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }
    return list;
  }, [items, filter, search, myCustomerIds]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('VisitDetail', {
        customerId: item.id,
        customerName: item.name,
        visitOrder: null,
        estimatedArrival: null,
      })}
      style={styles.card}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.address || `${item.x?.toFixed(3)}, ${item.y?.toFixed(3)}`}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
          {item.customer_type ? <Tag label={item.customer_type} /> : null}
          <Tag label={`${item.visit_frequency}x/ay`} color={colors.brandPurple} bg="#f3e8ff" />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amount}>{Number(item.monthly_revenue || 0).toLocaleString('tr-TR')} ₺</Text>
        <Text style={styles.amountLabel}>aylık</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Müşteriler</Text>
            <Text style={styles.heroSub}>{filtered.length} kayıt</Text>
          </View>
          <HeaderActions />
        </View>

        <View style={styles.searchBox}>
          <Text style={{ fontSize: 16 }}>🔎</Text>
          <TextInput
            placeholder="İsim, adres, telefon ara..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.segments}>
          <SegBtn label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
          <SegBtn label="Bölgem" active={filter === 'mine'} onPress={() => setFilter('mine')} disabled={!myCustomerIds.size} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ padding: 16 }}>
          <Card>
            <EmptyState icon="🔍" title="Eşleşen müşteri yok" subtitle="Filtreyi değiştir ya da aramayı temizle" />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        />
      )}
    </View>
  );
}

function SegBtn({ label, active, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.segBtn, active && styles.segBtnActive, disabled && { opacity: 0.4 }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 18 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md, paddingHorizontal: 14,
    marginTop: 14, height: 44, gap: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  clearBtn: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  segments: { flexDirection: 'row', marginTop: 10, gap: 6 },
  segBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  segTextActive: { color: colors.brand },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadow.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: colors.brand, fontWeight: '800', fontSize: 18 },
  name: { fontSize: 14, fontWeight: '800', color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  amount: { fontSize: 13, fontWeight: '800', color: colors.text },
  amountLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
});
