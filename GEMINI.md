# Stato Progetto: Gestionale Famiglia

## 📅 Ultimo Aggiornamento: 27 Febbraio 2026 - 09:45 UTC

## ✅ STATO ATTUALE: FULMENTE FUNZIONANTE

**Tutti i servizi sono in esecuzione e operativi:**

```
NAME                        READY   STATUS    RESTARTS   AGE
backend-9ffb566cb-nshlf     1/1     Running   0          ~7 min
frontend-7f75889d7-jqnf4    1/1     Running   0          ~7 min
postgres-589467977c-zfj6f   1/1     Running   0          ~1 min
```

### Servizi Disponibili
- **Frontend**: https://soldi.jezoo.it/ (via Nginx Proxy Manager)
- **Backend API**: http://CLUSTER-IP:8000 (interno, port-forward: 8000)
- **PostgreSQL**: postgres:5432 (interno)

---

## ✅ Problemi Risolti (27 Febbraio 2026)

### 1. PostgreSQL CrashLoopBackOff Cronico
- **Problema**: PostgreSQL rimase in `CrashLoopBackOff` con errori di checkpoint record invalido
- **Root Cause**: 
  1. Immagine custom non disponibile su GHCR (401 Unauthorized)
  2. Volume Longhorn conteneva `lost+found` che PostgreSQL rifiuta
- **Soluzione**: 
  1. Cancellato namespace e PVC per reset completo
  2. Usato `postgres:16-alpine` (ufficiale, pubblica)
  3. Impostato `PGDATA=/var/lib/postgresql/data/pgdata` (subdirectory)

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
