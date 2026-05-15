import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { colors, radius, shadow } from '../theme';
import { GradientButton } from '../components/ui';

const IS_WEB = Platform.OS === 'web';
// expo-camera web'de tam farklı bir API, sadece native'de import et
let CameraView, useCameraPermissions;
if (!IS_WEB) {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

/*
 QR kod formatı (admin paneli tarafından üretilir):
   { "email": "rep@firma.com", "password": "12345" }
 ya da düz JSON.stringify ile aynı bilgiler.
*/

export default function QRScanScreen({ navigation }) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  if (IS_WEB) {
    return (
      <View style={[styles.center, { paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>📷</Text>
        <Text style={styles.permissionTitle}>QR tarama tarayıcıda yok</Text>
        <Text style={[styles.permissionText, { textAlign: 'center', marginBottom: 18 }]}>
          QR ile giriş yalnızca telefon uygulamasında çalışıyor. Tarayıcıda email + şifre ile giriş yapabilirsin.
        </Text>
        <GradientButton title="Geri Dön" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleScanned = async ({ data }) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setScanned(true);
    setBusy(true);
    try {
      let creds = null;
      try {
        creds = JSON.parse(data);
      } catch {
        // "email:password" düz format fallback
        const [em, pw] = String(data).split(':');
        if (em && pw) creds = { email: em, password: pw };
      }
      if (!creds || !creds.email || !creds.password) {
        throw new Error('Geçersiz QR kod (email ve password içermeli)');
      }
      await login(creds.email, creds.password);
      // login başarılıysa root navigator zaten App'e geçecek
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Giriş başarısız';
      Alert.alert('QR Giriş Hatası', msg, [
        {
          text: 'Tekrar Dene',
          onPress: () => {
            handledRef.current = false;
            setScanned(false);
            setBusy(false);
          },
        },
        { text: 'Kapat', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={styles.center}><Text>Yükleniyor…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingHorizontal: 24 }]}>
        <Text style={styles.permissionTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permissionText}>QR kodu okumak için kameraya erişim ver.</Text>
        <GradientButton title="İzin Ver" onPress={requestPermission} style={{ marginTop: 16, alignSelf: 'stretch' }} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>İptal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>QR Kod ile Giriş</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.frameRow}>
          <View style={styles.dimSide} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {busy ? (
              <View style={styles.busyBox}>
                <Text style={styles.busyText}>Giriş yapılıyor…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.dimSide} />
        </View>

        <View style={[styles.bottomHint, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.hintText}>QR kodu kameranın görüş alanına getir</Text>
          <Text style={styles.hintSubtext}>
            Format: <Text style={{ fontFamily: 'Courier' }}>{`{"email":"...", "password":"..."}`}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const FRAME = 260;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permissionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
  permissionText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  overlay: { backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  frameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dimSide: { flex: 1, height: '100%', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: {
    width: FRAME, height: FRAME,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#fff' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  busyBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.md,
  },
  busyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bottomHint: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hintSubtext: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 6, textAlign: 'center' },
});
