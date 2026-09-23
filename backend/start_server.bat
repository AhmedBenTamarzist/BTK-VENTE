@echo off
title VenteApp - Serveur
cd /d "%~dp0"

set "LOG_FILE=%~dp0..\LOG_SERVEUR.txt"

:loop
echo.
echo [%date% %time%] Demarrage du serveur VenteApp...
echo. >> "%LOG_FILE%"
echo ================================================== >> "%LOG_FILE%"
echo [%date% %time%] Demarrage du serveur VenteApp... >> "%LOG_FILE%"

python run.py >> "%LOG_FILE%" 2>&1
set EXIT_CODE=%ERRORLEVEL%

echo [%date% %time%] Arret du serveur (code erreur: %EXIT_CODE%) >> "%LOG_FILE%"
echo.
echo [%date% %time%] Le serveur s'est arrete (code: %EXIT_CODE%).
echo    LOG : %LOG_FILE%
echo    (double-clic sur VOIR_LOGS.bat a la racine du dossier VenteApp)
echo.
echo Redemarrage dans 5 secondes... (Ctrl+C pour annuler)
timeout /t 5 /nobreak
goto loop
