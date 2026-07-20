@echo off
title SmartFill - Iniciador
echo ==========================================
echo Iniciando Sistema SmartFill
echo ==========================================

echo [1/2] Iniciando Backend (Flask)...
start "SmartFill Backend" cmd /c "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (echo Advertencia: No se encontro el entorno virtual venv) && python run.py"

echo [2/2] Iniciando Frontend (React/Vite)...
start "SmartFill Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ==========================================
echo SmartFill se esta ejecutando en nuevas ventanas.
echo - El servidor Backend (API) se esta ejecutando.
echo - El Frontend estara disponible pronto en http://localhost:5173
echo ==========================================
echo.
pause
