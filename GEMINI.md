# Stato Progetto: Gestionale Famiglia

## Ultimo Aggiornamento
- Data: 28 Febbraio 2026
- Stato: deploy completato in Kubernetes dopo push su `main`.
- Verifica rollout eseguita con successo:
  - `kubectl -n gestionale rollout status deployment/backend --timeout=180s`
  - `kubectl -n gestionale rollout status deployment/frontend --timeout=180s`
- Pod verificati `Running` al termine del deploy (backend/frontend/postgres).

## Cos'è questa applicazione
Gestionale familiare con 3 aree distinte:
1. Spese mensili (Home): contabilità ordinaria mensile.
2. Grossi anticipi: contabilità separata per anticipi straordinari (es. eredità), fuori dal bilancio mensile.
3. Grosse spese familiari: storico di spese straordinarie comuni (non imputate a Marco/Anna).

## Regole di business fondamentali (aggiornate)
- Marco e Anna versano una quota mensile fissa (default 1050 EUR ciascuno).
- Nelle spese Home ogni voce è attribuita a chi ha pagato (`COMUNE`, `MARCO`, `ANNA`).
- In Home interessa la contabilità per mese/anno (non la data puntuale in UI): le nuove voci vengono salvate al giorno `01` del mese selezionato.
- In Home è disponibile un campo `notes` opzionale libero.
- La sezione grossi anticipi è completamente separata dalla contabilità Home.
- Le grosse spese sono familiari/comuni: non si seleziona più la persona in UI.

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
4. Verificare:
   - `kubectl -n gestionale rollout status deployment/backend --timeout=180s`
   - `kubectl -n gestionale rollout status deployment/frontend --timeout=180s`
   - `kubectl -n gestionale get pods`

Nota: i deployment usano tag `:latest`; `kubectl apply` spesso risulta `unchanged`, quindi `rollout restart` è necessario per forzare pull della nuova immagine.

## Modifiche rilasciate il 28 Febbraio 2026
Commit principale: `684bba0` (`main`, già pushato e deployato).

### 1) Home: contabilità per mese/anno + note
- Aggiunto campo `notes` opzionale alle transazioni.
- Form Home senza input data: la data viene impostata automaticamente a `YYYY-MM-01` del mese selezionato.
- Tabella Home aggiornata con colonna note.

### 2) Home: ordinamento e colori categoria coerenti
- Le spese visualizzate sono ordinate per categoria (poi descrizione).
- Colori categoria condivisi tra grafico a torta e tabella (mappa unica frontend).

### 3) Home: copia mese (template)
- Nuovo flusso UI per copiare un mese sorgente su mese destinazione.
- Possibilità di selezionare quali record copiare (checklist).
- Uso previsto: pre-caricare mese successivo con voci ricorrenti (mutuo, bollette, abbonamenti, ecc.).

### 4) Grosse spese: sempre comuni
- Rimossa la selezione persona dalla pagina Grosse Spese.
- Backend `major_expenses` ora forza `COMUNE` internamente.
- Report/Admin aggiornati per non mostrare più la colonna persona nelle grosse spese.

## API/DB aggiornate

### Nuovo endpoint
- `POST /api/transactions/copy-month/`
  - Body:
    - `source_year`
    - `source_month` (1-12)
    - `target_year`
    - `target_month` (1-12)
    - `transaction_ids` (opzionale; se assente copia tutte le voci del mese sorgente)
  - Response:
    - `copied_count`
    - `created_ids`

### Schema transazioni
- `Transaction` ora include `notes` opzionale.

### Major expenses (breaking change API)
- `MajorExpenseCreate` non richiede più `person_id`.
- `MajorExpense` non espone più `person` nel payload API.
- Compatibilità backup: il campo `person` in `major_expenses` è opzionale e defaulta a `COMUNE`.

### Migrazione Alembic nuova
- `backend/alembic/versions/9f3a6c1d4b2e_add_notes_to_transactions.py`
- Aggiunge colonna `transactions.notes`.

## File principali toccati
- Backend:
  - `backend/app/models.py`
  - `backend/app/schemas.py`
  - `backend/app/crud.py`
  - `backend/app/main.py`
  - `backend/app/email_service.py`
  - `backend/alembic/versions/9f3a6c1d4b2e_add_notes_to_transactions.py`
- Frontend:
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/components/TransactionForm.tsx`
  - `frontend/src/components/TransactionList.tsx`
  - `frontend/src/components/CategoryPieChart.tsx`
  - `frontend/src/pages/MajorExpensesPage.tsx`
  - `frontend/src/pages/AdminPage.tsx`
  - `frontend/src/utils/categoryColors.ts`

## Verifiche effettuate
- Backend compilato localmente con successo:
  - `python3 -m compileall backend/app`
- Build frontend non eseguita localmente in sessione (ambiente locale senza `vite` installato), ma build CI GitHub completata e deploy effettuato.

## Note operative per la prossima AI
- Non reintrodurre logica persona nelle grosse spese: devono restare familiari/comuni.
- In Home mantenere approccio mese/anno (date puntuali non richieste in UI).
- Prima di eventuali fix, verificare che la migrazione Alembic `9f3a6c1d4b2e` sia presente/applicata nell'ambiente target.
- Se il deploy sembra non aggiornarsi, ricordare sempre `rollout restart`.
- Prima di parlare di build/deploy: fare prima `git push origin main` (la build immagini parte da GitHub Actions sul push; non dipende dalla build frontend locale).
- I secret Kubernetes reali sono locali e fuori git (`k8s/**/secret.yaml` ignorati).

## Riferimenti rapidi
- Endpoint pubblico frontend: `https://soldi.jezoo.it/`
- Repo locale: `/root/gestionale-famiglia`
- Namespace Kubernetes: `gestionale`
