#!/bin/bash
# Render.com deploy build script

set -e

# Frontend build
cd frontend
npm install
REACT_APP_API_URL=/api npm run build
cd ..

# Backend dependencies
cd backend
pip install -r requirements.txt
cd ..
