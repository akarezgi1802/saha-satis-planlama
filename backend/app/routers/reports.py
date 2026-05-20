from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime
from io import BytesIO

from ..database import get_db
from ..models import Invoice, InvoiceItem, Customer, User
from ..schemas import (
    InvoiceCreate, InvoiceUpdate, InvoiceOut,
    InvoiceItemOut, InvoiceItemCreate,
)
from ..auth import get_current_user, require_admin, SECRET_KEY, ALGORITHM
from jose import jwt

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _get_user_from_token(token: str, db: Session) -> User:
    """Query parameter token'dan kullanici al (download linkleri icin)."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(401, "Gecersiz token")
        return user
    except Exception:
        raise HTTPException(401, "Gecersiz token")


def _next_invoice_no(db: Session) -> str:
    year = date.today().year
    prefix = f"FTR-{year}-"
    last = (
        db.query(Invoice)
        .filter(Invoice.invoice_no.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )
    if last:
        num = int(last.invoice_no.split("-")[-1]) + 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


def _invoice_to_out(inv: Invoice) -> InvoiceOut:
    return InvoiceOut(
        id=inv.id,
        invoice_no=inv.invoice_no,
        user_id=inv.user_id,
        user_name=inv.user.full_name if inv.user else None,
        customer_id=inv.customer_id,
        customer_name=inv.customer.name if inv.customer else None,
        customer_tax_number=inv.customer.tax_number if inv.customer else None,
        customer_tax_office=inv.customer.tax_office if inv.customer else None,
        customer_address=inv.customer.address if inv.customer else None,
        invoice_date=inv.invoice_date,
        subtotal=inv.subtotal,
        tax_rate=inv.tax_rate,
        tax_amount=inv.tax_amount,
        total=inv.total,
        status=inv.status,
        notes=inv.notes,
        items=[InvoiceItemOut.model_validate(it) for it in inv.items],
        created_at=inv.created_at,
    )


# ── Fatura Oluştur ──
@router.post("/invoices", response_model=InvoiceOut)
def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(404, "Müşteri bulunamadı")

    inv = Invoice(
        invoice_no=_next_invoice_no(db),
        user_id=current_user.id,
        customer_id=body.customer_id,
        invoice_date=body.invoice_date or date.today(),
        tax_rate=body.tax_rate,
        notes=body.notes,
        status="draft",
    )

    if body.quick_total is not None and len(body.items) == 0:
        # Basit fiş modu
        inv.subtotal = body.quick_total
        inv.tax_amount = round(body.quick_total * body.tax_rate / 100, 2)
        inv.total = round(body.quick_total + inv.tax_amount, 2)
        db.add(inv)
        db.commit()
        db.refresh(inv)
    else:
        # Detaylı fatura modu
        db.add(inv)
        db.flush()
        subtotal = 0
        for item_data in body.items:
            line_total = round(item_data.quantity * item_data.unit_price, 2)
            item = InvoiceItem(
                invoice_id=inv.id,
                product_name=item_data.product_name,
                quantity=item_data.quantity,
                unit=item_data.unit,
                unit_price=item_data.unit_price,
                line_total=line_total,
            )
            db.add(item)
            subtotal += line_total
        inv.subtotal = subtotal
        inv.tax_amount = round(subtotal * body.tax_rate / 100, 2)
        inv.total = round(subtotal + inv.tax_amount, 2)
        db.commit()
        db.refresh(inv)

    return _invoice_to_out(inv)


# ── Faturaları Listele (filtreli) ──
@router.get("/invoices")
def list_invoices(
    start_date: date | None = None,
    end_date: date | None = None,
    period: str | None = None,
    user_id: int | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Invoice).options(
        joinedload(Invoice.user),
        joinedload(Invoice.customer),
        joinedload(Invoice.items),
    )

    # Tarih filtresi
    if period == "today":
        start_date = date.today()
        end_date = date.today()
    elif period == "week":
        from datetime import timedelta
        start_date = date.today() - timedelta(days=date.today().weekday())
        end_date = date.today()
    elif period == "month":
        start_date = date.today().replace(day=1)
        end_date = date.today()

    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)
    if user_id:
        q = q.filter(Invoice.user_id == user_id)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    if status:
        q = q.filter(Invoice.status == status)

    # ST sadece kendi faturalarını görsün
    if current_user.role != "admin":
        q = q.filter(Invoice.user_id == current_user.id)

    invoices = q.order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).all()
    return [_invoice_to_out(inv) for inv in invoices]


# ── Fatura Detay ──
@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.user), joinedload(Invoice.customer), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Fatura bulunamadı")
    if current_user.role != "admin" and inv.user_id != current_user.id:
        raise HTTPException(403, "Yetkiniz yok")
    return _invoice_to_out(inv)


# ── Fatura Güncelle (durum, notlar, kalemler) ──
@router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.user), joinedload(Invoice.customer), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Fatura bulunamadı")

    if body.status is not None:
        inv.status = body.status
    if body.notes is not None:
        inv.notes = body.notes
    if body.tax_rate is not None:
        inv.tax_rate = body.tax_rate

    if body.quick_total is not None:
        inv.subtotal = body.quick_total
        inv.tax_amount = round(body.quick_total * inv.tax_rate / 100, 2)
        inv.total = round(body.quick_total + inv.tax_amount, 2)

    if body.items is not None:
        # Kalemleri yeniden oluştur
        for old_item in inv.items:
            db.delete(old_item)
        db.flush()
        subtotal = 0
        for item_data in body.items:
            line_total = round(item_data.quantity * item_data.unit_price, 2)
            item = InvoiceItem(
                invoice_id=inv.id,
                product_name=item_data.product_name,
                quantity=item_data.quantity,
                unit=item_data.unit,
                unit_price=item_data.unit_price,
                line_total=line_total,
            )
            db.add(item)
            subtotal += line_total
        inv.subtotal = subtotal
        inv.tax_amount = round(subtotal * inv.tax_rate / 100, 2)
        inv.total = round(subtotal + inv.tax_amount, 2)

    db.commit()
    db.refresh(inv)
    return _invoice_to_out(inv)


# ── Fatura Sil ──
@router.delete("/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Fatura bulunamadı")
    db.delete(inv)
    db.commit()
    return {"ok": True}


# ── Rapor Özeti ──
@router.get("/summary")
def report_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    period: str | None = None,
    user_id: int | None = None,
    customer_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Invoice)

    if period == "today":
        start_date = date.today()
        end_date = date.today()
    elif period == "week":
        from datetime import timedelta
        start_date = date.today() - timedelta(days=date.today().weekday())
        end_date = date.today()
    elif period == "month":
        start_date = date.today().replace(day=1)
        end_date = date.today()

    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)
    if user_id:
        q = q.filter(Invoice.user_id == user_id)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    if current_user.role != "admin":
        q = q.filter(Invoice.user_id == current_user.id)

    invoices = q.all()
    total_revenue = sum(i.total for i in invoices)
    total_tax = sum(i.tax_amount for i in invoices)
    count = len(invoices)
    paid_count = sum(1 for i in invoices if i.status == "paid")
    draft_count = sum(1 for i in invoices if i.status == "draft")
    approved_count = sum(1 for i in invoices if i.status == "approved")

    return {
        "total_invoices": count,
        "total_revenue": round(total_revenue, 2),
        "total_tax": round(total_tax, 2),
        "paid_count": paid_count,
        "draft_count": draft_count,
        "approved_count": approved_count,
    }


# ── Excel Dışa Aktarma ──
@router.get("/export/excel")
def export_excel(
    start_date: date | None = None,
    end_date: date | None = None,
    period: str | None = None,
    user_id: int | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    token: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    if token and not current_user:
        current_user = _get_user_from_token(token, db)
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    # Aynı filtreleri uygula
    q = db.query(Invoice).options(
        joinedload(Invoice.user), joinedload(Invoice.customer), joinedload(Invoice.items)
    )

    if period == "today":
        start_date = date.today()
        end_date = date.today()
    elif period == "week":
        from datetime import timedelta
        start_date = date.today() - timedelta(days=date.today().weekday())
        end_date = date.today()
    elif period == "month":
        start_date = date.today().replace(day=1)
        end_date = date.today()

    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)
    if user_id:
        q = q.filter(Invoice.user_id == user_id)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    if status:
        q = q.filter(Invoice.status == status)
    if current_user.role != "admin":
        q = q.filter(Invoice.user_id == current_user.id)

    invoices = q.order_by(Invoice.invoice_date.desc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Faturalar"

    # Başlık stili
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="6366F1", end_color="6366F1", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )

    headers = ["Fatura No", "Tarih", "Müşteri", "Satış Temsilcisi", "Ara Toplam", "KDV", "Toplam", "Durum", "Notlar"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border

    status_map = {"draft": "Taslak", "approved": "Onaylandı", "paid": "Ödendi", "cancelled": "İptal"}

    for row_idx, inv in enumerate(invoices, 2):
        ws.cell(row=row_idx, column=1, value=inv.invoice_no).border = thin_border
        ws.cell(row=row_idx, column=2, value=inv.invoice_date.strftime("%d.%m.%Y")).border = thin_border
        ws.cell(row=row_idx, column=3, value=inv.customer.name if inv.customer else "").border = thin_border
        ws.cell(row=row_idx, column=4, value=inv.user.full_name if inv.user else "").border = thin_border
        ws.cell(row=row_idx, column=5, value=inv.subtotal).border = thin_border
        ws.cell(row=row_idx, column=5).number_format = '#,##0.00'
        ws.cell(row=row_idx, column=6, value=inv.tax_amount).border = thin_border
        ws.cell(row=row_idx, column=6).number_format = '#,##0.00'
        ws.cell(row=row_idx, column=7, value=inv.total).border = thin_border
        ws.cell(row=row_idx, column=7).number_format = '#,##0.00'
        ws.cell(row=row_idx, column=8, value=status_map.get(inv.status, inv.status)).border = thin_border
        ws.cell(row=row_idx, column=9, value=inv.notes or "").border = thin_border

    # Sütun genişlikleri
    col_widths = [18, 14, 25, 22, 15, 12, 15, 14, 30]
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"faturalar_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Dışa Aktarma ──
@router.get("/export/pdf")
def export_pdf(
    start_date: date | None = None,
    end_date: date | None = None,
    period: str | None = None,
    user_id: int | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    token: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    if token and not current_user:
        current_user = _get_user_from_token(token, db)
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    q = db.query(Invoice).options(
        joinedload(Invoice.user), joinedload(Invoice.customer), joinedload(Invoice.items)
    )

    if period == "today":
        start_date = date.today()
        end_date = date.today()
    elif period == "week":
        from datetime import timedelta
        start_date = date.today() - timedelta(days=date.today().weekday())
        end_date = date.today()
    elif period == "month":
        start_date = date.today().replace(day=1)
        end_date = date.today()

    if start_date:
        q = q.filter(Invoice.invoice_date >= start_date)
    if end_date:
        q = q.filter(Invoice.invoice_date <= end_date)
    if user_id:
        q = q.filter(Invoice.user_id == user_id)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    if status:
        q = q.filter(Invoice.status == status)
    if current_user.role != "admin":
        q = q.filter(Invoice.user_id == current_user.id)

    invoices = q.order_by(Invoice.invoice_date.desc()).all()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=20*mm, bottomMargin=15*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("CustomTitle", parent=styles["Title"], fontSize=16, spaceAfter=10)

    status_map = {"draft": "Taslak", "approved": "Onaylandi", "paid": "Odendi", "cancelled": "Iptal"}

    elements = []
    date_str = ""
    if start_date and end_date:
        date_str = f" ({start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')})"
    elements.append(Paragraph(f"Satis Raporu{date_str}", title_style))
    elements.append(Spacer(1, 5*mm))

    # Özet
    total_rev = sum(i.total for i in invoices)
    total_tax = sum(i.tax_amount for i in invoices)
    summary_data = [
        ["Toplam Fatura", "Toplam Ciro", "Toplam KDV"],
        [str(len(invoices)), f"{total_rev:,.2f} TL", f"{total_tax:,.2f} TL"],
    ]
    summary_table = Table(summary_data, colWidths=[80*mm, 80*mm, 80*mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 8*mm))

    # Detay tablo
    data = [["Fatura No", "Tarih", "Musteri", "Satis Temsilcisi", "Ara Toplam", "KDV", "Toplam", "Durum"]]
    for inv in invoices:
        data.append([
            inv.invoice_no,
            inv.invoice_date.strftime("%d.%m.%Y"),
            (inv.customer.name if inv.customer else "")[:25],
            (inv.user.full_name if inv.user else "")[:20],
            f"{inv.subtotal:,.2f}",
            f"{inv.tax_amount:,.2f}",
            f"{inv.total:,.2f}",
            status_map.get(inv.status, inv.status),
        ])

    col_widths = [35*mm, 25*mm, 55*mm, 40*mm, 28*mm, 22*mm, 28*mm, 22*mm]
    detail_table = Table(data, colWidths=col_widths, repeatRows=1)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(detail_table)

    doc.build(elements)
    buf.seek(0)

    filename = f"rapor_{date.today().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Tek Fatura PDF ──
@router.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(
    invoice_id: int,
    token: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    if token and not current_user:
        current_user = _get_user_from_token(token, db)
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    inv = (
        db.query(Invoice)
        .options(joinedload(Invoice.user), joinedload(Invoice.customer), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Fatura bulunamadi")
    if current_user.role != "admin" and inv.user_id != current_user.id:
        raise HTTPException(403, "Yetkiniz yok")

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20*mm, bottomMargin=15*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvTitle", parent=styles["Title"], fontSize=18, spaceAfter=5)
    normal = styles["Normal"]

    status_map = {"draft": "Taslak", "approved": "Onaylandi", "paid": "Odendi", "cancelled": "Iptal"}

    elements = []
    elements.append(Paragraph(f"FATURA", title_style))
    elements.append(Paragraph(f"No: {inv.invoice_no}", normal))
    elements.append(Paragraph(f"Tarih: {inv.invoice_date.strftime('%d.%m.%Y')}", normal))
    elements.append(Paragraph(f"Durum: {status_map.get(inv.status, inv.status)}", normal))
    elements.append(Spacer(1, 8*mm))

    # Müşteri bilgileri
    cust = inv.customer
    cust_info = f"Musteri: {cust.name}" if cust else "Musteri: -"
    elements.append(Paragraph(cust_info, ParagraphStyle("Bold", parent=normal, fontSize=11, fontName="Helvetica-Bold")))
    if cust and cust.address:
        elements.append(Paragraph(f"Adres: {cust.address}", normal))
    if cust and cust.tax_number:
        elements.append(Paragraph(f"Vergi No: {cust.tax_number} / {cust.tax_office or ''}", normal))
    elements.append(Paragraph(f"Satis Temsilcisi: {inv.user.full_name if inv.user else '-'}", normal))
    elements.append(Spacer(1, 8*mm))

    # Kalemler tablosu
    if inv.items and len(inv.items) > 0:
        data = [["Urun", "Miktar", "Birim", "Birim Fiyat", "Tutar"]]
        for item in inv.items:
            data.append([
                item.product_name,
                f"{item.quantity:g}",
                item.unit or "adet",
                f"{item.unit_price:,.2f} TL",
                f"{item.line_total:,.2f} TL",
            ])
        col_widths = [65*mm, 22*mm, 22*mm, 30*mm, 30*mm]
    else:
        data = [["Aciklama", "Tutar"]]
        data.append(["Toplam Satis", f"{inv.subtotal:,.2f} TL"])
        col_widths = [120*mm, 50*mm]

    items_table = Table(data, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (-2, 1), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 5*mm))

    # Toplamlar
    totals_data = [
        ["Ara Toplam:", f"{inv.subtotal:,.2f} TL"],
        [f"KDV (%{int(inv.tax_rate)}):", f"{inv.tax_amount:,.2f} TL"],
        ["GENEL TOPLAM:", f"{inv.total:,.2f} TL"],
    ]
    totals_table = Table(totals_data, colWidths=[120*mm, 50*mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)

    if inv.notes:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph(f"Notlar: {inv.notes}", normal))

    doc.build(elements)
    buf.seek(0)

    filename = f"{inv.invoice_no}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
