import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, shadow, typography, brandGradient } from '../theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientButton({ title, onPress, disabled, loading, gradient = brandGradient, style }) {
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={disabled || loading} onPress={onPress} style={[{ borderRadius: radius.md }, style]}>
      <LinearGradient
        colors={disabled ? ['#cbd5e1', '#94a3b8'] : gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradBtn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.gradBtnText}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, color = colors.brand, style }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.ghostBtn, style]}>
      <Text style={[styles.ghostBtnText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Tag({ label, color = colors.brand, bg = colors.brandLight }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function KpiTile({ label, value, unit, color = colors.text, accent }) {
  return (
    <View style={styles.kpiTile}>
      {accent ? <View style={[styles.kpiAccent, { backgroundColor: accent }]} /> : null}
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[styles.kpiValue, { color }]}>{value}</Text>
        {unit ? <Text style={styles.kpiUnit}>{` ${unit}`}</Text> : null}
      </View>
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

export function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  gradBtn: {
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  gradBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  ghostBtnText: { fontWeight: '600', fontSize: 13 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: '700' },
  kpiTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 0,
    overflow: 'hidden',
    ...shadow.sm,
  },
  kpiAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  kpiLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiUnit: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
