@echo off
title VenteApp - Logs du serveur
cd /d "%~dp0"

if not exist "LOG_SERVEUR.txt" (
  echo.
  echo  Fichier LOG_SERVEUR.txt introuvable.
  echo  Demarrez d'abord backend\start_server.bat au moins une fois.
  echo.
  pause
  exit /b 1
)

echo.
echo  ===== LOG SERVEUR VenteApp (100 dernieres lignes) =====
echo  Fichier : %~dp0LOG_SERVEUR.txt
echo.
powershell -NoProfile -Command "Get-Content -Path '%~dp0LOG_SERVEUR.txt' -Tail 100 -Encoding UTF8"
echo.
echo  ===== Fin =====
echo.
echo  Pour envoyer a Amin : copier ce texte ou envoyer le fichier LOG_SERVEUR.txt
echo.
pause
