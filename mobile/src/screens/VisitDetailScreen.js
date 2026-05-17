import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Linking, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';
import { colors, radius, spacing, shadow, brandGradient, positiveGradient } from '../theme';
import { Card, GradientButton, Tag, SectionTitle } from '../components/ui';

const IS_WEB = Platform.OS === 'web';
// expo-location native'de; web'de Geolocation API kullanılır
let Location;
if (!IS_WEB) {
  try { Location = require('expo-location'); } catch {}
}

export default function VisitDetailScreen({ route, navigation }) {
  const { customerId, customerName, visitOrder, estimatedArrival } = route.params || {};
  const insets = useSafeAreaInsets();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingVisit, setExistingVisit] = useState(null);

  const [saleAmount, setSaleAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [aiTips, setAiTips] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  // GPS Check-in state
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Foto state
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const openDirections = async () => {
    if (!customer) return;
    const lat = customer.x;
    const lng = customer.y;
    const label = encodeURIComponent(customer.name || 'Müşteri');

    // Tercihen Google Maps. iOS'ta Apple Maps fallback yapılır.
    let url;
    if (Platform.OS === 'ios') {
      // Google Maps yüklü mü kontrol et, yoksa Apple Maps
      const googleScheme = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      const canOpenGoogle = await Linking.canOpenURL(googleScheme).catch(() => false);
      url = canOpenGoogle
        ? googleScheme
        : `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
    } else if (Platform.OS === 'android') {
      // Geo intent — yüklü olan haritalama uygulaması açılır (Google Maps öncelikli)
      url = `google.navigation:q=${lat},${lng}&mode=d`;
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (!canOpen) {
        url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      }
    } else {
      // Web — yeni sekmede Google Maps
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Açılamadı', 'Harita uygulaması başlatılamadı. Konum: ' + lat + ', ' + lng);
    }
  };

  const prepareMeeting = async () => {
    setAiLoading(true);
    try {
      const r = await api.get(`/ai/prepare-meeting/${customerId}`);
      setAiTips(r.data.tips);
      setAiSummary(r.data.summary);
      setAiEnabled(r.data.ai_enabled);
    } catch (e) {
      Alert.alert('AI Hatası', e.response?.data?.detail || 'AI çağrısı başarısız');
    } finally {
      setAiLoading(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [c, v, camp, ci, ph] = await Promise.all([
        api.get(`/customers/${customerId}`),
        api.get('/performance/visits', {
          params: {
            start_date: new Date().toISOString().slice(0, 10),
            end_date: new Date().toISOString().slice(0, 10),
          },
        }),
        api.get('/campaigns/', { params: { active_only: true } }).catch(() => ({ data: [] })),
        api.get(`/performance/check-in-status/${customerId}`).catch(() => ({ data: null })),
        api.get(`/performance/visits/${customerId}/photos`).catch(() => ({ data: [] })),
      ]);
      setCustomer(c.data);
      setCampaigns(camp.data || []);
      setCheckInStatus(ci.data);
      setPhotos(ph.data || []);
      const today = new Date().toISOString().slice(0, 10);
      const ex = (v.data || []).find(x => x.customer_id === customerId && x.visit_date === today);
      if (ex) {
        setExistingVisit(ex);
        setSaleAmount(String(ex.sale_amount || ''));
        setNotes(ex.notes || '');
      }
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || 'Müşteri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Foto seçme + yükleme
  const pickAndUploadPhoto = async (useCamera) => {
    setPhotoUploading(true);
    try {
      // İzin
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          if (IS_WEB) { /* web zaten file input ile çalışır */ } else {
            throw new Error('Kamera izni reddedildi');
          }
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted' && !IS_WEB) {
          throw new Error('Galery izni reddedildi');
        }
      }

      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      // Base64 data URL formatı
      const base64 = asset.base64;
      if (!base64) {
        throw new Error('Foto verisi alınamadı');
      }
      const mime = asset.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${base64}`;

      await api.post('/performance/visits/photos', {
        customer_id: customerId,
        photo_data: dataUrl,
        caption: null,
      });

      // Yeniden yükle
      const ph = await api.get(`/performance/visits/${customerId}/photos`);
      setPhotos(ph.data || []);
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || e.message || 'Foto yüklenemedi');
    } finally {
      setPhotoUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    const confirmed = IS_WEB
      ? (typeof window !== 'undefined' && window.confirm('Bu fotoğrafı sil?'))
      : await new Promise(resolve => {
          Alert.alert('Sil?', 'Bu fotoğrafı silmek istediğine emin misin?', [
            { text: 'İptal', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Sil', onPress: () => resolve(true), style: 'destructive' },
          ]);
        });
      if (!confirmed) return;
    try {
      await api.delete(`/performance/visits/photos/${photoId}`);
      setPhotos(photos.filter(p => p.id !== photoId));
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || 'Silinemedi');
    }
  };

  // GPS Check-in
  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      let lat, lng;

      if (IS_WEB) {
        // Browser Geolocation API
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('Tarayıcıda GPS yok'));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 15000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else if (Location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Konum izni reddedildi');
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else {
        throw new Error('GPS modülü yüklü değil');
      }

      const r = await api.post('/performance/check-in', {
        customer_id: customerId, lat, lng,
      });

      const dist = r.data.distance_m;
      let msg = `Saat ${new Date(r.data.check_in_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'te check-in yapıldı.\n\n`;
      if (dist <= 50) msg += `🟢 Mükemmel! Müşteriye ${Math.round(dist)}m mesafedesin.`;
      else if (dist <= 200) msg += `🟡 Müşteriye ${Math.round(dist)}m mesafedesin.`;
      else msg += `🟠 Müşteriden ${Math.round(dist)}m uzaktasın — doğru yerde misin?`;

      Alert.alert('✅ Check-in başarılı', msg);
      load(); // status yenile
    } catch (e) {
      Alert.alert('Check-in başarısız', e.response?.data?.detail || e.message || 'Konum alınamadı');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckInLoading(true);
    try {
      const r = await api.post(`/performance/check-out/${customerId}`);
      Alert.alert('✅ Check-out başarılı', `Ziyaret süresi: ${r.data.duration_text || r.data.duration_minutes + ' dk'}`);
      load();
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || e.message);
    } finally {
      setCheckInLoading(false);
    }
  };

  const BRAND_STYLES = {
    "Lay's":   { bg: '#fcd34d', fg: '#92400e', emoji: '🥔' },
    "Doritos": { bg: '#dc2626', fg: '#fff',    emoji: '🌶️' },
    "Cheetos": { bg: '#f97316', fg: '#fff',    emoji: '🧀' },
    "Ruffles": { bg: '#1e40af', fg: '#fff',    emoji: '〰️' },
    "Cipsi":   { bg: '#0891b2', fg: '#fff',    emoji: '🥨' },
    "Tang":    { bg: '#fbbf24', fg: '#7c2d12', emoji: '🍊' },
  };
  const brandStyle = (b) => BRAND_STYLES[b] || { bg: colors.brand, fg: '#fff', emoji: '📦' };

  useEffect(() => { load(); }, [load]);

  const submit = async (markVisited = true) => {
    setSaving(true);
    try {
      const body = {
        customer_id: customerId,
        visit_date: new Date().toISOString().slice(0, 10),
        sale_amount: parseFloat(saleAmount || '0') || 0,
        visited: markVisited ? 1 : 0,
        notes: notes || null,
      };
      await api.post('/performance/visits', body);
      Alert.alert(
        markVisited ? '✓ Ziyaret tamamlandı' : 'Kaydedildi',
        markVisited ? 'Performans paneline işlendi.' : 'Not olarak kaydedildi.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Hata', e.response?.data?.detail || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={brandGradient} style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.heroSub}>{visitOrder ? `Sıra ${visitOrder}` : 'Ziyaret'}</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>{customerName || '—'}</Text>
        </View>
        {existingVisit?.visited ? (
          <Tag label="Tamamlandı" color="#fff" bg="rgba(255,255,255,0.25)" />
        ) : (
          <Tag label="Açık" color="#fff" bg="rgba(255,255,255,0.25)" />
        )}
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={20}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          {loading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <ActivityIndicator color={colors.brand} size="large" />
            </View>
          ) : (
            <>
              {/* Müşteri bilgileri */}
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(customer?.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{customer?.name}</Text>
                    <Text style={styles.custMeta}>#{customer?.id}</Text>
                    {customer?.customer_type ? (
                      <View style={{ marginTop: 6 }}>
                        <Tag label={customer.customer_type} />
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <InfoCell label="Aylık Ciro" value={`${Number(customer?.monthly_revenue || 0).toLocaleString('tr-TR')} ₺`} />
                  <InfoCell label="Ziyaret/Ay" value={`${customer?.visit_frequency || 0}`} />
                  <InfoCell label="Tahmini Varış" value={fmtMin(estimatedArrival)} />
                </View>

                {customer?.phone ? (
                  <InfoRow icon="📞" label="Telefon" value={customer.phone} />
                ) : null}
                {customer?.address ? (
                  <InfoRow icon="📍" label="Adres" value={customer.address} />
                ) : null}
                <InfoRow icon="🗺️" label="Konum" value={`${customer?.x?.toFixed(4)}, ${customer?.y?.toFixed(4)}`} />
                {customer?.notes ? (
                  <InfoRow icon="📝" label="Müşteri Notu" value={customer.notes} />
                ) : null}

                {/* Hızlı eylem butonları */}
                <View style={styles.quickActions}>
                  <TouchableOpacity style={styles.quickActionBtn} onPress={openDirections} activeOpacity={0.85}>
                    <Text style={styles.quickActionIcon}>🧭</Text>
                    <Text style={styles.quickActionText}>Yol Tarifi</Text>
                  </TouchableOpacity>
                  {customer?.phone ? (
                    <TouchableOpacity
                      style={styles.quickActionBtn}
                      onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.quickActionIcon}>📞</Text>
                      <Text style={styles.quickActionText}>Ara</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>

              {/* Fotoğraflar — raf düzeni, stok kanıtı */}
              <SectionTitle right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!IS_WEB ? (
                    <TouchableOpacity
                      style={styles.photoBtn}
                      onPress={() => pickAndUploadPhoto(true)}
                      disabled={photoUploading}
                    >
                      <Text style={styles.photoBtnText}>📷 Çek</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={() => pickAndUploadPhoto(false)}
                    disabled={photoUploading}
                  >
                    <Text style={styles.photoBtnText}>
                      {IS_WEB ? '📁 Foto Ekle' : '🖼️ Galery'}
                    </Text>
                  </TouchableOpacity>
                </View>
              }>
                📷 Fotoğraflar ({photos.length})
              </SectionTitle>

              {photoUploading ? (
                <View style={[styles.photoEmpty, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={styles.photoEmptyText}>Yükleniyor…</Text>
                </View>
              ) : photos.length === 0 ? (
                <View style={styles.photoEmpty}>
                  <Text style={styles.photoEmptyIcon}>📸</Text>
                  <Text style={styles.photoEmptyText}>
                    Raf düzeni, sergi veya stok durumunu fotoğrafla
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {photos.map(p => (
                    <View key={p.id} style={styles.photoCard}>
                      <Image source={{ uri: p.photo_data }} style={styles.photoImg} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.photoDeleteBtn}
                        onPress={() => deletePhoto(p.id)}
                      >
                        <Text style={styles.photoDeleteText}>✕</Text>
                      </TouchableOpacity>
                      <Text style={styles.photoCaption}>
                        {new Date(p.taken_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* GPS Check-in kartı */}
              <View style={styles.checkInCard}>
                {!checkInStatus?.checked_in ? (
                  <>
                    <View style={styles.checkInHeader}>
                      <Text style={styles.checkInTitle}>📍 GPS Check-in</Text>
                      <Text style={styles.checkInSubtitle}>
                        Müşteriye geldim — konumun doğrulanıp ziyaret kaydı başlasın
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.checkInBtn}
                      onPress={handleCheckIn}
                      disabled={checkInLoading}
                      activeOpacity={0.85}
                    >
                      {checkInLoading
                        ? <ActivityIndicator color="#fff" />
                        : (
                          <>
                            <Text style={styles.checkInBtnIcon}>📍</Text>
                            <Text style={styles.checkInBtnText}>Müşteriye Geldim</Text>
                          </>
                        )}
                    </TouchableOpacity>
                  </>
                ) : !checkInStatus?.checked_out ? (
                  <>
                    <View style={styles.checkInActive}>
                      <View style={styles.pulseDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.checkInActiveTitle}>Ziyaret devam ediyor</Text>
                        <Text style={styles.checkInActiveMeta}>
                          Saat {new Date(checkInStatus.check_in_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'te giriş ·
                          {' '}{Math.round(checkInStatus.distance_m || 0)}m mesafe
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.checkInBtn, { backgroundColor: colors.negative }]}
                      onPress={handleCheckOut}
                      disabled={checkInLoading}
                      activeOpacity={0.85}
                    >
                      {checkInLoading
                        ? <ActivityIndicator color="#fff" />
                        : (
                          <>
                            <Text style={styles.checkInBtnIcon}>🏁</Text>
                            <Text style={styles.checkInBtnText}>Ziyareti Bitir</Text>
                          </>
                        )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.checkInDone}>
                    <Text style={styles.checkInDoneIcon}>✅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkInDoneTitle}>Ziyaret tamamlandı</Text>
                      <Text style={styles.checkInDoneMeta}>
                        Süre: {checkInStatus.duration_text || checkInStatus.duration_minutes + ' dk'} ·
                        {' '}{new Date(checkInStatus.check_in_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(checkInStatus.check_out_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {campaigns.length > 0 ? (
                <>
                  <SectionTitle>🎯 Sunulacak Kampanyalar ({campaigns.length})</SectionTitle>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
                  >
                    {campaigns.map(c => {
                      const bs = brandStyle(c.brand);
                      return (
                        <View key={c.id} style={[styles.miniCamp, { borderColor: bs.bg }]}>
                          <View style={[styles.miniCampBanner, { backgroundColor: bs.bg }]}>
                            <Text style={[styles.miniCampBrand, { color: bs.fg }]}>{bs.emoji} {c.brand}</Text>
                            {c.discount_text ? (
                              <Text style={[styles.miniCampDiscount, { color: bs.fg }]}>{c.discount_text}</Text>
                            ) : null}
                          </View>
                          <View style={{ padding: 10 }}>
                            <Text style={styles.miniCampTitle} numberOfLines={2}>{c.title}</Text>
                            <Text style={styles.miniCampDesc} numberOfLines={2}>{c.description}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              <SectionTitle right={
                <TouchableOpacity onPress={prepareMeeting} disabled={aiLoading} style={styles.aiBtnSmall}>
                  {aiLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.aiBtnSmallText}>🤖 Toplantıya Hazırla</Text>}
                </TouchableOpacity>
              }>
                AI Önerileri
              </SectionTitle>

              {aiTips ? (
                <View style={styles.aiCard}>
                  {aiSummary ? (
                    <View style={styles.aiSummaryBox}>
                      <Text style={styles.aiSummaryIcon}>💡</Text>
                      <Text style={styles.aiSummaryText}>{aiSummary}</Text>
                    </View>
                  ) : null}
                  {aiTips.map((tip, i) => (
                    <View key={i} style={styles.aiTipRow}>
                      <View style={styles.aiTipBubble}><Text style={styles.aiTipBubbleText}>{i + 1}</Text></View>
                      <Text style={styles.aiTipText}>{tip}</Text>
                    </View>
                  ))}
                  {aiEnabled === false ? (
                    <Text style={styles.aiDemoTag}>demo mod · gerçek AI bağlı değil</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.aiHintCard}>
                  <Text style={styles.aiHintIcon}>🤖</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiHintTitle}>AI ile hazırlan</Text>
                    <Text style={styles.aiHintText}>
                      Bu müşterinin geçmiş ziyaretleri ve profilinden 5 maddelik öneri al
                    </Text>
                  </View>
                </View>
              )}

              <SectionTitle>Ziyaret Sonucu</SectionTitle>

              <Card>
                <Text style={styles.label}>Satış Tutarı (₺)</Text>
                <TextInput
                  style={styles.input}
                  value={saleAmount}
                  onChangeText={setSaleAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={[styles.label, { marginTop: 14 }]}>Notlar</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Görüşme notları, takip aksiyonları..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </Card>

              <View style={{ height: 14 }} />

              <GradientButton
                title={existingVisit?.visited ? '✓ Güncelle' : 'Ziyareti Tamamla'}
                onPress={() => submit(true)}
                loading={saving}
                gradient={positiveGradient}
              />

              {!existingVisit?.visited ? (
                <TouchableOpacity
                  onPress={() => submit(false)}
                  style={styles.secondaryBtn}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>Sadece Not Kaydet (Ziyaret etmedim)</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function fmtMin(m) {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h > 0 ? `${h}sa ${mm}dk` : `${mm}dk`;
}

function InfoCell({ label, value }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={{ fontSize: 16, marginRight: 10 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 12, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -3 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: colors.brand, fontWeight: '800', fontSize: 20 },
  custName: { fontSize: 16, fontWeight: '800', color: colors.text },
  custMeta: { fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginTop: 2 },
  infoGrid: {
    flexDirection: 'row',
    marginTop: 14, marginBottom: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
  },
  infoCell: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: 4 },
  infoLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 3 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, alignItems: 'flex-start' },
  infoRowLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '700', textTransform: 'uppercase' },
  infoRowValue: { fontSize: 13, color: colors.text, fontWeight: '600', marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.text },
  input: {
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  secondaryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  aiBtnSmall: {
    backgroundColor: colors.brand, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    ...shadow.sm,
  },
  aiBtnSmallText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  aiHintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  aiHintIcon: { fontSize: 30 },
  aiHintTitle: { fontSize: 14, fontWeight: '800', color: colors.brand },
  aiHintText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  aiCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, ...shadow.sm,
  },
  aiSummaryBox: {
    flexDirection: 'row', gap: 10,
    backgroundColor: colors.brandLight,
    borderRadius: radius.sm,
    padding: 12, marginBottom: 12,
  },
  aiSummaryIcon: { fontSize: 18 },
  aiSummaryText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  aiTipRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  aiTipBubble: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  aiTipBubbleText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  aiTipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  aiDemoTag: {
    marginTop: 6, fontSize: 10, color: colors.textTertiary,
    fontWeight: '600', fontStyle: 'italic', textAlign: 'center',
  },
  miniCamp: {
    width: 210,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
    ...shadow.sm,
  },
  miniCampBanner: { padding: 10 },
  miniCampBrand: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  miniCampDiscount: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  miniCampTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  miniCampDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 15 },
  quickActions: {
    flexDirection: 'row', gap: 10, marginTop: 14,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  quickActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 14,
    gap: 8,
    ...shadow.sm,
  },
  quickActionIcon: { fontSize: 16 },
  quickActionText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // GPS Check-in
  checkInCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14,
    marginTop: 14,
    ...shadow.sm,
  },
  checkInHeader: { marginBottom: 12 },
  checkInTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  checkInSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  checkInBtn: {
    height: 48,
    backgroundColor: colors.positive,
    borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...shadow.sm,
  },
  checkInBtnIcon: { fontSize: 18 },
  checkInBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  checkInActive: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.positiveBg,
    borderRadius: radius.sm, padding: 12,
    marginBottom: 12,
  },
  pulseDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.positive,
  },
  checkInActiveTitle: { fontSize: 13, fontWeight: '800', color: colors.positive },
  checkInActiveMeta: { fontSize: 11, color: colors.text, marginTop: 2, fontWeight: '500' },
  checkInDone: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.sm, padding: 12,
  },
  checkInDoneIcon: { fontSize: 24 },
  checkInDoneTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  checkInDoneMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },

  // Foto
  photoBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    ...shadow.sm,
  },
  photoBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  photoEmpty: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  photoEmptyIcon: { fontSize: 32, marginBottom: 6 },
  photoEmptyText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  photoCard: {
    position: 'relative',
    width: 120, height: 140,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  photoImg: { width: '100%', height: 110 },
  photoDeleteBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoDeleteText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  photoCaption: {
    paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 10, color: colors.textSecondary, fontWeight: '700', textAlign: 'center',
  },
});
