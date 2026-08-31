@echo off
title VenteApp - Serveur
cd /d "%~dp0"

:loop
echo [%date% %time%] Demarrage du serveur VenteApp...
python run.py

echo.
echo [%date% %time%] Le serveur s'est arrete ou a plante. Redemarrage dans 5 secondes... (Ctrl+C pour annuler)
timeout /t 5 /nobreak
goto loop
