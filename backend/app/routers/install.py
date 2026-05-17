"""
Install landing page — Android APK indirme + iPhone Expo Go yönlendirmesi.

QR kod ile dağıtım için: `https://saha-satis-planlama-guncel.onrender.com/install`
Bu URL'i QR'a dönüştür ve posterde/sunumda paylaş.

Environment variables (Render dashboard'da set edilir):
  EAS_BUILD_URL — Expo build sayfası URL'i (kullanıcı APK'yı buradan indirir)
                  örn. https://expo.dev/accounts/tugceeeeeeee/projects/saha-satis-mobile/builds/3bde01c5-...
  EAS_APK_URL   — (opsiyonel) Direkt .apk dosya URL'i (Expo artifact link'i)
                  Set edilirse Android'de tek tıkla indirme başlar
"""
import os
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["install"])

DEFAULT_EAS_BUILD_URL = "https://expo.dev/accounts/tugceeeeeeee/projects/saha-satis-mobile/builds"


@router.get("/install", response_class=HTMLResponse)
def install_page(request: Request):
    ua = request.headers.get("user-agent", "").lower()
    is_android = "android" in ua
    is_ios = "iphone" in ua or "ipad" in ua

    eas_build_url = os.getenv("EAS_BUILD_URL", DEFAULT_EAS_BUILD_URL).strip()
    eas_apk_url = os.getenv("EAS_APK_URL", "").strip()

    # Android için direkt APK varsa onu kullan, yoksa build sayfasına gönder
    android_link = eas_apk_url or eas_build_url
    expo_go_play_store = "https://play.google.com/store/apps/details?id=host.exp.exponent"
    expo_go_app_store = "https://apps.apple.com/app/expo-go/id982107779"

    # Cihaza özel ana CTA
    if is_android:
        primary_btn = f'<a class="btn btn-primary" href="{android_link}">📲 Android APK İndir</a>'
        primary_note = "Tıkla, APK telefona iner. Kurulumda Android'in 'bilinmeyen kaynak' uyarısını onayla."
    elif is_ios:
        primary_btn = f'<a class="btn btn-primary" href="{expo_go_app_store}">📱 Expo Go İndir (App Store)</a>'
        primary_note = "iPhone için: önce Expo Go'yu indir, sonra demo QR kodumuzu Expo Go'da okut."
    else:
        primary_btn = (
            f'<a class="btn btn-primary" href="{android_link}">📲 Android APK İndir</a>'
            f'<a class="btn btn-secondary" href="{expo_go_app_store}">🍎 iPhone — Expo Go</a>'
        )
        primary_note = "Telefon türüne göre yukarıdaki seçeneklerden birini tıkla."

    # QR — Build URL'sinin QR kodu (Google Charts API ile, server-side rendering yok)
    import urllib.parse
    qr_data = urllib.parse.quote(android_link, safe="")
    qr_img = f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={qr_data}&color=1e1b4b&bgcolor=ffffff"

    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Saha Satış — Kurulum</title>
  <meta name="theme-color" content="#1e1b4b" />
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #6366f1 100%);
      min-height: 100vh;
      color: #fff;
      -webkit-font-smoothing: antialiased;
    }}
    .wrap {{
      max-width: 480px; margin: 0 auto;
      padding: 32px 20px 48px;
    }}
    .logo {{
      width: 80px; height: 80px; margin: 24px auto 18px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 22px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 30px; letter-spacing: -1px;
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.5);
    }}
    h1 {{
      text-align: center; font-size: 28px; font-weight: 800;
      letter-spacing: -0.5px; margin-bottom: 6px;
    }}
    .subtitle {{
      text-align: center; color: rgba(255,255,255,0.7);
      font-size: 14px; margin-bottom: 32px;
    }}
    .card {{
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 22px;
      padding: 24px;
      margin-bottom: 18px;
    }}
    .card-header {{
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 14px;
    }}
    .card-icon {{
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }}
    .card-title {{ font-size: 16px; font-weight: 700; }}
    .card-text {{
      color: rgba(255,255,255,0.75);
      font-size: 13px; line-height: 1.6;
    }}
    .btn {{
      display: block; width: 100%;
      padding: 16px 20px;
      background: #fff; color: #6366f1;
      border-radius: 14px;
      text-decoration: none; text-align: center;
      font-weight: 700; font-size: 15px;
      margin-bottom: 10px;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }}
    .btn:active {{ transform: scale(0.98); }}
    .btn-primary {{ background: #fff; color: #6366f1; }}
    .btn-secondary {{
      background: rgba(255,255,255,0.15);
      color: #fff;
      border: 1.5px solid rgba(255,255,255,0.25);
    }}
    .note {{
      color: rgba(255,255,255,0.6);
      font-size: 12px;
      text-align: center;
      margin-top: 10px;
      line-height: 1.5;
    }}
    .qr-box {{
      background: #fff;
      padding: 16px;
      border-radius: 18px;
      display: inline-block;
      margin: 16px auto 0;
    }}
    .qr-box img {{ display: block; width: 200px; height: 200px; }}
    .qr-center {{ text-align: center; }}
    ol.steps {{
      list-style: none; counter-reset: step;
      padding: 0; margin: 14px 0 0;
    }}
    ol.steps li {{
      counter-increment: step;
      padding: 10px 0 10px 38px;
      font-size: 13px;
      color: rgba(255,255,255,0.85);
      position: relative;
      line-height: 1.5;
    }}
    ol.steps li::before {{
      content: counter(step);
      position: absolute;
      left: 0; top: 8px;
      width: 26px; height: 26px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800;
      color: #fff;
    }}
    .footer {{
      text-align: center;
      color: rgba(255,255,255,0.4);
      font-size: 11px;
      margin-top: 28px;
    }}
    .pill {{
      display: inline-block;
      padding: 4px 10px;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border-radius: 20px;
      font-size: 11px; font-weight: 700;
      margin-bottom: 16px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">SS</div>
    <h1>Saha Satış</h1>
    <p class="subtitle">Mobil Demo Uygulaması</p>

    <div style="text-align:center; margin-bottom: 24px;">
      <span class="pill">● Canlı backend'e bağlı</span>
    </div>

    <!-- Ana CTA -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">📲</div>
        <div class="card-title">Hemen Kur</div>
      </div>
      {primary_btn}
      <p class="note">{primary_note}</p>
    </div>

    <!-- QR kod (cross-device kullanım) -->
    <div class="card qr-center">
      <div class="card-header" style="justify-content: center;">
        <div class="card-icon">🔲</div>
        <div class="card-title">Veya QR ile</div>
      </div>
      <p class="card-text">Bilgisayardan açtıysan, telefon kamerasıyla bu QR'ı okut:</p>
      <div class="qr-box">
        <img src="{qr_img}" alt="APK QR Kod" />
      </div>
    </div>

    <!-- Android adımları -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🤖</div>
        <div class="card-title">Android — Kurulum Adımları</div>
      </div>
      <ol class="steps">
        <li>Yukarıdaki "Android APK İndir" butonuna bas</li>
        <li>Expo'nun build sayfasında "Install" butonuna tıkla, APK iner</li>
        <li>İndirilenler'den APK'ya dokun — "Bilinmeyen kaynak" uyarısı çıkar</li>
        <li>Ayarlar açılır → tarayıcı için "Bu kaynağa izin ver" → geri dön</li>
        <li>"Yükle" → bekle → "Aç"</li>
      </ol>
    </div>

    <!-- iPhone adımları -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🍎</div>
        <div class="card-title">iPhone — Kurulum Adımları</div>
      </div>
      <ol class="steps">
        <li>App Store'dan <strong>Expo Go</strong> uygulamasını indir</li>
        <li>Demoyu sunan kişiden Expo dev sunucu QR'ını iste</li>
        <li>iPhone kamerasıyla QR'ı okut → Expo Go'da açılır</li>
      </ol>
      <p class="note">iOS için bağımsız app TestFlight gerektirir (Apple Developer hesabı).</p>
    </div>

    <p class="footer">
      Saha Satış Planlama · Karar Destek Sistemi<br/>
      Demo amaçlıdır — gerçek backend (Render + Neon DB) kullanır
    </p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)
