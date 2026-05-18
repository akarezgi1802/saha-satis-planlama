import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../AuthContext';
import api, { API_BASE_URL } from '../api';
import { colors, radius, spacing, shadow, brandGradient, shellGradient } from '../theme';
import { Card } from '../components/ui';

function formatTL(n) {
  if (n == null || n === 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [sustainability, setSustainability] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, perf] = await Promise.all([
        api.get('/performance/sustainability'),
        api.get('/performance/summary'),
      ]);
      setSustainability(s.data);
      setSummary(perf.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLogout = () => {
    // Web'de Alert.alert yerine native browser confirm kullan
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Çıkış yapmak istediğine emin misin?')) {
        logout();
      }
      return;
    }
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  const lifetime = sustainability?.lifetime || {};
  const week = sustainability?.this_week || {};
  const lifetimeTrees = lifetime.trees_equivalent || 0;
  const weekTrees = week.trees_equivalent || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        {/* Geri butonu */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Profil</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.avatarBig}>
          <Text style={styles.avatarBigText}>
            {user?.full_name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {user?.role === 'admin' ? '🛡️  Yönetici' : '📍  Satış Temsilcisi'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        {/* Detaylı kişisel KPI'lar — Bu Hafta + Bu Ay */}
        {summary ? (
          <View style={styles.kpiSection}>
            <Text style={styles.section}>BU HAFTA</Text>
            <View style={styles.kpiRow}>
              <KpiCard
                label="Satış"
                value={formatTL(summary.this_week?.total_sales)}
                unit="₺"
                color={colors.positive}
              />
              <KpiCard
                label="Ziyaret"
                value={summary.this_week?.visit_count || 0}
                color={colors.brand}
              />
              <KpiCard
                label="Müşteri"
                value={summary.this_week?.customer_count || 0}
                color={colors.brandPurple}
              />
            </View>

            <Text style={[styles.section, { marginTop: 12 }]}>BU AY</Text>
            <View style={styles.kpiRow}>
              <KpiCard
                label="Satış"
                value={formatTL(summary.this_month?.total_sales)}
                unit="₺"
                color={colors.positive}
              />
              <KpiCard
                label="Ziyaret"
                value={summary.this_month?.visit_count || 0}
                color={colors.brand}
              />
              <KpiCard
                label="Müşteri"
                value={summary.this_month?.customer_count || 0}
                color={colors.brandPurple}
              />
            </View>

            {/* Haftalık grafik */}
            {summary.daily_breakdown?.length ? (
              <View style={[styles.weekChart, { marginTop: 14 }]}>
                <Text style={styles.weekChartTitle}>📊 Haftalık dağılım</Text>
                {summary.daily_breakdown.map((d, i) => {
                  const max = Math.max(1, ...summary.daily_breakdown.map(x => x.sales));
                  return (
                    <View key={i} style={styles.weekChartRow}>
                      <Text style={styles.weekChartDay}>{d.day_name}</Text>
                      <View style={styles.weekChartTrack}>
                        <View style={[
                          styles.weekChartBar,
                          { width: `${(d.sales / max) * 100}%` },
                        ]} />
                      </View>
                      <Text style={styles.weekChartVal}>{formatTL(d.sales)} ₺</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Sürdürülebilirlik Katkım */}
        <View style={styles.susHero}>
          <LinearGradient
            colors={['#059669', '#10b981', '#34d399']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.susHeroGrad}
          >
            <View style={styles.susHeroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.susHeroLabel}>🌱 SÜRDÜRÜLEBİLİRLİK KATKIM</Text>
                {loading ? (
                  <ActivityIndicator color="#fff" style={{ marginTop: 10, alignSelf: 'flex-start' }} />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                      <Text style={styles.susHeroValue}>{lifetimeTrees.toFixed(lifetimeTrees < 10 ? 2 : 1)}</Text>
                      <Text style={styles.susHeroUnit}> ağaç eşdeğeri</Text>
                    </View>
                    <Text style={styles.susHeroSubtitle}>
                      Optimize rotalama kullandığın için doğaya katkın
                    </Text>
                  </>
                )}
              </View>
              <Text style={styles.susHeroEmoji}>🌳</Text>
            </View>
          </LinearGradient>

          {!loading && sustainability ? (
            <View style={styles.susBody}>
              <View style={styles.susStatGrid}>
                <SusTile
                  value={lifetime.km_saved?.toFixed(0) || '0'}
                  unit="km"
                  label="Toplam km tasarrufu"
                />
                <SusTile
                  value={lifetime.co2_saved_kg?.toFixed(1) || '0'}
                  unit="kg"
                  label="Toplam CO₂ engellendi"
                />
                <SusTile
                  value={lifetime.visits || 0}
                  unit=""
                  label="Tamamlanan ziyaret"
                />
              </View>

              {weekTrees > 0 ? (
                <View style={styles.susWeekRow}>
                  <Text style={styles.susWeekIcon}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.susWeekTitle}>Bu hafta katkın</Text>
                    <Text style={styles.susWeekValue}>
                      {weekTrees.toFixed(2)} ağaç · {week.co2_saved_kg?.toFixed(1)} kg CO₂
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.susExplainBox}>
                <Text style={styles.susExplainTitle}>Nasıl hesaplanır?</Text>
                <Text style={styles.susExplainText}>
                  Saha Satış Planlama optimize edilmiş rotalar üretir. Naif rotalamaya göre yaklaşık <Text style={{ fontWeight: '800' }}>%30 daha kısa</Text> yol gidiyorsun. Tasarruf edilen mesafe × 0.18 kg CO₂/km hesabıyla, bir ağacın yılda emdiği 22 kg CO₂'ye karşılık ağaç eşdeğeri çıkarılır.
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <Text style={styles.section}>HESAP</Text>
        <Card style={{ padding: 0 }}>
          <Row label="Ad Soyad" value={user?.full_name || '—'} />
          <Row label="E-posta" value={user?.email || '—'} />
          <Row label="Şirket" value={user?.company || '—'} />
          <Row label="Bölge" value={user?.cluster_index != null ? `#${user.cluster_index}` : 'Atanmamış'} last />
        </Card>

        <Text style={styles.section}>UYGULAMA</Text>
        <Card style={{ padding: 0 }}>
          <Row label="Sürüm" value="1.0.0 (demo)" />
          <Row label="API" value={API_BASE_URL.replace('https://', '').replace('/api', '')} last />
        </Card>

        <View style={{ height: 18 }} />

        <TouchableOpacity onPress={onLogout} activeOpacity={0.85} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>⏻  Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Saha Satış Planlama · Karar Destek Sistemi</Text>
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, unit, color }) {
  return (
    <View style={kpiStyles.tile}>
      <View style={[kpiStyles.accent, { backgroundColor: color }]} />
      <Text style={kpiStyles.label}>{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[kpiStyles.value, { color }]}>{value}</Text>
        {unit ? <Text style={kpiStyles.unit}> {unit}</Text> : null}
      </View>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    overflow: 'hidden',
    ...shadow.sm,
  },
  accent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
  },
  label: { fontSize: 9, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 6 },
  value: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  unit: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
});

function SusTile({ value, unit, label }) {
  return (
    <View style={styles.susTile}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
        <Text style={styles.susTileVal}>{value}</Text>
        {unit ? <Text style={styles.susTileUnit}> {unit}</Text> : null}
      </View>
      <Text style={styles.susTileLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 22, paddingHorizontal: 18 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', marginBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -4 },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  kpiSection: { marginBottom: 6 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  weekChart: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14,
    ...shadow.sm,
  },
  weekChartTitle: { fontSize: 12, fontWeight: '800', color: colors.text, marginBottom: 10 },
  weekChartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  weekChartDay: { width: 36, fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  weekChartTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginHorizontal: 8 },
  weekChartBar: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  weekChartVal: { width: 70, fontSize: 10, fontWeight: '700', color: colors.text, textAlign: 'right' },
  avatarBig: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarBigText: { color: '#fff', fontWeight: '900', fontSize: 30 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  email: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Sustainability hero
  susHero: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#a7f3d0',
    ...shadow.md,
    marginBottom: 4,
  },
  susHeroGrad: { padding: 18 },
  susHeroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  susHeroLabel: { color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  susHeroValue: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  susHeroUnit: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' },
  susHeroSubtitle: { color: 'rgba(255,255,255,0.95)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  susHeroEmoji: { fontSize: 64 },
  susBody: { padding: 14 },
  susStatGrid: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  susTile: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.positiveBg,
    borderRadius: radius.md, padding: 12,
  },
  susTileVal: { fontSize: 18, fontWeight: '900', color: colors.positive },
  susTileUnit: { fontSize: 11, color: colors.positive, fontWeight: '700' },
  susTileLabel: { fontSize: 10, color: colors.positive, fontWeight: '700', textAlign: 'center', marginTop: 3 },
  susWeekRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: radius.md,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  susWeekIcon: { fontSize: 20 },
  susWeekTitle: { fontSize: 11, fontWeight: '800', color: colors.positive, textTransform: 'uppercase', letterSpacing: 0.5 },
  susWeekValue: { fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 2 },
  susExplainBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  susExplainTitle: { fontSize: 11, fontWeight: '800', color: colors.text, marginBottom: 4 },
  susExplainText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  section: {
    fontSize: 10, fontWeight: '800', color: colors.textTertiary,
    letterSpacing: 1, marginTop: 18, marginBottom: 8, marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '700', maxWidth: '60%' },
  logoutBtn: {
    height: 50, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.negativeBg,
    borderWidth: 1.5, borderColor: colors.negative,
  },
  logoutText: { color: colors.negative, fontWeight: '800', fontSize: 14 },
  footer: { textAlign: 'center', color: colors.textTertiary, fontSize: 11, marginTop: 20, fontWeight: '600' },
});
