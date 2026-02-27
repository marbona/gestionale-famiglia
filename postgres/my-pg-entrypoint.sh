#!/bin/bash
# Script di entrypoint personalizzato per PostgreSQL

# Il percorso della directory dei dati di PostgreSQL
PGDATA_DIR="/var/lib/postgresql/data"

# Verifica se la directory PGDATA esiste e contiene la sottodirectory 'lost+found'
if [ -d "$PGDATA_DIR" ] && [ -d "$PGDATA_DIR/lost+found" ]; then
  echo "Rilevata sottodirectory 'lost+found' in $PGDATA_DIR. Rimozione in corso..."
  rm -rf "$PGDATA_DIR/lost+found"
  echo "Rimozione completata."
else
  echo "Nessuna sottodirectory 'lost+found' trovata in $PGDATA_DIR o la directory non esiste ancora. Procedo normalmente."
fi

# Esegui lo script di entrypoint originale di PostgreSQL
# L'originale si trova solitamente in /usr/local/bin/docker-entrypoint.sh
# Usiamo exec per sostituire questo script con il processo originale
exec docker-entrypoint.sh "$@"
