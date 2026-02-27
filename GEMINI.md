# Stato Progetto: Gestionale Famiglia

## Ultimo Aggiornamento
- Data: 27 Febbraio 2026
- Stato: operativo in Kubernetes, backend/frontend/postgres `Running`.

## Cos'è questa applicazione
Gestionale familiare con 3 aree distinte:
1. Spese mensili (Home): contabilità principale del mese.
2. Grossi anticipi: contabilità separata per anticipi straordinari (es. eredità), fuori dal bilancio mensile.
3. Grosse spese/investimenti: storico/nota nel tempo, non contabilizzato nei saldi mensili.

## Regole di business fondamentali
- Marco e Anna versano una quota mensile fissa (default 1050 EUR ciascuno).
- Nelle spese Home ogni voce è attribuita a chi ha pagato (`COMUNE`, `MARCO`, `ANNA`).
- Il riepilogo mensile calcola automaticamente quanto ciascuno dovrà versare il mese successivo al netto degli anticipi mensili.
- La sezione grossi anticipi è completamente separata dalla contabilità Home.
- La sezione grosse spese/investimenti è solo tracciamento storico.

## Architettura tecnica
- Frontend: React + Vite + MUI (`frontend/`)
- Backend: FastAPI + SQLAlchemy + Alembic (`backend/`)
- DB: PostgreSQL (`postgres:16-alpine`)
- Deploy: manifest Kubernetes (`k8s/`) applicati da `install.sh`
- CI/CD immagini: GitHub Actions su push `main` (`.github/workflows/build.yml`)

## Deploy operativo (importante)
Flusso corretto dopo ogni merge su `main`:
1. Attendere build GHCR completata.
2. Eseguire `bash install.sh`.
3. Eseguire `kubectl -n gestionale rollout restart deployment/backend deployment/frontend`.
4. Verificare `kubectl -n gestionale get pods`.

Nota: i deployment usano tag `:latest`; `kubectl apply` spesso risulta `unchanged`, quindi il `rollout restart` è necessario per pullare davvero le nuove immagini.

## Funzionalità implementate recentemente
### Reportistica
- Report periodo con:
  - riepilogo spese periodo selezionato,
  - riepilogo mese corrente Home (entrate/spese/saldo + contributi netti),
  - recap separato grossi anticipi,
  - segnalazione sintetica grosse spese/investimenti nel periodo.
- Invio report via email e download HTML.

### Backup
- Nuova sezione Admin "Backup".
- Export backup completo delle 3 sezioni in JSON human-readable.
- Restore backup da file JSON con sovrascrittura completa delle entry esistenti.
- Invio backup via email on-demand.
- Invio backup schedulato ricorsivo con:
  - destinatari dedicati backup (separati dai destinatari report),
  - frequenza in ore configurabile,
  - tracking `backup_last_sent_at`.

## Problemi risolti recentemente (ordine cronologico sintetico)
1. Report semanticamente errato:
- Corretto allineamento con regole di business (separazione Home vs grossi anticipi vs grosse spese).

2. Bug delete UI apparentemente "non aggiorna":
- Sintomo: dopo elimina, la riga sembrava restare finché non cambiavi pagina/sezione.
- Root cause reale: endpoint DELETE restituivano il modello appena cancellato, introducendo comportamento instabile lato frontend.
- Fix definitivo: endpoint DELETE ora rispondono con payload semplice/stabile (`message`, `id`), evitando serializzazione dell'oggetto eliminato.

3. PostgreSQL CrashLoopBackOff storico:
- Risolto passando a immagine ufficiale `postgres:16-alpine` e impostando `PGDATA` su sottodirectory.

4. SMTP destinatari report non validi:
- Corretto formato atteso: JSON array string (`["mail1@example.com"]`).

## API/DB aggiunte di recente
- Nuovi endpoint backup:
  - `GET /api/backup/export/`
  - `POST /api/backup/restore/`
  - `POST /api/backup/send-email/`
- AppSettings estese con campi backup:
  - `backup_enabled`
  - `backup_frequency_hours`
  - `backup_recipients`
  - `backup_last_sent_at`
- Migrazione Alembic:
  - `backend/alembic/versions/77b8c9f1e2aa_add_backup_settings_columns.py`

## Note operative per la prossima AI
- Non cambiare la semantica contabile delle 3 sezioni: è requisito chiave.
- Prima di debug UI delete, verificare sempre status/response delle DELETE API.
- Se il deploy sembra non aggiornarsi, ricordare il `rollout restart`.
- I secret Kubernetes reali sono locali e fuori git (`k8s/**/secret.yaml` ignorati).

## Riferimenti rapidi
- Endpoint pubblico frontend: `https://soldi.jezoo.it/`
- Repo locale: `/root/gestionale-famiglia`
- Namespace Kubernetes: `gestionale`
