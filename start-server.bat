@echo off
echo ==========================================
echo   SMILE - Smart Mobile Inclusive Learning
echo   Starting Local Server...
echo ==========================================
echo.
echo Server berjalan di: http://localhost:5500
echo Buka link di atas di browser Anda!
echo.
echo Tekan Ctrl+C untuk menghentikan server
echo ==========================================
echo.
python -m http.server 5500
