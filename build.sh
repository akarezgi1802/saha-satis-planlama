#!/bin/bash
set -e

# ── Frontend build (React) ──
# Render'da NODE_VERSION env var'ından Node sürümü alınır
echo "==> Frontend build başlıyor..."
cd frontend
npm install --legacy-peer-deps
REACT_APP_API_URL=/api CI=false npm run build
cd ..
echo "==> Frontend build tamam"

# ── Backend dependencies ──
echo "==> Backend bağımlılıkları yükleniyor..."
cd backend
pip install -r requirements.txt
echo "==> Backend hazır"
