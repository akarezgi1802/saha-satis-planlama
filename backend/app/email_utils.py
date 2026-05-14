import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_NAME = os.getenv("FROM_NAME", "Saha Satış Planlama")


def is_smtp_configured():
    return bool(SMTP_USER and SMTP_PASS)


def send_reset_email(to_email: str, reset_link: str):
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL] SMTP yapılandırılmadı. Reset link: {reset_link}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Şifre Sıfırlama — Saha Satış Planlama"
    msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email

    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:20px;font-weight:900;line-height:48px">SS</div>
        <h2 style="margin:12px 0 4px;color:#1e293b">Şifre Sıfırlama</h2>
        <p style="color:#64748b;font-size:14px;margin:0">Saha Satış Planlama Sistemi</p>
      </div>
      <p style="color:#334155;font-size:14px;line-height:1.6">
        Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bu bağlantı 30 dakika geçerlidir.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="{reset_link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px">
          Şifremi Sıfırla
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px">Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL] Gönderim hatası: {e}")
        print(f"[EMAIL] Reset link: {reset_link}")
        return False
