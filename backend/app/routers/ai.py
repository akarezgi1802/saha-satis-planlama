"""
AI asistanı — Google Gemini API (ücretsiz tier) kullanır.

Kurulum:
  1. https://aistudio.google.com/app/apikey adresinden ücretsiz API key al
  2. Render dashboard → Environment → GEMINI_API_KEY ekle
  3. Servisi yeniden başlat

Key yoksa endpoint'ler graceful mock cevap döner (demo modu).
"""
import os
import json
from datetime import date, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Customer, SalesVisit
from ..auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _ai_available() -> bool:
    return bool(GEMINI_API_KEY)


def _call_gemini(prompt: str, system: Optional[str] = None, temperature: float = 0.6) -> str:
    """Gemini'yi çağırır. Hata olursa mesajla birlikte exception atar."""
    if not _ai_available():
        raise RuntimeError("GEMINI_API_KEY tanımlı değil")

    url = f"{GEMINI_URL_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 800,
            "topP": 0.95,
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    try:
        r = requests.post(url, json=body, timeout=30)
        if r.status_code >= 400:
            raise RuntimeError(f"Gemini hata {r.status_code}: {r.text[:200]}")
        data = r.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini boş cevap döndü")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise RuntimeError("Gemini içeriksiz cevap döndü")
        return text
    except requests.RequestException as e:
        raise RuntimeError(f"Gemini bağlantı hatası: {e}")


SYSTEM_PROMPT = (
    "Sen Türkçe konuşan bir saha satış asistanısın. Görevlerin: "
    "1) Saha satış temsilcilerine ziyaretlerinde yardımcı olmak, "
    "2) Müşteri verilerini analiz edip kısa öneriler vermek, "
    "3) Aktivite özetleri çıkarmak. "
    "Her zaman kısa, net, madde madde yaz. Asla uydurma — sadece verilen veriden yola çık. "
    "Cevaplar 200 kelimeyi geçmesin."
)


# ─── Şemalar ─────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    ai_enabled: bool


class MeetingPrepResponse(BaseModel):
    tips: list[str]
    summary: str
    ai_enabled: bool


# ─── Endpoint'ler ────────────────────────────────────

@router.get("/status")
def ai_status():
    return {
        "enabled": _ai_available(),
        "provider": "google-gemini",
        "model": GEMINI_MODEL if _ai_available() else None,
    }


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user: User = Depends(get_current_user)):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz")

    if not _ai_available():
        return ChatResponse(
            reply=(
                "🤖 Demo modu — gerçek AI bağlı değil.\n\n"
                "Yöneticin GEMINI_API_KEY ekledikten sonra burada gerçek cevaplar göreceksin. "
                "Bu sürede genel olarak şunlara yardımcı olabilirim (gerçekte):\n\n"
                "• Müşteri görüşmesine hazırlık\n"
                "• Haftalık aktivite özeti\n"
                "• Satış teknikleri tavsiyesi\n"
                "• Müşteri itirazlarına nasıl cevap verilir"
            ),
            ai_enabled=False,
        )

    ctx = f"\n\nEk bağlam:\n{body.context}" if body.context else ""
    prompt = f"Kullanıcı ({user.full_name}, satış temsilcisi):\n{body.message}{ctx}"
    try:
        reply = _call_gemini(prompt, system=SYSTEM_PROMPT)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ChatResponse(reply=reply, ai_enabled=True)


@router.get("/prepare-meeting/{customer_id}", response_model=MeetingPrepResponse)
def prepare_meeting(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Belirli bir müşteriyle yapılacak görüşme için öneri üretir."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")

    # Önceki ziyaretler
    past = (
        db.query(SalesVisit)
        .filter(SalesVisit.user_id == user.id, SalesVisit.customer_id == customer_id)
        .order_by(SalesVisit.visit_date.desc())
        .limit(5)
        .all()
    )

    past_summary = ""
    if past:
        lines = []
        for v in past:
            line = f"- {v.visit_date}: {int(v.sale_amount)} ₺"
            if v.notes:
                line += f" — {v.notes[:120]}"
            lines.append(line)
        past_summary = "Son ziyaretler:\n" + "\n".join(lines)
    else:
        past_summary = "Bu müşteriyle daha önce ziyaretin kayıtlı değil."

    customer_brief = (
        f"Müşteri: {customer.name}\n"
        f"Aylık ciro: {int(customer.monthly_revenue)} ₺ · Aylık ziyaret: {customer.visit_frequency}\n"
        f"Tip: {customer.customer_type or '—'}\n"
        f"Adres: {customer.address or '—'}\n"
        f"Müşteri notu: {customer.notes or '—'}\n"
    )

    if not _ai_available():
        # Mock cevap
        tips = [
            f"{customer.name} ile düzenli iletişimde kal — son ziyaretten {len(past)} kayıt var.",
            f"Aylık {int(customer.monthly_revenue)} ₺ ciro yapıyor — hedeflerini öğren ve büyüme planı sun.",
            "Ziyaret öncesi önceki notları gözden geçir, kaldığın yerden devam et.",
            "Müşteri itirazlarına hazırlıklı git: fiyat, teslimat süresi, vade.",
            "Görüşme sonunda somut bir aksiyon belirle (tekrar ziyaret tarihi, teklif gönderimi).",
        ]
        summary = f"{customer.name} — Aylık {int(customer.monthly_revenue)} ₺ potansiyeli olan {customer.customer_type or 'müşteri'}."
        return MeetingPrepResponse(tips=tips, summary=summary, ai_enabled=False)

    prompt = (
        f"{customer_brief}\n{past_summary}\n\n"
        "Bu müşteriyle yapılacak görüşme için 5 maddelik kısa öneri listesi hazırla. "
        "Her madde tek cümle olsun, somut ve uygulanabilir olsun. "
        "Sonunda 1 cümlelik kısa bir özet ver.\n\n"
        "Cevabını şu JSON formatında dön (sadece JSON, başka metin yok):\n"
        '{"tips": ["...", "...", "...", "...", "..."], "summary": "..."}'
    )
    try:
        raw = _call_gemini(prompt, system=SYSTEM_PROMPT, temperature=0.5)
        # JSON ayıkla
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            raise RuntimeError("AI cevabı JSON içermiyor")
        parsed = json.loads(raw[start:end + 1])
        return MeetingPrepResponse(
            tips=parsed.get("tips", [])[:5],
            summary=parsed.get("summary", "").strip(),
            ai_enabled=True,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI cevabı işlenemedi: {e}")


@router.get("/activity-summary")
def activity_summary(
    days: int = 7,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Son N günün ziyaret aktivitesini AI ile özetler."""
    today = date.today()
    start = today - timedelta(days=days)
    visits = (
        db.query(SalesVisit)
        .filter(
            SalesVisit.user_id == user.id,
            SalesVisit.visit_date >= start,
            SalesVisit.visit_date <= today,
        )
        .order_by(SalesVisit.visit_date.desc())
        .all()
    )

    total_sales = sum(v.sale_amount for v in visits)
    visit_count = sum(1 for v in visits if v.visited)
    customer_count = len(set(v.customer_id for v in visits))

    stats = {
        "total_sales": total_sales,
        "visit_count": visit_count,
        "customer_count": customer_count,
        "days": days,
    }

    if not visits:
        return {
            "summary": f"Son {days} günde kayıtlı ziyaretin yok. Planına göz at ve başla.",
            "stats": stats,
            "ai_enabled": _ai_available(),
        }

    if not _ai_available():
        return {
            "summary": (
                f"Son {days} günde {visit_count} ziyaret tamamladın, toplam {int(total_sales)} ₺ satış. "
                f"{customer_count} farklı müşteriye ulaştın."
            ),
            "stats": stats,
            "ai_enabled": False,
        }

    # AI özet
    lines = []
    for v in visits[:20]:
        c = db.query(Customer).filter(Customer.id == v.customer_id).first()
        cname = c.name if c else f"#{v.customer_id}"
        l = f"- {v.visit_date} {cname}: {int(v.sale_amount)} ₺"
        if v.notes:
            l += f" — {v.notes[:100]}"
        lines.append(l)

    prompt = (
        f"Satış temsilcisi {user.full_name}'in son {days} günlük aktivitesi:\n"
        f"Toplam satış: {int(total_sales)} ₺ · {visit_count} ziyaret · {customer_count} müşteri\n\n"
        + "\n".join(lines)
        + "\n\n"
        "Bu aktiviteyi 3-4 cümlelik bir özet olarak yaz. "
        "Olumlu noktaları vurgula, geliştirilecek alanları da nazikçe belirt. "
        "Doğrudan kullanıcıya hitap et (sen dili)."
    )
    try:
        summary = _call_gemini(prompt, system=SYSTEM_PROMPT, temperature=0.7)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"summary": summary, "stats": stats, "ai_enabled": True}
