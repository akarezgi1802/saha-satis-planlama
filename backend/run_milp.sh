#!/bin/bash
# Plan 10 MILP cozucu — caffeinate ile uyku-kesintisiz, nohup ile terminal-bagimsiz
cd /Users/ezgiakar/Desktop/saha-satis-planlama/backend

export DATABASE_URL="postgresql://neondb_owner:npg_OgpXnhek8Pu1@ep-shy-salad-alaaaj7c-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export CLUSTER_SOLVER=milp

caffeinate -i nohup ./venv/bin/python solve_local.py 10 > solve_milp.log 2>&1 < /dev/null &
PID=$!
disown $PID 2>/dev/null
echo ""
echo "✓ MILP basladi"
echo "  PID: $PID"
echo "  Log dosyasi: /Users/ezgiakar/Desktop/saha-satis-planlama/backend/solve_milp.log"
echo ""
echo "Bu terminali simdi kapatabilirsin — surec calismaya devam edecek."
echo ""
