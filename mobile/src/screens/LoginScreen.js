import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';

const IS_WEB = Platform.OS === 'web';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing, shadow, shellGradient } from '../theme';
import { GradientButton } from '../components/ui';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Email ve şifre gerekli');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.response?.data?.detail || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[shellGradient[0], shellGradient[1], colors.brand]} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandWrap}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.logoIcon}>
              <Text style={styles.logoIconText}>SS</Text>
            </LinearGradient>
            <Text style={styles.brandTitle}>Saha Satış</Text>
            <Text style={styles.brandSubtitle}>Karar Destek Sistemi</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hoş geldin</Text>
            <Text style={styles.cardSubtitle}>Devam etmek için giriş yap</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@firma.com"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
            </View>

            <GradientButton title="Giriş Yap" onPress={onSubmit} loading={loading} style={{ marginTop: 8 }} />

            {!IS_WEB ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>veya</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.qrBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('QRScan')}
                >
                  <Text style={styles.qrEmoji}>⬛</Text>
                  <Text style={styles.qrBtnText}>QR Kod ile Giriş</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          <Text style={styles.footer}>
            Backend: saha-satis-planlama-guncel.onrender.com
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  brandWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 70, height: 70, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    ...shadow.lg,
  },
  logoIconText: { color: '#fff', fontWeight: '900', fontSize: 24, letterSpacing: -1 },
  brandTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  brandSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: 28,
    ...shadow.lg,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  errorBox: {
    backgroundColor: colors.negativeBg,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 14,
  },
  errorText: { color: colors.negative, fontSize: 13, fontWeight: '500' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { paddingHorizontal: 12, fontSize: 11, color: colors.textTertiary, fontWeight: '600', letterSpacing: 0.5 },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    height: 48,
    gap: 8,
  },
  qrEmoji: { fontSize: 18 },
  qrBtnText: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 28 },
});
