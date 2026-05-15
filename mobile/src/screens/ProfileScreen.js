import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { API_BASE_URL } from '../api';
import { colors, radius, spacing, shadow, brandGradient, shellGradient } from '../theme';
import { Card } from '../components/ui';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const onLogout = () => {
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={shellGradient} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
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
  section: {
    fontSize: 10, fontWeight: '800', color: colors.textTertiary,
    letterSpacing: 1, marginTop: 16, marginBottom: 8, marginLeft: 4,
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
