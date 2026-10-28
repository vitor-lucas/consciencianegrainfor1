@echo off
setlocal
cd /d "%~dp0"
echo.
echo ===========================================
echo     ORI - MUSEU AFROTURISTICO 3D
echo ===========================================
echo.
where py >nul 2>nul
if not errorlevel 1 (
  start "ORI - Servidor local" /D "%~dp0" cmd /k "py -m http.server 8000"
  goto abrir
)
where python >nul 2>nul
if not errorlevel 1 (
  start "ORI - Servidor local" /D "%~dp0" cmd /k "python -m http.server 8000"
  goto abrir
)
echo Python nao foi encontrado neste computador.
echo Abra a pasta no VS Code e use a extensao Live Server.
echo Veja LEIA-ME-PRIMEIRO.txt para as instrucoes.
pause
exit /b 1
:abrir
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000"
echo O museu foi aberto no navegador.
echo Mantenha a janela do servidor aberta durante a visita.
echo Para encerrar, feche a janela do servidor.
exit /b 0
