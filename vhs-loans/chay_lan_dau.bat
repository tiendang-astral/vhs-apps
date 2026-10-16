@echo off
chcp 65001 >nul
cd /d %~dp0
REM === LAN DAU: sua 2 mat khau duoi day, chay xong XOA 2 dong "set" nay ===
set ADMIN_PASSWORD=DOI_MAT_KHAU_ADMIN
set KETOAN_PASSWORD=DOI_MAT_KHAU_KETOANBANK
if not exist venv python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
waitress-serve --listen=0.0.0.0:8000 app:app
