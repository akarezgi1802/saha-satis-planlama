import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./saha_satis.db"
)

# SQLite için check_same_thread; PostgreSQL (Neon) için TCP keepalive —
# uzun süren çözümlerde (CBC dakikalarca sürerken DB boşta kalır) Neon'un
# bağlantıyı düşürmesini önler, böylece "PendingRollbackError" yaşanmaz.
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {
        "keepalives": 1,
        "keepalives_idle": 30,      # 30 sn boştan sonra keepalive paketi gönder
        "keepalives_interval": 10,  # yanıt yoksa 10 sn'de bir tekrar
        "keepalives_count": 5,
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,   # bağlantıyı kullanmadan önce test et; kopmuşsa yenile
    pool_recycle=280,     # bağlantıları 280 sn'de bir tazele
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
