import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, StatusBar, Linking, Image,
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
// kurulum yönergeleri. Backend'in /install sayfasındaki orijinal kart
// düzenini birebir reproduce eder: Hemen Kur · QR · Android Adımları ·
// iPhone Adımları. Native APK'da render edilmez; standalone (PWA olarak
// kurulmuş) modda da görünmez.
const EAS_BUILD_URL = 'https://expo.dev/accounts/tugceeeeeeee/projects/saha-satis-mobile/builds';
const MOBILE_WEB_URL = 'https://saha-satis-mobile-web.onrender.com';
const INSTALL_PAGE_URL = 'https://saha-satis-planlama-guncel.onrender.com/install';

function InstallHint() {
  const platform = useMemo(() => {
    if (!IS_WEB) return null;
    try {
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

  const open = (url) => { Linking.openURL(url).catch(() => {}); };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(INSTALL_PAGE_URL)}&color=1e1b4b&bgcolor=ffffff`;

  let primaryBtn, secondaryBtn, primaryNote;
  if (platform === 'android') {
    primaryBtn = { label: '📲 Android APK İndir (önerilen)', url: EAS_BUILD_URL };
    secondaryBtn = { label: '🌐 Veya tarayıcıda aç', url: MOBILE_WEB_URL };
    primaryNote = "APK için: tıkla, telefona iner, Android'in 'bilinmeyen kaynak' uyarısını onayla. Hızlı bakmak için tarayıcı versiyonu da çalışır.";
  } else if (platform === 'ios') {
    primaryBtn = { label: "🌐 Safari'de Aç (önerilen)", url: MOBILE_WEB_URL };
    secondaryBtn = { label: '📲 Sonra "Ana Ekrana Ekle"', url: MOBILE_WEB_URL };
    primaryNote = "iPhone için: tıkla → Safari'de açılır → paylaş menüsünden 'Ana Ekrana Ekle' ile bir simge oluştur. App gibi çalışır, kurulum gerekmez.";
  } else {
    primaryBtn = { label: '📲 Android APK', url: EAS_BUILD_URL };
    secondaryBtn = { label: '🌐 Tarayıcıda Aç', url: MOBILE_WEB_URL };
    primaryNote = "Android için APK'yı indir. iPhone veya bilgisayar için tarayıcı versiyonunu kullan.";
  }

  return (
    <View style={{ marginTop: 8 }}>
      {/* Ana CTA — "Hemen Kur" */}
      <View style={iStyles.card}>
        <View style={iStyles.cardHeader}>
          <View style={iStyles.cardIcon}><Text style={iStyles.cardIconText}>📲</Text></View>
          <Text style={iStyles.cardTitle}>Hemen Kur</Text>
        </View>
        <TouchableOpacity style={iStyles.btnPrimary} activeOpacity={0.88} onPress={() => open(primaryBtn.url)}>
          <Text style={iStyles.btnPrimaryText}>{primaryBtn.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={iStyles.btnSecondary} activeOpacity={0.88} onPress={() => open(secondaryBtn.url)}>
          <Text style={iStyles.btnSecondaryText}>{secondaryBtn.label}</Text>
        </TouchableOpacity>
        <Text style={iStyles.note}>{primaryNote}</Text>
      </View>

      {/* QR kart */}
      <View style={[iStyles.card, { alignItems: 'center' }]}>
        <View style={[iStyles.cardHeader, { justifyContent: 'center' }]}>
          <View style={iStyles.cardIcon}><Text style={iStyles.cardIconText}>🔲</Text></View>
          <Text style={iStyles.cardTitle}>Veya QR ile</Text>
        </View>
        <Text style={[iStyles.cardText, { textAlign: 'center' }]}>
          Bilgisayardan açtıysan, telefon kamerasıyla bu QR'ı okut:
        </Text>
        <View style={iStyles.qrBox}>
          <Image source={{ uri: qrSrc }} style={{ width: 200, height: 200 }} />
        </View>
      </View>

      {/* Android adımları */}
      {platform !== 'ios' ? (
        <View style={iStyles.card}>
          <View style={iStyles.cardHeader}>
            <View style={iStyles.cardIcon}><Text style={iStyles.cardIconText}>🤖</Text></View>
            <Text style={iStyles.cardTitle}>Android — Kurulum Adımları</Text>
          </View>
          {[
            'Yukarıdaki "Android APK İndir" butonuna bas',
            'Expo\'nun build sayfasında "Install" butonuna tıkla, APK iner',
            'İndirilenler\'den APK\'ya dokun — "Bilinmeyen kaynak" uyarısı çıkar',
            'Ayarlar açılır → tarayıcı için "Bu kaynağa izin ver" → geri dön',
            '"Yükle" → bekle → "Aç"',
          ].map((step, i) => (
            <View key={i} style={iStyles.stepRow}>
              <View style={iStyles.stepNum}><Text style={iStyles.stepNumText}>{i + 1}</Text></View>
              <Text style={iStyles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* iPhone bölümü */}
      {platform !== 'android' ? (
        <View style={iStyles.card}>
          <View style={iStyles.cardHeader}>
            <View style={iStyles.cardIcon}><Text style={iStyles.cardIconText}>🍎</Text></View>
            <Text style={iStyles.cardTitle}>iPhone kullanıyorsan</Text>
          </View>
          <Text style={[iStyles.cardText, { marginBottom: 14 }]}>
            Uygulamamız şu an iOS için <Text style={iStyles.strong}>web sürümünde</Text> mevcut.
            Kurulum gerekmiyor — Safari'de tek dokunuşla açılıyor.
          </Text>
          <Text style={[iStyles.cardText, { marginBottom: 14 }]}>
            Eğer <Text style={iStyles.strong}>app gibi çalışsın</Text> istersen, sayfayı açtıktan
            sonra Safari'nin paylaş menüsünden (alt çubuktaki ↑ simgesi)
            <Text style={iStyles.strong}> "Ana Ekrana Ekle" </Text>seçeneğine dokun.
          </Text>
          <Text style={iStyles.cardText}>
            Ana ekranında ayrı bir simge oluşur. Dokunduğunda tarayıcı çubukları olmadan
            tam ekran açılır — tıpkı yüklenmiş bir uygulama gibi 📱
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// /install sayfasının kart düzenini birebir taklit eden stil paleti
const iStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    padding: 24,
    marginBottom: 18,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconText: { fontSize: 18 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 20 },
  strong: { color: '#fff', fontWeight: '700' },
  btnPrimary: {
    backgroundColor: '#fff',
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 10,
  },
  btnPrimaryText: { color: '#6366f1', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 10,
  },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  note: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12, lineHeight: 18,
    textAlign: 'center', marginTop: 10,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 18,
    marginTop: 16,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, gap: 12,
  },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
});

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
});
