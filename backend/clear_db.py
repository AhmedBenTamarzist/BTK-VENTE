import sqlite3

conn = sqlite3.connect('quincaillerie.db')
cur = conn.cursor()
cur.execute("PRAGMA foreign_keys = OFF")

# List all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

# Tables to CLEAR (all transactional data)
to_clear = [
    'lignes_achat',
    'achats',
    'lignes_document',
    'documents',
    'retours',
    'lignes_retour',
    'reglements_clients',
    'reglements_fournisseur',
    'facturations',
    'lignes_facturation',
    'logs_systeme',
    'relances',
    'historique_prix_vente',
    'articles',
    'fournisseurs',
]

for t in to_clear:
    if t in tables:
        cur.execute(f"DELETE FROM {t}")
        print(f"Cleared: {t}")

# Clear clients except "Client Passage" (nom='Client Passage' or type_client='passage')
cur.execute("DELETE FROM clients WHERE nom != 'Client Passage'")
print("Cleared clients (kept Client Passage)")

# Reset article stock sequences (sqlite_sequence)

cur.execute("PRAGMA foreign_keys = ON")
conn.commit()
conn.close()
print("\nBase de donnees videe avec succes!")
print("Conserves: utilisateurs, entreprise, Client Passage")
