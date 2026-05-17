"""
Demo veri seed endpoint'i — sunum/test için tek tıkla zengin veri yükler.

Eklenenler (idempotent, tekrar çağrılırsa duplicate yapmaz):
- 3 sales rep (yoksa demo1/2/3@sahasatis.com hesapları)
- Cluster atamaları (mevcut plana göre)
- 1 haftalık SalesVisit kayıtları (Pzt-bugüne kadar her gün)
- Duyurular (5 farklı kategori)
- Kampanyalar (5 Frito-Lay markası)
- Görevler (5 öncelikli iş)

Mevcut müşteri/plan/kullanıcı verisi etkilenmez.

Kullanım:
  POST /api/admin/seed-demo (admin token)
  POST /api/admin/reset-demo (demo email'li rep'ler + onların ziyaretleri silinir)
"""
import random
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Customer, Plan, WeeklyAssignment, SalesVisit,
    Announcement, Campaign, Task,
)
from ..auth import require_admin, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin-demo"])

# Demo kullanıcı email'leri — temizlik için belirleyici
DEMO_EMAILS = ["demo1@sahasatis.com", "demo2@sahasatis.com", "demo3@sahasatis.com"]
DEMO_NAMES = ["Ahmet Yılmaz", "Zeynep Kaya", "Mehmet Demir"]

DEMO_NOTES = [
    "Sipariş alındı, kampanya tanıtıldı",
    "Müşteri ile rutin görüşme, ihtiyaçlar not edildi",
    "Yeni ürün sunumu yapıldı, ilgi var",
    "Stok durumu kontrol edildi, eksikler bildirildi",
    "Soğuk zincir kontrolü tamam",
    "Raflar düzenlendi, kampanya etiketleri yerleştirildi",
    "Mağaza sahibi memnun, tekrar ziyaret planlandı",
    None,  # bazıları notsuz
]

DEMO_ANNOUNCEMENTS = [
    ("Q2 Hedefleri Güncellendi",
     "İkinci çeyrek satış hedefleri yeniden değerlendirildi. Yeni hedeflere ana sayfanızdan ulaşabilirsiniz. Her temsilci için bireysel hedef atandı.",
     "info"),
    ("🎯 Yaz Sezonu Kampanyaları Başladı",
     "Tüm Frito-Lay ürünlerinde mevsimsel kampanyalar yayında. Detaylar Kampanyalar sayfasında — her müşteri ziyaretinde mutlaka bahsedin.",
     "campaign"),
    ("⚠️ Acil: Soğuk Zincir Kontrolü",
     "Bu hafta tüm market ziyaretlerinde soğuk zincir kontrolü zorunlu. Sıcaklık ölçümü yapın ve fotoğraflayın. 24 saat içinde rapor edin.",
     "urgent"),
    ("Cuma Performans Toplantısı",
     "Cuma günü saat 14:00'te haftalık performans toplantısı. Tüm temsilcilerin katılımı bekleniyor. Sunum: zoom link sonra paylaşılacak.",
     "general"),
    ("🎉 Yeni Mobil Uygulama Yayında",
     "Saha Satış mobil uygulaması artık TomTom trafik desteği, GPS check-in ve AI asistanı ile! Test edip geri bildirim verin.",
     "success"),
]

DEMO_CAMPAIGNS = [
    ("Lay's Klasik 100gr · %15 İndirim", "Lay's", "%15 indirim",
     "Mart-Nisan aylarında tüm Lay's Klasik 100gr ürünlerinde geçerlidir. Mağaza içi raf düzenlemesi yapılmalı, kampanya etiketi yerleştirilmeli."),
    ("Doritos Nacho · 2 Al 1 Bedava", "Doritos", "2+1 hediye",
     "Tüm Doritos 150gr+ ürünlerinde geçerli, 30 Haziran'a kadar. Hipermarketler öncelikli, bakkallarda da geçerli."),
    ("Cheetos Aile Boyu · %20 İndirim", "Cheetos", "%20 indirim",
     "Cheetos 250gr+ ürünlerinde %20 indirim. Hipermarketler önceliklidir. Minimum 6 koli sipariş şartı vardır."),
    ("Ruffles Acılı · Yeni Ürün Lansmanı", "Ruffles", "Yeni!",
     "Yeni 'Ruffles Acılı' raflarda. İlk siparişlerde %25 indirim. Müşterilere tadım önerin, geri bildirimleri toplayın."),
    ("Cipsi Yaz Kampanyası · 3+1", "Cipsi", "3 Al 1 Bedava",
     "Cipsi 50gr ürünlerinde 3 al 1 bedava. Bakkal ve büfeler hedef. Minimum 4 koli ile geçerli."),
]


def _ensure_demo_reps(db: Session):
    """3 demo sales rep yoksa oluştur, varsa al."""
    reps = []
    for i, (email, name) in enumerate(zip(DEMO_EMAILS, DEMO_NAMES)):
        rep = db.query(User).filter(User.email == email).first()
        if not rep:
            rep = User(
                email=email,
                hashed_password=hash_password("demo123"),
                full_name=name,
                role="sales_rep",
                company="Frito-Lay Bayisi",
                monthly_target=500000,
                is_active=1,
            )
            db.add(rep)
            db.commit()
            db.refresh(rep)
        reps.append(rep)
    return reps


def _assign_clusters(db: Session, reps: list[User], plan: Plan):
    """Plan'daki mevcut cluster index'leri reps'e dağıt."""
    cluster_indices = sorted(set(
        c[0] for c in db.query(WeeklyAssignment.cluster_index)
        .filter(WeeklyAssignment.plan_id == plan.id)
        .distinct().all()
    ))
    if not cluster_indices:
        return
    for i, rep in enumerate(reps):
        rep.cluster_index = cluster_indices[i % len(cluster_indices)]
    db.commit()


def _seed_visits(db: Session, reps: list[User], plan: Plan):
    """Pazartesi-bugün arası her güne 3-6 ziyaret."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    visits_added = 0
    total_sales_added = 0

    for rep in reps:
        if rep.cluster_index is None:
            continue

        for day_offset in range(7):  # 0=Pzt..6=Paz
            visit_date = week_start + timedelta(days=day_offset)
            if visit_date > today:
                break  # gelecek atla

            day_of_week_backend = day_offset + 1  # backend: 1=Pzt..6=Cmt
            if day_of_week_backend > 6:
                continue  # Pazar yok

            # Bu cluster + bu gün için planlanmış müşteriler
            day_customer_ids = [
                c[0] for c in db.query(WeeklyAssignment.customer_id).filter(
                    WeeklyAssignment.plan_id == plan.id,
                    WeeklyAssignment.cluster_index == rep.cluster_index,
                    WeeklyAssignment.day_of_week == day_of_week_backend,
                ).all()
            ]
            if not day_customer_ids:
                continue

            # 3-6 müşteriye ziyaret simüle et
            sample_size = min(random.randint(3, 6), len(day_customer_ids))
            sampled = random.sample(day_customer_ids, sample_size)

            for cust_id in sampled:
                # Bu user+customer+date için zaten kayıt var mı?
                existing = db.query(SalesVisit).filter(
                    SalesVisit.user_id == rep.id,
                    SalesVisit.customer_id == cust_id,
                    SalesVisit.visit_date == visit_date,
                ).first()
                if existing:
                    continue

                sale_amount = random.randint(500, 15000)
                # Bugün için bazılarını henüz tamamlamamış göster (mobile'da hareket olsun)
                is_today = visit_date == today
                visited = 1 if not is_today or random.random() > 0.3 else 0

                visit = SalesVisit(
                    user_id=rep.id,
                    customer_id=cust_id,
                    visit_date=visit_date,
                    sale_amount=sale_amount if visited else 0,
                    visited=visited,
                    notes=random.choice(DEMO_NOTES) if visited else None,
                )
                db.add(visit)
                visits_added += 1
                if visited:
                    total_sales_added += sale_amount

    db.commit()
    return visits_added, total_sales_added


def _seed_announcements(db: Session, admin: User):
    added = 0
    for title, content, category in DEMO_ANNOUNCEMENTS:
        if db.query(Announcement).filter(Announcement.title == title).first():
            continue
        db.add(Announcement(
            title=title, content=content, category=category,
            author_id=admin.id, is_active=1,
        ))
        added += 1
    db.commit()
    return added


def _seed_campaigns(db: Session, admin: User):
    today = date.today()
    added = 0
    for title, brand, discount_text, description in DEMO_CAMPAIGNS:
        if db.query(Campaign).filter(Campaign.title == title).first():
            continue
        db.add(Campaign(
            title=title, brand=brand, discount_text=discount_text,
            description=description,
            valid_from=today, valid_until=today + timedelta(days=30),
            author_id=admin.id, is_active=1,
        ))
        added += 1
    db.commit()
    return added


def _seed_tasks(db: Session, admin: User, reps: list[User]):
    today = date.today()
    if len(reps) < 3:
        return 0

    # En az 1 müşteriyi referans için al
    sample_customer = db.query(Customer).first()
    customer_id = sample_customer.id if sample_customer else None

    demo_tasks = [
        (reps[0].id, "Çalışkan Otomotiv'le takip görüşmesi yap", "high", 1, customer_id),
        (reps[1].id, "Yeni müşteri ziyaret planı hazırla", "normal", 3, None),
        (reps[2].id, "🚨 Soğuk zincir raporu — bu hafta", "urgent", 1, None),
        (reps[0].id, "Doritos kampanyasını ziyaret listene ekle", "high", 5, None),
        (reps[1].id, "Aylık ciro raporunu kontrol et", "normal", 7, None),
        (reps[2].id, "Yeni Ruffles tadım örnekleri dağıt", "normal", 4, None),
    ]
    added = 0
    for rep_id, title, prio, days_due, cust_id in demo_tasks:
        if db.query(Task).filter(Task.title == title).first():
            continue
        db.add(Task(
            title=title,
            description="Demo veri için otomatik eklendi. Tamamlanabilir veya silinebilir.",
            assigned_to_id=rep_id,
            assigned_by_id=admin.id,
            priority=prio,
            status="open",
            due_date=today + timedelta(days=days_due),
            customer_id=cust_id,
        ))
        added += 1
    db.commit()
    return added


@router.post("/seed-demo")
def seed_demo_data(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Tek tıkla zengin demo veri yükle (idempotent)."""
    # 1. Plan kontrolü
    plan = db.query(Plan).filter(Plan.status == "completed").order_by(Plan.created_at.desc()).first()
    if not plan:
        raise HTTPException(
            status_code=400,
            detail="Önce bir plan oluşturup çalıştırmalısın (Plan Yönetimi → '+ Yeni Plan' → Çalıştır). Plan tamamlandıktan sonra tekrar dene.",
        )

    # 2. 3 sales rep
    reps = _ensure_demo_reps(db)

    # 3. Cluster atama
    _assign_clusters(db, reps, plan)

    # 4. Haftalık ziyaretler
    random.seed(42)  # Tutarlı sonuç için
    visits_added, sales_added = _seed_visits(db, reps, plan)

    # 5. Duyurular
    anns_added = _seed_announcements(db, admin)

    # 6. Kampanyalar
    camps_added = _seed_campaigns(db, admin)

    # 7. Görevler
    tasks_added = _seed_tasks(db, admin, reps)

    return {
        "detail": "✓ Demo veri başarıyla yüklendi",
        "plan": plan.name,
        "sales_reps": [
            {
                "email": r.email,
                "name": r.full_name,
                "cluster_index": r.cluster_index,
                "monthly_target": r.monthly_target,
                "password_note": "Şifre: demo123 (sadece ilk oluşturmada — sonra değişmez)",
            }
            for r in reps
        ],
        "summary": {
            "sales_visits_added": visits_added,
            "total_sales_added_tl": sales_added,
            "announcements_added": anns_added,
            "campaigns_added": camps_added,
            "tasks_added": tasks_added,
        },
        "demo_login_hint": "Mobil app'te demo1@sahasatis.com / demo123 ile giriş yapabilirsin",
    }


@router.post("/reset-demo")
def reset_demo_data(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Demo veriyi temizle: demo email'li rep'ler + onların ziyaretleri + demo duyuru/kampanya/görev."""
    deleted_visits = 0
    deleted_reps = 0
    deleted_tasks = 0

    reps = db.query(User).filter(User.email.in_(DEMO_EMAILS)).all()
    rep_ids = [r.id for r in reps]
    if rep_ids:
        deleted_visits = db.query(SalesVisit).filter(SalesVisit.user_id.in_(rep_ids)).delete(synchronize_session=False)
        deleted_tasks = db.query(Task).filter(Task.assigned_to_id.in_(rep_ids)).delete(synchronize_session=False)
        for r in reps:
            db.delete(r)
        deleted_reps = len(reps)

    # Demo duyuru ve kampanyaları sil
    demo_ann_titles = [a[0] for a in DEMO_ANNOUNCEMENTS]
    deleted_anns = db.query(Announcement).filter(Announcement.title.in_(demo_ann_titles)).delete(synchronize_session=False)

    demo_camp_titles = [c[0] for c in DEMO_CAMPAIGNS]
    deleted_camps = db.query(Campaign).filter(Campaign.title.in_(demo_camp_titles)).delete(synchronize_session=False)

    db.commit()
    return {
        "detail": "✓ Demo veri temizlendi",
        "deleted": {
            "sales_reps": deleted_reps,
            "sales_visits": deleted_visits,
            "tasks": deleted_tasks,
            "announcements": deleted_anns,
            "campaigns": deleted_camps,
        },
    }
