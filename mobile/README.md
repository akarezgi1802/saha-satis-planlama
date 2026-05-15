# Saha Satış — Mobil Demo App

Web'deki **Saha Satış Planlama** projesinin mobil demo uygulaması.
React Native + Expo, canlı backend'e bağlı: `https://saha-satis-planlama-guncel.onrender.com`

## Özellikler

- 🔐 Email/şifre veya QR kod ile giriş
- 🏠 **Dashboard**: bugün'ün ziyaret hedefi (X/Y), sürdürülebilirlik kartı (🌳 ağaç eşdeğeri), KPI'lar, kampanya carousel, haftalık grafik
- 🗺️ **Planım**: harita üzerinde polyline + sıralı duraklar, ya da liste görünümü; gün seçici, ilerleme overlay'i
- 🤖 **AI Asistan** (Gemini 2.5 Flash): chat, "Bu haftaki özetim", satış teknikleri, müşteri için "Toplantıya Hazırla"
- 🔔 **Bildirimler**: Duyurular + Kampanyalar (Frito-Lay marka renkleri), 15 sn polling, tab badge'i
- 👤 **Profil**: sürdürülebilirlik katkım (lifetime ağaç sayısı), hesap bilgileri

## 3 farklı çalıştırma şekli

### 🟢 1. Expo Go ile (en hızlı, telefonda)

```bash
cd mobile
npm install     # ilk seferde
npx expo start
```

Telefonunda Expo Go indir (Play/App Store), aynı Wi-Fi'da terminaldeki QR'ı okut.
**Tüm özellikler çalışır** (harita, QR scan, kamera).

### 🌐 2. Expo Web ile (tarayıcıda, hızlı demo)

```bash
cd mobile
npx expo start --web
```

Otomatik `http://localhost:8081` açılır. **Çalışmayan özellikler**:
- Harita (react-native-maps web'de yok) → otomatik liste görünümü
- QR scan (kamera) → email/şifre ile giriş

Çalışanlar: Dashboard, Plan listesi, AI sohbet, Bildirimler, Kampanyalar, Profil.

Web'de paylaşmak istersen `npx expo export -p web` ile static build alıp herhangi bir host'a koyabilirsin (Netlify, Vercel, Render Static Site).

### 📱 3. EAS Build ile bağımsız APK (telefona kur, Expo Go gerekmez)

Expo'nun bulut servisi gerçek bir Android `.apk` üretir. Telefona kurarsın, Expo Go olmadan çalışır.

**Tek seferlik kurulum**:
```bash
npm install -g eas-cli
eas login              # https://expo.dev'de ücretsiz hesap aç
```

**APK build et** (ücretsiz tier'da ayda 30 build):
```bash
cd mobile
eas build --platform android --profile preview
```

15-30 dakika sürer. Build bitince Expo Dashboard'da indirme linki çıkar, link telefondan açılır, APK indirilir, kurulum onayı verilir.

**iOS için**: `--platform ios` ile aynı, ama dağıtım için Apple Developer hesabı ($99/yıl) ya da TestFlight gerekli. Demo için Expo Go önerilir.

## Mimari

- API: `src/api.js` (axios + AsyncStorage token)
- Auth: `src/AuthContext.js` (form-data OAuth2 login)
- Navigation: 5 tab — Home / Plan / AI / Bildirimler / Profil + Stack ekranları (Customers, VisitDetail)
- Polling: Bildirimler 15 sn, tab badge 20 sn
- Tema: web tarafıyla aynı (`src/theme.js`) — indigo→purple gradient, Frito-Lay marka renkleri

## QR ile demo giriş

QR'da JSON olmalı:
```json
{"email": "rep@firma.com", "password": "12345"}
```

[qr-code-generator.com](https://www.qr-code-generator.com) gibi bir siteden bu JSON'u QR'a çevir.
Sadece native'de (Expo Go / APK) çalışır.

## AI Asistan — Gemini API

Backend'de `GEMINI_API_KEY` Render env var'ında set ise gerçek AI çalışır.
Yoksa demo modu (mock cevaplar). Detay: `backend/app/routers/ai.py`

## Endpoint kullanımı

| Ekran | Endpoint |
|---|---|
| Login | `POST /api/auth/login` (form) |
| Dashboard | `GET /api/performance/summary`, `today-target`, `sustainability`, `/announcements/`, `/campaigns/` |
| Planım | `GET /api/plans/`, `/api/plans/{id}/my-plan`, `/api/settings/depot` |
| Ziyaret tamamla | `POST /api/performance/visits` |
| Toplantıya Hazırla | `GET /api/ai/prepare-meeting/{customer_id}` |
| AI Chat | `POST /api/ai/chat`, `GET /api/ai/status` |
| Haftalık Özet | `GET /api/ai/activity-summary?days=7` |
| Müşteriler | `GET /api/customers/` |
| Bildirimler | `GET /api/announcements/`, `/api/campaigns/` (her ikisi polling) |
| Profil sürdürülebilirlik | `GET /api/performance/sustainability` |
