1. Pare-feu (pour que le PC comptoir puisse joindre le serveur)
Toujours en PowerShell admin :


New-NetFirewallRule -DisplayName "VenteApp" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
2. Trouver l'IP du PC serveur

ipconfig
Cherche la ligne IPv4 (généralement sous "Carte Ethernet" ou "Wi-Fi"), du genre 192.168.1.XX. C'est cette adresse que le PC comptoir utilisera : http://192.168.1.XX:8000.

Envoie-moi le résultat des deux (ou juste dis-moi si le pare-feu passe bien, et donne-moi l'IP trouvée).




DEBOT_API_URL=https://gdstock.ddns.net/api
DEBOT_API_KEY=KFX4PJFUEd2CtBuk-Q6M8a9Gy8LG5s9aWD4B6p-PJvI
