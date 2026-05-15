from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOut, TokenOut, UserCreateByAdmin, UserUpdateByAdmin
from ..auth import hash_password, verify_password, create_access_token, get_current_user, require_admin, create_reset_token, verify_reset_token
from ..email_utils import send_reset_email, is_smtp_configured

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Kayıt kapalı. Yöneticinizle iletişime geçin.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        company=body.company,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap devre dışı")

    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(body: dict, db: Session = Depends(get_db)):
    email = body.get("email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email gerekli")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        if is_smtp_configured():
            return {"detail": "E-posta adresinize sıfırlama bağlantısı gönderildi"}
        return {"detail": "Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı"}

    token = create_reset_token(email)
    frontend_url = body.get("frontend_url", "http://localhost:3000")
    reset_link = f"{frontend_url}/reset-password?token={token}"

    if not is_smtp_configured():
        return {"reset_link": reset_link, "detail": "SMTP yapılandırılmadı. Sıfırlama bağlantısı aşağıda gösterildi."}

    sent = send_reset_email(email, reset_link)
    if not sent:
        return {"reset_link": reset_link, "detail": "E-posta gönderilemedi. Sıfırlama bağlantısı aşağıda gösterildi."}
    return {"detail": "E-posta adresinize sıfırlama bağlantısı gönderildi"}


@router.post("/reset-password")
def reset_password(body: dict, db: Session = Depends(get_db)):
    token = body.get("token", "")
    new_password = body.get("new_password", "")
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token ve yeni şifre gerekli")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalı")

    email = verify_reset_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş bağlantı")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı")

    user.hashed_password = hash_password(new_password)
    db.commit()
    return {"detail": "Şifreniz başarıyla değiştirildi"}


# ─── Admin: kullanıcı yönetimi ──────────────

@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserOut)
def create_user(
    body: UserCreateByAdmin,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    if body.role not in ("admin", "sales_rep"):
        raise HTTPException(status_code=400, detail="Geçersiz rol")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        company=body.company,
        role=body.role,
        cluster_index=body.cluster_index,
        monthly_target=body.monthly_target or 0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdateByAdmin,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    if body.email is not None and body.email != user.email:
        if db.query(User).filter(User.email == body.email, User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Bu email zaten kullanılıyor")
        user.email = body.email
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.company is not None:
        user.company = body.company
    if body.role is not None:
        if body.role not in ("admin", "sales_rep"):
            raise HTTPException(status_code=400, detail="Geçersiz rol")
        user.role = body.role
    if body.cluster_index is not None:
        user.cluster_index = body.cluster_index
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None and body.password.strip():
        user.hashed_password = hash_password(body.password)
    if body.monthly_target is not None:
        user.monthly_target = body.monthly_target

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    db.delete(user)
    db.commit()
    return {"detail": "Kullanıcı silindi"}


# ─── Profil yönetimi (tüm kullanıcılar) ──────

@router.put("/profile", response_model=UserOut)
def update_profile(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if "full_name" in body and body["full_name"]:
        user.full_name = body["full_name"]
    if "email" in body and body["email"] and body["email"] != user.email:
        if db.query(User).filter(User.email == body["email"], User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Bu email zaten kullanılıyor")
        user.email = body["email"]
    if "company" in body:
        user.company = body["company"]
    db.commit()
    db.refresh(user)
    return user


@router.put("/password")
def change_password(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.get("current_password", ""), user.hashed_password):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
    new_pw = body.get("new_password", "")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    user.hashed_password = hash_password(new_pw)
    db.commit()
    return {"detail": "Şifre değiştirildi"}
