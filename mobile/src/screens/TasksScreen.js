/**
 * Görevler ekranı — yöneticinin atadığı to-do listesi.
 * Sales rep: kendi görevlerini görür, status değiştirir (open → in_progress → done)
 * Admin: tüm görevleri görür, yenilerini oluşturur (web admin panel'den)
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, EmptyState, Tag, SectionTitle } from '../components/ui';
import HeaderActions from '../components/HeaderActions';

const PRIORITY_STYLES = {
  urgent: { color: colors.negative, bg: colors.negativeBg, icon: '🚨', label: 'Acil' },
  high:   { color: colors.critical, bg: colors.criticalBg, icon: '🔥', label: 'Yüksek' },
  normal: { color: colors.brand,    bg: colors.brandLight, icon: '📌', label: 'Normal' },
  low:    { color: colors.textTertiary, bg: colors.bg,     icon: '📎', label: 'Düşük' },
};

const STATUS_STYLES = {
  open:        { color: colors.brand, bg: colors.brandLight, label: 'Bekliyor' },
  in_progress: { color: colors.accent, bg: colors.accentLight, label: 'Devam ediyor' },
  done:        { color: colors.positive, bg: colors.positiveBg, label: '✓ Tamamlandı' },
  cancelled:   { color: colors.textTertiary, bg: colors.bg, label: 'İptal' },
};

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.ceil((d - today) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  if (diff > 1 && diff < 7) return `${diff} gün sonra`;
  if (diff < -1 && diff > -7) return `${-diff} gün gecikmiş`;
  return d.toLocaleDateString('tr-TR');
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('active'); // active | done | all

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        api.get('/tasks/'),
        api.get('/tasks/summary'),
      ]);
      setTasks(t.data || []);
      setSummary(s.data);
    } catch (e) {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const setStatus = async (task, newStatus) => {
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      load();
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || 'Güncellenemedi');
    }
  };

  const filtered = tasks.filter(t => {
    if (filter === 'active') return t.status === 'open' || t.status === 'in_progress';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Görevlerim</Text>
            <Text style={styles.heroSub}>
              {summary
                ? `${summary.total_active} aktif · ${summary.due_today} bugün · ${summary.overdue} gecikmiş`
                : 'Yapılacaklar ve hatırlatıcılar'}
            </Text>
          </View>
          <HeaderActions />
        </View>
      </LinearGradient>

      {/* Filtre segment'leri */}
      <View style={styles.segments}>
        <SegBtn label="Aktif" active={filter === 'active'} count={summary?.total_active} onPress={() => setFilter('active')} />
        <SegBtn label="Tamamlanan" active={filter === 'done'} count={summary?.done} onPress={() => setFilter('done')} />
        <SegBtn label="Tümü" active={filter === 'all'} count={tasks.length} onPress={() => setFilter('all')} />
      </View>

      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ padding: 14 }}>
          <Card>
            <EmptyState
              icon="📝"
              title={filter === 'done' ? 'Tamamlanan görev yok' : 'Görev yok'}
              subtitle={filter === 'done'
                ? 'Görevlerini tamamladıkça burada listelenir'
                : 'Yöneticin sana görev atadığında burada görünecek'}
            />
          </Card>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {summary?.overdue > 0 && filter !== 'done' ? (
            <View style={styles.overdueBanner}>
              <Text style={styles.overdueText}>⚠️ {summary.overdue} gecikmiş görevin var</Text>
            </View>
          ) : null}

          {filtered.map(task => {
            const prio = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal;
            const stat = STATUS_STYLES[task.status] || STATUS_STYLES.open;
            const dueText = fmtDate(task.due_date);
            const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

            return (
              <View key={task.id} style={[styles.taskCard, overdue && styles.taskOverdue]}>
                <View style={styles.taskHeader}>
                  <View style={[styles.prioBadge, { backgroundColor: prio.bg }]}>
                    <Text style={[styles.prioBadgeText, { color: prio.color }]}>{prio.icon} {prio.label}</Text>
                  </View>
                  <View style={[styles.statBadge, { backgroundColor: stat.bg }]}>
                    <Text style={[styles.statBadgeText, { color: stat.color }]}>{stat.label}</Text>
                  </View>
                </View>

                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description ? (
                  <Text style={styles.taskDesc} numberOfLines={3}>{task.description}</Text>
                ) : null}

                <View style={styles.taskMeta}>
                  {task.customer ? (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('VisitDetail', {
                        customerId: task.customer.id,
                        customerName: task.customer.name,
                      })}
                    >
                      <Text style={styles.taskCustomer}>👤 {task.customer.name}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {dueText ? (
                    <Text style={[styles.taskDue, overdue && { color: colors.negative }]}>
                      🗓 {dueText}
                    </Text>
                  ) : null}
                  {task.assigned_by_name ? (
                    <Text style={styles.taskBy}>👔 {task.assigned_by_name}</Text>
                  ) : null}
                </View>

                {/* Status değiştirme butonları */}
                {task.status !== 'done' && task.status !== 'cancelled' ? (
                  <View style={styles.actions}>
                    {task.status === 'open' ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                        onPress={() => setStatus(task, 'in_progress')}
                      >
                        <Text style={styles.actionBtnText}>▶ Başla</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.positive }]}
                      onPress={() => setStatus(task, 'done')}
                    >
                      <Text style={styles.actionBtnText}>✓ Tamamla</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function SegBtn({ label, active, count, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.segBtn, active && styles.segBtnActive]} activeOpacity={0.85}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
      {count != null ? (
        <View style={[styles.segCount, active && styles.segCountActive]}>
          <Text style={[styles.segCountText, active && styles.segCountTextActive]}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  segments: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  segBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
  },
  segBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  segText: { fontSize: 12, fontWeight: '700', color: colors.text },
  segTextActive: { color: '#fff' },
  segCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center',
  },
  segCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  segCountText: { fontSize: 10, fontWeight: '800', color: colors.brand },
  segCountTextActive: { color: '#fff' },

  overdueBanner: {
    backgroundColor: colors.negativeBg,
    borderColor: '#fecaca', borderWidth: 1,
    borderRadius: radius.md,
    padding: 12, marginBottom: 12,
  },
  overdueText: { color: colors.negative, fontSize: 13, fontWeight: '700' },

  taskCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
    ...shadow.sm,
  },
  taskOverdue: { borderColor: colors.negative, borderWidth: 1.5 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  prioBadgeText: { fontSize: 11, fontWeight: '700' },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  statBadgeText: { fontSize: 11, fontWeight: '700' },
  taskTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  taskDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  taskCustomer: { fontSize: 11, color: colors.brand, fontWeight: '700' },
  taskDue: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  taskBy: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  actions: {
    flexDirection: 'row', gap: 8, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.md, alignItems: 'center', ...shadow.sm },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
