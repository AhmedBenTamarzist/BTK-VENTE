schtasks /Create /TN "VenteApp Serveur" /TR "\"C:\VenteApp\backend\start_server.bat\"" /SC ONLOGON /RL HIGHEST /F



PS C:\> schtasks /Create /TN "VenteApp Serveur" /TR "\"C:\VenteApp\backend\start_server.bat\"" /SC ONLOGON /RL HIGHEST /F
ERROR: Invalid argument/option - 'C:\VenteApp\backend\start_server.bat\'.
Type "SCHTASKS /CREATE /?" for usage.
