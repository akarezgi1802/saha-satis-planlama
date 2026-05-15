# Saha Satış — Mobil Demo App

Web'deki **Saha Satış Planlama** projesinin satış temsilcisi için mobil demo uygulaması.
React Native + Expo ile yazıldı, canlı backend'e bağlı:
`https://saha-satis-planlama-guncel.onrender.com`

## Özellikler

- 🔐 **Giriş**: email/şifre veya QR kod ile
- 🏠 **Ana sayfa**: bugün/hafta/ay performansı, hedef ilerlemesi, son duyurular, müşteri/AI hızlı erişim
- 🗺️ **Planım** (canlı rota): tamamlanmış son plandan, kendi bölgenin günlük rotaları
  - **Harita görünümü**: depo + numaralı duraklar + polyline ile rota
  - **Liste görünümü**: timeline ile sıralı duraklar
  - Tamamlanan ziyaretler ✓ yeşil markerla işaretli, ilerleme yüzdesi
- 🤖 **AI Asistan tab**: chat arayüzü + hızlı aksiyonlar (haftalık özet, satış tavsiyeleri)
- ✅ **Ziyaret detayı**:
  - Müşteri bilgileri, geçmiş ziyaret kayıtları
  - **🤖 Toplantıya Hazırla** butonu (AI 5 madde öneri + özet üretir)
  - Satış tutarı + notlar → gerçek backend'e yazar
- 👥 **Müşteriler**: Dashboard'dan erişilir, arama + bölge filtresi
- 🔔 **Duyurular**: 15 sn polling, "Yeni" rozeti, tab badge
- 👤 **Profil**: çıkış yap

## Çalıştır

```bash
cd mobile
npm install
npx expo start
```

Telefonuna **Expo Go** uygulamasını indir, terminaldeki QR'ı Expo Go ile okut. Birkaç saniyede yüklenir.

> **Not**: Render free tier — backend ilk istekte ~15 sn cold-start yapabilir. İlk login'de bekle.

## QR kod ile demo giriş

Login ekranında **QR Kod ile Giriş** butonu kamerayı açar. QR'da JSON olmalı:

```json
{"email": "rep@firma.com", "password": "12345"}
```

[qr-code-generator.com](https://www.qr-code-generator.com) gibi bir siteden bu JSON'u QR'a çevir. Telefon kamerayı QR'a tutar → otomatik giriş.

Düz format `email:password` de çalışır:
```
rep@firma.com:12345
```

## AI Botu — Gerçek AI'ya geçiş (ücretsiz)

Şu an demo modunda hardcoded cevaplar dönüyor. **Gerçek AI** için:

1. [Google AI Studio](https://aistudio.google.com/app/apikey) → ücretsiz API key oluştur
   - Ücretsiz tier: 15 istek/dakika, 1500 istek/gün, gemini-2.0-flash modeli
2. [Render Dashboard](https://dashboard.render.com) → `saha-satis-planlama` servisini aç
3. **Environment** sekmesi → **Add Environment Variable**:
   - Key: `GEMINI_API_KEY`
   - Value: AI Studio'dan kopyaladığın key
4. **Save Changes** → servis otomatik restart eder
5. App'i yeniden aç → AI tab'ı yeşil noktayla "google-gemini · gemini-2.0-flash" gösterir

**Maliyet**: $0 (Google'ın ücretsiz tier'ı, kredi kartı gerekmiyor).

## Mimari notları

- **API client**: `src/api.js` (axios + AsyncStorage token interceptor)
- **Auth**: `src/AuthContext.js` — form-data login (FastAPI OAuth2)
- **Polling duyurular**: ekran odaktayken `AnnouncementsScreen` her 15 sn,
  arka planda `RootNavigator` tab badge için 20 sn
- **Renkler**: `src/theme.js` — web tasarımının indigo→purple gradient'ini koruyor
- **Harita**: `react-native-maps` (Expo Go'da çalışır, key gerekmez)
- **AI**: backend `routers/ai.py` Gemini REST API'sini direkt çağırır,
  key yoksa mock fallback

## Endpoint kullanımı

| Ekran | Endpoint |
|---|---|
| Login | `POST /api/auth/login` (form) |
| Dashboard | `GET /api/performance/summary`, `GET /api/announcements/` |
| Planım | `GET /api/plans/`, `GET /api/plans/{id}/my-plan`, `GET /api/settings/depot` |
| Ziyaret tamamla | `POST /api/performance/visits` |
| Toplantıya Hazırla | `GET /api/ai/prepare-meeting/{customer_id}` |
| AI Chat | `POST /api/ai/chat`, `GET /api/ai/status` |
| Haftalık Özet | `GET /api/ai/activity-summary?days=7` |
| Müşteriler | `GET /api/customers/` |
| Duyurular | `GET /api/announcements/` (polling) |

## Tabs

5 tab: **Ana Sayfa · Planım · Asistan (AI) · Duyurular · Profil**

Müşteriler ve Ziyaret Detay tab değil — Dashboard veya Plan'dan push edilir.
