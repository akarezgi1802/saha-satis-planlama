/**
 * Performans ekranı — kişisel KPI + haftalık leaderboard + rozetler.
 * Commit 3'te backend endpoint ile içerik dolacak.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadow, brandGradient } from '../theme';
import { Card, EmptyState, SectionTitle } from '../components/ui';
import HeaderActions from '../components/HeaderActions';

export default function PerformanceScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Performans</Text>
            <Text style={styles.heroSub}>Liderlik tablosu · Rozetlerim</Text>
          </View>
          <HeaderActions />
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
        <Card>
          <EmptyState
            icon="🏆"
            title="Yakında"
            subtitle="Haftalık liderlik tablosu, kişisel rozetler, geçmiş dönemlere göre kıyaslama bu ekranda olacak."
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4, fontWeight: '600' },
});
