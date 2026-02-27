# Usa l'immagine ufficiale di PostgreSQL come base
FROM postgres:16-alpine

# Copia lo script di entrypoint personalizzato nella directory dell'immagine
COPY my-pg-entrypoint.sh /usr/local/bin/my-pg-entrypoint.sh

# Rendi lo script eseguibile
RUN chmod +x /usr/local/bin/my-pg-entrypoint.sh

# Imposta lo script personalizzato come entrypoint
ENTRYPOINT ["/usr/local/bin/my-pg-entrypoint.sh"]

# Comando di default (può essere sovrascritto da Dockerfile CMD o deployment)
CMD ["postgres"]
