from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from typing import List
import json
import asyncio
from datetime import datetime, timedelta

from . import crud, models, schemas
from .database import SessionLocal, engine
from . import email_service

from fastapi.middleware.cors import CORSMiddleware

# This would typically be done with Alembic, but for the initial seed it's here.
# models.Base.metadata.create_all(bind=engine) # We used alembic, so this is not needed.

app = FastAPI()

# CORS Middleware Configuration
# This will allow the frontend (running on a different origin) to make requests to the backend.
origins = [
    "*"
]

print("CORS middleware being added.") # LOG
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _build_smtp_config(settings: models.AppSettings):
    return {
        'server': settings.smtp_server,
        'port': settings.smtp_port,
        'username': settings.smtp_username,
        'password': settings.smtp_password,
        'use_tls': settings.smtp_use_tls
    }


def _parse_recipients(raw_value: str | None) -> List[str]:
    if not raw_value:
        return []
    parsed = json.loads(raw_value)
    if not isinstance(parsed, list):
        raise ValueError("Recipients must be a JSON list")
    recipients = [str(item).strip() for item in parsed if str(item).strip()]
    if not recipients:
        raise ValueError("Recipients list is empty")
    return recipients


async def _run_backup_scheduler():
    while True:
        db = SessionLocal()
        try:
            settings = crud.get_app_settings(db)
            if settings.backup_enabled:
                if not settings.smtp_username or not settings.smtp_password:
                    await asyncio.sleep(60)
                    continue

                try:
                    recipients = _parse_recipients(settings.backup_recipients)
                except (ValueError, json.JSONDecodeError):
                    await asyncio.sleep(60)
                    continue

                interval_hours = max(1, settings.backup_frequency_hours or 24)
                now = datetime.utcnow()
                can_send = (
                    settings.backup_last_sent_at is None or
                    now - settings.backup_last_sent_at >= timedelta(hours=interval_hours)
                )

                if can_send:
                    payload = crud.export_backup_data(db)
                    backup_json = json.dumps(payload, ensure_ascii=False, indent=2)
                    filename = f"backup_gestionale_{now.strftime('%Y%m%d_%H%M%S')}.json"

                    sent = await email_service.send_backup_email(
                        smtp_config=_build_smtp_config(settings),
                        recipients=recipients,
                        subject=f"Backup Gestionale Famiglia - {now.strftime('%d/%m/%Y %H:%M')} UTC",
                        body_text="In allegato il backup JSON del gestionale familiare.",
                        attachment_name=filename,
                        attachment_content=backup_json,
                    )
                    if sent:
                        settings.backup_last_sent_at = now
                        db.commit()
        except Exception as exc:
            print(f"Backup scheduler error: {exc}")
        finally:
            db.close()

        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    db = SessionLocal()
    categories = crud.get_categories(db)
    if not categories:
        initial_categories = [
            "bollette/manutenzione casa",
            "Alimentari/Pets",
            "Abbigliamento",
            "farmacia/veterinario",
            "Scuola",
            "Sport & tempo libero"
        ]
        for name in initial_categories:
            crud.create_category(db, schemas.CategoryCreate(name=name))
    db.close()
    app.state.backup_scheduler_task = asyncio.create_task(_run_backup_scheduler())


@app.on_event("shutdown")
async def shutdown_event():
    task = getattr(app.state, "backup_scheduler_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Benvenuto nel Gestionale Familiare API!"}

@app.post("/api/categories/", response_model=schemas.Category)
def create_category_endpoint(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_category = crud.get_category_by_name(db, name=category.name)
    if db_category:
        raise HTTPException(status_code=400, detail="Category already registered")
    return crud.create_category(db=db, category=category)

@app.get("/api/categories/", response_model=List[schemas.Category])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    categories = crud.get_categories(db, skip=skip, limit=limit)
    return categories

# --- Transaction Endpoints ---

@app.post("/api/transactions/", response_model=schemas.Transaction)
def create_transaction_endpoint(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    print(f"API: POST /api/transactions/ received data: {transaction.dict()}") # LOG
    return crud.create_transaction(db=db, transaction=transaction)

@app.get("/api/transactions/", response_model=List[schemas.Transaction])
def read_transactions(
    year: int, month: int,
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    print(f"API: GET /api/transactions/ called for year={year}, month={month}") # LOG
    transactions = crud.get_transactions(db, year=year, month=month, skip=skip, limit=limit)
    print(f"API: GET /api/transactions/ returning {len(transactions)} transactions.") # LOG
    return transactions

@app.get("/api/transactions/{transaction_id}", response_model=schemas.Transaction)
def read_transaction(transaction_id: int, db: Session = Depends(get_db)):
    print(f"API: GET /api/transactions/{transaction_id} called.") # LOG
    db_transaction = crud.get_transaction(db, transaction_id=transaction_id)
    if db_transaction is None:
        print(f"API: GET /api/transactions/{transaction_id} not found.") # LOG
        raise HTTPException(status_code=404, detail="Transaction not found")
    print(f"API: GET /api/transactions/{transaction_id} returning transaction.") # LOG
    return db_transaction

@app.put("/api/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction_endpoint(transaction_id: int, transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    print(f"API: PUT /api/transactions/{transaction_id} received data: {transaction.dict()}") # LOG
    db_transaction = crud.update_transaction(db, transaction_id=transaction_id, transaction=transaction)
    if db_transaction is None:
        print(f"API: PUT /api/transactions/{transaction_id} not found for update.") # LOG
        raise HTTPException(status_code=404, detail="Transaction not found")
    print(f"API: PUT /api/transactions/{transaction_id} updated transaction.") # LOG
    return db_transaction


@app.post("/api/transactions/copy-month/", response_model=schemas.MonthTemplateCopyResponse)
def copy_transactions_month_endpoint(payload: schemas.MonthTemplateCopyRequest, db: Session = Depends(get_db)):
    for value, label in [
        (payload.source_month, "source_month"),
        (payload.target_month, "target_month"),
    ]:
        if value < 1 or value > 12:
            raise HTTPException(status_code=400, detail=f"{label} must be between 1 and 12")

    if payload.source_year < 2000 or payload.target_year < 2000:
        raise HTTPException(status_code=400, detail="year must be >= 2000")

    if payload.source_year == payload.target_year and payload.source_month == payload.target_month:
        raise HTTPException(status_code=400, detail="source and target month must be different")

    copied = crud.copy_transactions_to_month(
        db=db,
        source_year=payload.source_year,
        source_month=payload.source_month,
        target_year=payload.target_year,
        target_month=payload.target_month,
        transaction_ids=payload.transaction_ids,
    )

    return schemas.MonthTemplateCopyResponse(
        copied_count=len(copied),
        created_ids=[tx.id for tx in copied],
    )

@app.delete("/api/transactions/{transaction_id}")
def delete_transaction_endpoint(transaction_id: int, db: Session = Depends(get_db)):
    print(f"API: DELETE /api/transactions/{transaction_id} called.") # LOG
    db_transaction = crud.delete_transaction(db, transaction_id=transaction_id)
    if db_transaction is None:
        print(f"API: DELETE /api/transactions/{transaction_id} not found for delete.") # LOG
        raise HTTPException(status_code=404, detail="Transaction not found to delete")
    print(f"API: DELETE /api/transactions/{transaction_id} deleted transaction.") # LOG
    return {"message": "Transaction deleted", "id": transaction_id}


# --- Summary Endpoints ---
@app.get("/api/summary/monthly/", response_model=schemas.MonthlySummary)
def get_monthly_summary_endpoint(
    year: int, month: int, db: Session = Depends(get_db)
):
    summary = crud.get_monthly_summary(db, year, month)
    return summary


# --- Large Advance Endpoints ---
@app.post("/api/large-advances/", response_model=schemas.LargeAdvance)
def create_large_advance_endpoint(advance: schemas.LargeAdvanceCreate, db: Session = Depends(get_db)):
    return crud.create_large_advance(db=db, advance=advance)

@app.get("/api/large-advances/", response_model=List[schemas.LargeAdvance])
def read_large_advances(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    advances = crud.get_large_advances(db, skip=skip, limit=limit)
    return advances

@app.get("/api/large-advances/{advance_id}", response_model=schemas.LargeAdvance)
def read_large_advance(advance_id: int, db: Session = Depends(get_db)):
    db_advance = crud.get_large_advance(db, advance_id=advance_id)
    if db_advance is None:
        raise HTTPException(status_code=404, detail="Large advance not found")
    return db_advance

@app.put("/api/large-advances/{advance_id}", response_model=schemas.LargeAdvance)
def update_large_advance_endpoint(advance_id: int, advance: schemas.LargeAdvanceCreate, db: Session = Depends(get_db)):
    db_advance = crud.update_large_advance(db, advance_id=advance_id, advance=advance)
    if db_advance is None:
        raise HTTPException(status_code=404, detail="Large advance not found")
    return db_advance

@app.delete("/api/large-advances/{advance_id}")
def delete_large_advance_endpoint(advance_id: int, db: Session = Depends(get_db)):
    db_advance = crud.delete_large_advance(db, advance_id=advance_id)
    if db_advance is None:
        raise HTTPException(status_code=404, detail="Large advance not found to delete")
    return {"message": "Large advance deleted", "id": advance_id}

@app.get("/api/large-advances/balance/summary")
def get_large_advances_balance(db: Session = Depends(get_db)):
    """Returns the current balance of large advances (who owes whom)"""
    return crud.get_large_advances_balance(db)


# --- Person Endpoints ---
@app.post("/api/persons/", response_model=schemas.Person)
def create_person_endpoint(person: schemas.PersonCreate, db: Session = Depends(get_db)):
    db_person = crud.get_person_by_name(db, name=person.name)
    if db_person:
        raise HTTPException(status_code=400, detail="Person already exists")
    return crud.create_person(db=db, person=person)

@app.get("/api/persons/", response_model=List[schemas.Person])
def read_persons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    persons = crud.get_persons(db, skip=skip, limit=limit)
    return persons

@app.get("/api/persons/{person_id}", response_model=schemas.Person)
def read_person(person_id: int, db: Session = Depends(get_db)):
    db_person = crud.get_person(db, person_id=person_id)
    if db_person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return db_person

@app.put("/api/persons/{person_id}", response_model=schemas.Person)
def update_person_endpoint(person_id: int, person: schemas.PersonUpdate, db: Session = Depends(get_db)):
    db_person = crud.update_person(db, person_id=person_id, person=person)
    if db_person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return db_person

@app.delete("/api/persons/{person_id}", response_model=schemas.Person)
def delete_person_endpoint(person_id: int, db: Session = Depends(get_db)):
    db_person = crud.delete_person(db, person_id=person_id)
    if db_person is None:
        raise HTTPException(status_code=404, detail="Person not found to delete")
    return db_person


# --- AppSettings Endpoints ---
@app.get("/api/settings/", response_model=schemas.AppSettings)
def read_app_settings(db: Session = Depends(get_db)):
    return crud.get_app_settings(db)

@app.put("/api/settings/", response_model=schemas.AppSettings)
def update_app_settings_endpoint(settings: schemas.AppSettingsUpdate, db: Session = Depends(get_db)):
    return crud.update_app_settings(db, settings=settings)


# --- Backup Endpoints ---
@app.get("/api/backup/export/")
def export_backup_endpoint(db: Session = Depends(get_db)):
    payload = crud.export_backup_data(db)
    now = datetime.utcnow()
    filename = f"backup_gestionale_{now.strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.post("/api/backup/restore/")
async def restore_backup_endpoint(
    backup_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        raw_bytes = await backup_file.read()
        payload_json = json.loads(raw_bytes.decode("utf-8"))
        payload = schemas.BackupPayload(**payload_json)
        result = crud.restore_backup_data(db, payload)
        return {"message": "Backup ripristinato con successo", **result}
    except json.JSONDecodeError:
        db.rollback()
        raise HTTPException(status_code=400, detail="File backup non valido (JSON malformato)")
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Errore ripristino backup: {exc}")


@app.post("/api/backup/send-email/")
async def send_backup_email_now_endpoint(db: Session = Depends(get_db)):
    settings = crud.get_app_settings(db)
    if not settings.smtp_username or not settings.smtp_password:
        raise HTTPException(
            status_code=400,
            detail="SMTP configuration incomplete. Please configure email settings first."
        )

    try:
        recipients = _parse_recipients(settings.backup_recipients)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid backup recipients format: {str(e)}"
        )

    payload = crud.export_backup_data(db)
    now = datetime.utcnow()
    backup_json = json.dumps(payload, ensure_ascii=False, indent=2)
    filename = f"backup_gestionale_{now.strftime('%Y%m%d_%H%M%S')}.json"

    success = await email_service.send_backup_email(
        smtp_config=_build_smtp_config(settings),
        recipients=recipients,
        subject=f"Backup Gestionale Famiglia - {now.strftime('%d/%m/%Y %H:%M')} UTC",
        body_text="In allegato il backup JSON del gestionale familiare.",
        attachment_name=filename,
        attachment_content=backup_json,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send backup email. Check SMTP configuration.")

    settings.backup_last_sent_at = now
    db.commit()
    return {"message": "Backup inviato con successo", "recipients": recipients}


# --- Category Update/Delete Endpoints ---
@app.put("/api/categories/{category_id}", response_model=schemas.Category)
def update_category_endpoint(category_id: int, category: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    db_category = crud.update_category(db, category_id=category_id, category=category)
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return db_category

@app.delete("/api/categories/{category_id}", response_model=schemas.Category)
def delete_category_endpoint(category_id: int, db: Session = Depends(get_db)):
    db_category = crud.delete_category(db, category_id=category_id)
    if db_category is None:
        raise HTTPException(status_code=404, detail="Category not found to delete")
    return db_category


# --- Statistics Endpoints ---
@app.get("/api/statistics/period/", response_model=schemas.PeriodStatistics)
def get_period_statistics_endpoint(start_date: str, end_date: str, db: Session = Depends(get_db)):
    """Get statistics for a specific period (YYYY-MM-DD format)"""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    return crud.get_period_statistics(db, start, end)


# --- Email Report Endpoints ---
@app.post("/api/reports/send-email/")
async def send_email_report_endpoint(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """Generate and send email report for a specific period"""

    # Parse dates
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Get statistics
    statistics = crud.get_period_statistics(db, start, end)

    # Get app settings
    settings = crud.get_app_settings(db)

    # Validate SMTP configuration
    if not settings.smtp_username or not settings.smtp_password:
        raise HTTPException(
            status_code=400,
            detail="SMTP configuration incomplete. Please configure email settings first."
        )

    # Parse email recipients
    if not settings.email_recipients:
        raise HTTPException(
            status_code=400,
            detail="No email recipients configured. Please add recipients in settings."
        )

    try:
        recipients = _parse_recipients(settings.email_recipients)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid email recipients format: {str(e)}"
        )

    # Generate HTML report
    html_content = email_service.generate_report_html(statistics, include_charts=True)

    # Prepare SMTP config
    smtp_config = _build_smtp_config(settings)

    # Send email
    subject = f"Report Spese Familiari - {start.strftime('%d/%m/%Y')} - {end.strftime('%d/%m/%Y')}"

    success = await email_service.send_email_report(
        smtp_config=smtp_config,
        recipients=recipients,
        subject=subject,
        html_content=html_content
    )

    if success:
        return {"message": "Email sent successfully", "recipients": recipients}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP configuration.")


@app.post("/api/reports/test-email/")
async def test_email_endpoint(db: Session = Depends(get_db)):
    """Test email configuration by sending a test email"""
    settings = crud.get_app_settings(db)

    # Validate SMTP configuration
    if not settings.smtp_username or not settings.smtp_password:
        raise HTTPException(
            status_code=400,
            detail="SMTP configuration incomplete. Please configure email settings first."
        )

    # Parse email recipients
    if not settings.email_recipients:
        raise HTTPException(
            status_code=400,
            detail="No email recipients configured. Please add recipients in settings."
        )

    try:
        recipients = _parse_recipients(settings.email_recipients)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid email recipients format: {str(e)}"
        )

    # Prepare test email
    smtp_config = _build_smtp_config(settings)

    test_html = """
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #1976d2;">Test Email - Gestionale Famiglia</h2>
        <p>Questa è un'email di test per verificare la configurazione SMTP.</p>
        <p>Se ricevi questa email, la configurazione è corretta!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Email generata automaticamente dal Gestionale Famiglia</p>
    </body>
    </html>
    """

    success = await email_service.send_email_report(
        smtp_config=smtp_config,
        recipients=recipients,
        subject="Test Email - Gestionale Famiglia",
        html_content=test_html
    )

    if success:
        return {"message": "Test email sent successfully", "recipients": recipients}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP configuration.")


@app.get("/api/reports/download/", response_class=HTMLResponse)
async def download_report_endpoint(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db)
):
    """Generate and download HTML report for a specific period"""
    # Parse dates
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Get statistics
    statistics = crud.get_period_statistics(db, start, end)

    # Generate HTML report
    html_content = email_service.generate_report_html(statistics, include_charts=True)

    return HTMLResponse(content=html_content, headers={
        "Content-Disposition": f"attachment; filename=report_{start_date}_{end_date}.html"
    })


# --- Major Expense Endpoints ---
@app.post("/api/major-expenses/", response_model=schemas.MajorExpense)
def create_major_expense_endpoint(major_expense: schemas.MajorExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_major_expense(db=db, major_expense=major_expense)

@app.get("/api/major-expenses/", response_model=List[schemas.MajorExpense])
def read_major_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    major_expenses = crud.get_major_expenses(db, skip=skip, limit=limit)
    return major_expenses

@app.get("/api/major-expenses/year/{year}", response_model=List[schemas.MajorExpense])
def read_major_expenses_by_year(year: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    major_expenses = crud.get_major_expenses_by_year(db, year=year, skip=skip, limit=limit)
    return major_expenses

@app.get("/api/major-expenses/category/{category}", response_model=List[schemas.MajorExpense])
def read_major_expenses_by_category(category: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    major_expenses = crud.get_major_expenses_by_category(db, category=category, skip=skip, limit=limit)
    return major_expenses

@app.get("/api/major-expenses/{major_expense_id}", response_model=schemas.MajorExpense)
def read_major_expense(major_expense_id: int, db: Session = Depends(get_db)):
    db_major_expense = crud.get_major_expense(db, major_expense_id=major_expense_id)
    if db_major_expense is None:
        raise HTTPException(status_code=404, detail="Major expense not found")
    return db_major_expense

@app.put("/api/major-expenses/{major_expense_id}", response_model=schemas.MajorExpense)
def update_major_expense_endpoint(major_expense_id: int, major_expense: schemas.MajorExpenseCreate, db: Session = Depends(get_db)):
    db_major_expense = crud.update_major_expense(db, major_expense_id=major_expense_id, major_expense=major_expense)
    if db_major_expense is None:
        raise HTTPException(status_code=404, detail="Major expense not found")
    return db_major_expense

@app.delete("/api/major-expenses/{major_expense_id}")
def delete_major_expense_endpoint(major_expense_id: int, db: Session = Depends(get_db)):
    db_major_expense = crud.delete_major_expense(db, major_expense_id=major_expense_id)
    if db_major_expense is None:
        raise HTTPException(status_code=404, detail="Major expense not found")
    return {"message": "Major expense deleted", "id": major_expense_id}

@app.get("/api/major-expenses-summary/")
def get_major_expenses_summary(db: Session = Depends(get_db)):
    return crud.get_major_expenses_summary(db)
