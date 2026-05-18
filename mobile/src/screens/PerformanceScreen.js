/**
 * Performans ekranı — kişisel KPI + haftalık leaderboard + rozetler.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing, shadow, brandGradient, positiveGradient } from '../theme';
import { Card, EmptyState, SectionTitle } from '../components/ui';
import HeaderActions from '../components/HeaderActions';

const PERIOD_LABELS = {
  week: 'Bu Hafta',
  month: 'Bu Ay',
  all: 'Tüm Zamanlar',
};

export default function PerformanceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const lb = await api.get('/performance/leaderboard', { params: { period } });
      setLeaderboard(lb.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>🏆 Liderlik Tablosu</Text>
            <Text style={styles.heroSub}>
              {leaderboard?.my_rank
                ? `Sıralamadaki yerin: #${leaderboard.my_rank} / ${leaderboard.total_reps}`
                : 'Satış temsilcileri sıralaması'}
            </Text>
          </View>
          <HeaderActions />
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : (
          <LeaderboardView
            leaderboard={leaderboard}
            period={period}
            onPeriodChange={setPeriod}
          />
        )}
      </ScrollView>
    </View>
  );
}

function LeaderboardView({ leaderboard, period, onPeriodChange }) {
  if (!leaderboard?.leaderboard?.length) {
    return (
      <Card>
        <EmptyState icon="🏆" title="Henüz veri yok" subtitle="Ziyaretler tamamlandıkça liderlik tablosu güncellenir" />
      </Card>
    );
  }

  return (
    <>
      {/* Period selector */}
      <View style={styles.periodBar}>
        {Object.entries(PERIOD_LABELS).map(([k, v]) => (
          <TouchableOpacity
            key={k}
            onPress={() => onPeriodChange(k)}
            style={[styles.periodBtn, period === k && styles.periodBtnActive]}
          >
            <Text style={[styles.periodText, period === k && styles.periodTextActive]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank highlight */}
      {leaderboard.my_rank ? (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Sıralamadaki Yerin</Text>
          <Text style={styles.myRankValue}>
            #{leaderboard.my_rank}
            <Text style={styles.myRankTotal}> / {leaderboard.total_reps}</Text>
          </Text>
        </View>
      ) : null}

      <SectionTitle>🏆 İlk 10</SectionTitle>

      {leaderboard.leaderboard.map((rep, idx) => {
        const isPodium = rep.rank <= 3;
        const podiumIcon = ['🥇', '🥈', '🥉'][rep.rank - 1];
        return (
          <View
            key={rep.user_id}
            style={[
              styles.rankCard,
              rep.is_me && styles.rankCardMe,
              isPodium && styles.rankCardPodium,
            ]}
          >
            <View style={[styles.rankBadge, rep.is_me && { backgroundColor: colors.brand }]}>
              {isPodium ? (
                <Text style={{ fontSize: 18 }}>{podiumIcon}</Text>
              ) : (
                <Text style={[styles.rankBadgeText, rep.is_me && { color: '#fff' }]}>{rep.rank}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rankName, rep.is_me && { fontWeight: '900' }]}>
                {rep.full_name}{rep.is_me ? ' (sen)' : ''}
              </Text>
              <Text style={styles.rankMeta}>
                {rep.visit_count} ziyaret · {rep.customer_count} müşteri
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rankSales}>
                {Number(rep.total_sales || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
              </Text>
              <Text style={styles.rankLabel}>satış</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

function BadgesView({ badges }) {
  if (!badges?.badges?.length) {
    return <Card><EmptyState icon="🎖️" title="Rozet yok" /></Card>;
  }

  const earned = badges.badges.filter(b => b.earned);
  const locked = badges.badges.filter(b => !b.earned);

  return (
    <>
      {/* Stats hero */}
      <View style={styles.statsHero}>
        <View style={styles.statTile}>
          <Text style={styles.statVal}>{badges.earned_count}</Text>
          <Text style={styles.statLabel}>Rozet</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statVal}>{badges.stats.streak}</Text>
          <Text style={styles.statLabel}>Gün seri</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statVal}>{badges.stats.total_visits}</Text>
          <Text style={styles.statLabel}>Ziyaret</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statVal, { color: colors.positive }]}>{badges.stats.trees_total}</Text>
          <Text style={styles.statLabel}>🌳 ağaç</Text>
        </View>
      </View>

      <SectionTitle>🏅 Kazanılan ({earned.length})</SectionTitle>
      {earned.length === 0 ? (
        <Card>
          <EmptyState icon="🎯" title="Henüz rozet kazanmadın" subtitle="İlk ziyaretini tamamla ve başla!" />
        </Card>
      ) : (
        <View style={styles.badgeGrid}>
          {earned.map(b => <BadgeCard key={b.key} badge={b} earned />)}
        </View>
      )}

      <SectionTitle>🔒 Kilitli ({locked.length})</SectionTitle>
      <View style={styles.badgeGrid}>
        {locked.map(b => <BadgeCard key={b.key} badge={b} earned={false} />)}
      </View>
    </>
  );
}

function BadgeCard({ badge, earned }) {
  const pct = badge.target ? Math.min(100, (badge.progress / badge.target) * 100) : 0;
  return (
    <View style={[styles.badgeCard, !earned && { opacity: 0.55 }]}>
      <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>{badge.icon}</Text>
      <Text style={styles.badgeName}>{badge.name}</Text>
      <Text style={styles.badgeDesc} numberOfLines={2}>{badge.desc}</Text>
      {!earned ? (
        <View style={styles.badgeProgress}>
          <View style={styles.badgeProgressTrack}>
            <View style={[styles.badgeProgressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.badgeProgressText}>
            {badge.target >= 10000
              ? `${Math.round(badge.progress / 1000)}K / ${Math.round(badge.target / 1000)}K`
              : `${Math.round(badge.progress)}/${badge.target}`}
          </Text>
        </View>
      ) : (
        <View style={styles.earnedTag}>
          <Text style={styles.earnedTagText}>✓ Kazanıldı</Text>
        </View>
      )}
    </View>
  );
}

function SegBtn({ label, active, onPress, count }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.segBtn, active && styles.segBtnActive]}>
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>{label}</Text>
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
    flexDirection: 'row', gap: 6, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full, padding: 3,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: radius.full, gap: 6,
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

  // Leaderboard
  periodBar: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.full,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
  },
  periodBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  periodText: { fontSize: 12, fontWeight: '700', color: colors.text },
  periodTextActive: { color: '#fff' },

  myRankCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    ...shadow.md,
  },
  myRankLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  myRankValue: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4 },
  myRankTotal: { fontSize: 16, fontWeight: '600' },

  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 8,
    ...shadow.sm,
  },
  rankCardMe: { borderColor: colors.brand, borderWidth: 1.5 },
  rankCardPodium: { backgroundColor: '#fefce8' },
  rankBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 14, fontWeight: '800', color: colors.text },
  rankName: { fontSize: 14, fontWeight: '700', color: colors.text },
  rankMeta: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 1 },
  rankSales: { fontSize: 13, fontWeight: '800', color: colors.text },
  rankLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },

  // Badges
  statsHero: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  statTile: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: radius.md, padding: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  badgeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  badgeCard: {
    width: '48%', backgroundColor: '#fff',
    borderRadius: radius.md, padding: 14,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
    ...shadow.sm,
  },
  badgeIcon: { fontSize: 38 },
  badgeIconLocked: { opacity: 0.5 },
  badgeName: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 8, textAlign: 'center' },
  badgeDesc: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center', fontWeight: '600', lineHeight: 14 },
  badgeProgress: { width: '100%', marginTop: 10 },
  badgeProgressTrack: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  badgeProgressFill: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  badgeProgressText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  earnedTag: {
    marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.positiveBg,
  },
  earnedTagText: { fontSize: 10, color: colors.positive, fontWeight: '800' },
});
