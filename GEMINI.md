# Stato Progetto: Gestionale Famiglia

## 📅 Ultimo Aggiornamento: 26 Febbraio 2026
L'applicazione è completamente funzionante su Kubernetes.

## ✅ Problemi Risolti

### 1. PostgreSQL CrashLoopBackOff
- **Causa**: Directory di mount non vuota (`lost+found`).
- **Soluzione**: Aggiunta variabile `PGDATA` nel deployment postgres.

### 2. Errore Migrazioni Alembic
- **Causa**: Tipo dato errato (`1` invece di `TRUE`) in una colonna Boolean.
- **Soluzione**: Corretto file di migrazione e rieseguita manualmente nel pod.

### 3. Mixed Content Error (HTTPS -> HTTP)
- **Causa**: Redirect HTTP generato dal backend per mancanza di slash finale.
- **Soluzione**: 
    - Aggiunto slash finale nel codice Axios (`HomePage.tsx`).
    - Patchato Nginx frontend con `proxy_set_header X-Forwarded-Proto $scheme` e `proxy_redirect`.

### 4. Configurazione SMTP e Destinatari
- **Causa**: Il campo `email_recipients` conteneva una stringa semplice invece di una lista JSON (`["email@example.com"]`).
- **Soluzione**: Aggiornato il database con il formato lista JSON corretto. **Test email inviato con successo!**

## 🚀 Obiettivi per Domani (27 Febbraio)

- [ ] **GitHub Alignment**: Eseguire il commit di tutte le correzioni fatte localmente (Alembic, Frontend, Nginx config).
- [ ] **CI/CD e Immagini GHCR**: Ricostruire le immagini di Backend e Frontend tramite GitHub Actions o localmente per includere le patch.
- [ ] **Cleanup Kubernetes**: Una volta aggiornate le immagini GHCR, rimuovere i patch manuali dai deployment e tornare alla configurazione standard dei manifest.

## 📝 Note Tecniche
- **Endpoint**: `https://soldi.jezoo.it/`
- **Repo**: `/root/gestionale-famiglia`
