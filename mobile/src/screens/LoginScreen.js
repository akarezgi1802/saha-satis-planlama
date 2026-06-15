import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { colors, radius, spacing, shadow, shellGradient } from '../theme';
import { GradientButton } from '../components/ui';

const IS_WEB = Platform.OS === 'web';

// Marka logosu: harita üstünde route + iki lokasyon pini
function BrandLogo({ size = 50 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <SvgLinearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fbbf24" />
          <Stop offset="1" stopColor="#fff" />
        </SvgLinearGradient>
      </Defs>
      {/* Yumuşak harita ızgarası (dekoratif) */}
      <Path d="M 8 24 H 56 M 8 40 H 56 M 24 8 V 56 M 40 8 V 56"
        stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
      {/* Yol — eğri çizgi başlangıç pin'inden bitiş pin'ine */}
      <Path
        d="M 14 50 Q 22 38, 30 36 T 44 22 T 50 14"
        stroke="url(#routeGrad)" strokeWidth="4" strokeLinecap="round" fill="none"
      />
      {/* Başlangıç pin (sol alt) */}
      <Circle cx="14" cy="50" r="5" fill="#fff" />
      <Circle cx="14" cy="50" r="2.5" fill="#6366f1" />
      {/* Bitiş pin (sağ üst) */}
      <Circle cx="50" cy="14" r="5" fill="#fff" />
      <Circle cx="50" cy="14" r="2.5" fill="#10b981" />
    </Svg>
  );
}

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
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <BrandLogo size={50} />
            </LinearGradient>
            <Text style={styles.brandTitle}>Saha Satış</Text>
            <Text style={styles.brandSubtitle}>Trafik bazlı akıllı rotalama</Text>
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

          <InstallHint />

          <Text style={styles.footer}>
            Backend: saha-satis-planlama-guncel.onrender.com
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Mobil web sürümünde (Expo Web) login ekranının altında gösterilen
// "Ana Ekrana Ekle" kartı. Native APK'da hiç render edilmez, ana ekrana
// zaten kurulu PWA olarak çalışan kullanıcılara da görünmez (standalone
// kontrolü). Cihazı sniff edip iOS Safari mi Android Chrome mu olduğuna
// göre talimatı şekillendirir.
function InstallHint() {
  const platform = useMemo(() => {
    if (!IS_WEB) return null;
    try {
      // PWA olarak ana ekrandan açılmışsa hiç gösterme
      const standalone =
        (typeof window !== 'undefined' && window.matchMedia
          && window.matchMedia('(display-mode: standalone)').matches)
        || (typeof window !== 'undefined' && window.navigator && window.navigator.standalone === true);
      if (standalone) return null;
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
      if (/Android/i.test(ua)) return 'android';
      return 'desktop';
    } catch (e) {
      return null;
    }
  }, []);
  if (!platform) return null;

  return (
    <View style={styles.installCard}>
      <View style={styles.installHeader}>
        <Text style={styles.installEmoji}>📱</Text>
        <Text style={styles.installTitle}>Ana Ekrana Ekle</Text>
      </View>
      {platform === 'ios' ? (
        <>
          <Text style={styles.installText}>
            Safari'nin alt çubuğundaki paylaş <Text style={styles.installInline}>↑</Text> simgesine dokun, açılan
            menüden <Text style={styles.installStrong}>"Ana Ekrana Ekle"</Text> seç.
          </Text>
          <Text style={styles.installText}>
            Ana ekranda ayrı bir simge oluşur — uygulama gibi tam ekran açılır, tarayıcı çubukları görünmez.
          </Text>
        </>
      ) : platform === 'android' ? (
        <>
          <Text style={styles.installText}>
            Chrome'un sağ üstündeki menü <Text style={styles.installInline}>⋮</Text> simgesine dokun, açılan listeden
            <Text style={styles.installStrong}> "Ana ekrana ekle" </Text> seç.
          </Text>
          <Text style={styles.installText}>
            Telefonun ana ekranında uygulama simgesi belirir, kurulum gerekmez.
          </Text>
        </>
      ) : (
        <Text style={styles.installText}>
          Sayfayı telefonundan açtığında Safari (iPhone) veya Chrome (Android) paylaş/menü
          ile <Text style={styles.installStrong}>"Ana Ekrana Ekle"</Text> diyerek uygulama
          gibi kullanabilirsin.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  brandWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 82, height: 82, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    ...shadow.lg,
  },
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

  // "Ana Ekrana Ekle" kartı — yalnızca web sürümünde, standalone değilken görünür
  installCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  installHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10,
  },
  installEmoji: { fontSize: 18 },
  installTitle: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  installText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12.5, lineHeight: 18,
    marginTop: 6, fontWeight: '500',
  },
  installInline: {
    color: '#fff', fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 4, borderRadius: 4,
  },
  installStrong: { color: '#fff', fontWeight: '800' },
});
