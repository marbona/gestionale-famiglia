from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from datetime import date, datetime
from typing import Any, Dict
from . import models, schemas


def _get_or_create_comune_person(db: Session) -> models.Person:
    comune = get_person_by_name(db, "COMUNE")
    if comune:
        return comune

    comune = models.Person(name="COMUNE")
    db.add(comune)
    db.flush()
    return comune


def _iter_months(start_date: date, end_date: date):
    year = start_date.year
    month = start_date.month
    end_year = end_date.year
    end_month = end_date.month

    while (year, month) <= (end_year, end_month):
        yield year, month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1

# --- Category CRUD ---
def get_category(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_category_by_name(db: Session, name: str):
    return db.query(models.Category).filter(models.Category.name == name).first()

def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Category).offset(skip).limit(limit).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(name=category.name)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# --- Transaction CRUD ---

def get_transaction(db: Session, transaction_id: int):
    print(f"CRUD: get_transaction called for ID: {transaction_id}") # LOG
    return db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()

def get_transactions(db: Session, year: int, month: int, skip: int = 0, limit: int = 100):
    print(f"CRUD: get_transactions called for Year: {year}, Month: {month}") # LOG
    query = db.query(models.Transaction).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    )
    return query.order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()

def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    print(f"CRUD: create_transaction called with data: {transaction.dict()}") # LOG
    db_transaction = models.Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    print(f"CRUD: create_transaction created ID: {db_transaction.id}") # LOG
    return db_transaction

def update_transaction(db: Session, transaction_id: int, transaction: schemas.TransactionCreate):
    print(f"CRUD: update_transaction called for ID: {transaction_id} with data: {transaction.dict()}") # LOG
    db_transaction = get_transaction(db, transaction_id)
    if db_transaction:
        for key, value in transaction.dict().items():
            setattr(db_transaction, key, value)
        db.commit()
        db.refresh(db_transaction)
        print(f"CRUD: update_transaction updated ID: {db_transaction.id}") # LOG
    else:
        print(f"CRUD: update_transaction failed, ID {transaction_id} not found.") # LOG
    return db_transaction

def delete_transaction(db: Session, transaction_id: int):
    print(f"CRUD: delete_transaction called for ID: {transaction_id}") # LOG
    db_transaction = get_transaction(db, transaction_id)
    if db_transaction:
        db.delete(db_transaction)
        db.commit()
        print(f"CRUD: delete_transaction deleted ID: {transaction_id}") # LOG
    else:
        print(f"CRUD: delete_transaction failed, ID {transaction_id} not found.") # LOG
    return db_transaction

# --- Summary CRUD ---
def get_monthly_summary(db: Session, year: int, month: int):
    # Get app settings
    settings = get_app_settings(db)

    # Calculate total expenses for the month
    total_expenses_query = db.query(func.sum(models.Transaction.amount)).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    )
    total_expenses = total_expenses_query.scalar() or 0.0

    # Calculate expenses by category
    expenses_by_category_query = db.query(
        models.Category.name,
        func.sum(models.Transaction.amount)
    ).join(models.Transaction).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    ).group_by(models.Category.name)

    expenses_by_category_raw = expenses_by_category_query.all()
    expenses_by_category = {name: amount for name, amount in expenses_by_category_raw}

    # Calculate each person's contributions for the month
    person_contributions = {}
    persons = get_persons(db)

    for person in persons:
        paid_this_month = db.query(func.sum(models.Transaction.amount)).filter(
            extract('year', models.Transaction.date) == year,
            extract('month', models.Transaction.date) == month,
            models.Transaction.person_id == person.id
        ).scalar() or 0.0

        # Skip "COMUNE" for contribution calculations
        if person.name != "COMUNE":
            needs_to_pay = settings.monthly_contribution_per_person - paid_this_month
            person_contributions[person.name] = {
                "paid": paid_this_month,
                "needs_to_pay": needs_to_pay
            }

    effective_income, calculated_income, is_overridden = get_effective_monthly_income(db, year, month)
    
    # Get account balance and calculate remaining
    balance_config = get_monthly_account_balance_config(db, year, month)

    return schemas.MonthlySummary(
        year=year,
        month=month,
        calculated_income=calculated_income,
        total_income=effective_income,
        is_income_overridden=is_overridden,
        total_expenses=total_expenses,
        balance=effective_income - total_expenses,
        expenses_by_category=expenses_by_category,
        person_contributions=person_contributions,
        account_balance=balance_config.account_balance,
        account_remaining=balance_config.account_remaining,
    )

def get_yearly_summary(db: Session, year: int):
    monthly_points: list[schemas.YearlySummaryPoint] = []
    total_income = 0.0
    total_expenses = 0.0
    total_utilities_expenses = 0.0

    for month in range(1, 13):
        month_income, _, _ = get_effective_monthly_income(db, year, month)
        month_expenses = db.query(func.sum(models.Transaction.amount)).filter(
            extract('year', models.Transaction.date) == year,
            extract('month', models.Transaction.date) == month
        ).scalar() or 0.0

        utilities_expenses = db.query(func.sum(models.Transaction.amount)).join(models.Category).filter(
            extract('year', models.Transaction.date) == year,
            extract('month', models.Transaction.date) == month,
            models.Category.name.ilike('%bollette%')
        ).scalar() or 0.0

        month_balance = float(month_income - month_expenses)

        monthly_points.append(
            schemas.YearlySummaryPoint(
                year=year,
                month=month,
                label=f"{month:02d}/{year}",
                total_income=float(month_income),
                total_expenses=float(month_expenses),
                balance=month_balance,
                utilities_expenses=float(utilities_expenses),
            )
        )

        total_income += float(month_income)
        total_expenses += float(month_expenses)
        total_utilities_expenses += float(utilities_expenses)

    return schemas.YearlySummary(
        year=year,
        months=monthly_points,
        total_income=total_income,
        total_expenses=total_expenses,
        total_balance=total_income - total_expenses,
        total_utilities_expenses=total_utilities_expenses,
    )

# --- Large Advance CRUD ---

def get_large_advance(db: Session, advance_id: int):
    return db.query(models.LargeAdvance).filter(models.LargeAdvance.id == advance_id).first()

def get_large_advances(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.LargeAdvance).order_by(models.LargeAdvance.date.desc()).offset(skip).limit(limit).all()

def create_large_advance(db: Session, advance: schemas.LargeAdvanceCreate):
    db_advance = models.LargeAdvance(**advance.dict())
    db.add(db_advance)
    db.commit()
    db.refresh(db_advance)
    return db_advance

def update_large_advance(db: Session, advance_id: int, advance: schemas.LargeAdvanceCreate):
    db_advance = get_large_advance(db, advance_id)
    if db_advance:
        for key, value in advance.dict().items():
            setattr(db_advance, key, value)
        db.commit()
        db.refresh(db_advance)
    return db_advance

def delete_large_advance(db: Session, advance_id: int):
    db_advance = get_large_advance(db, advance_id)
    if db_advance:
        db.delete(db_advance)
        db.commit()
    return db_advance

def get_large_advances_balance(db: Session):
    """Calculate the balance of large advances between Marco and Anna
    Logic: Each person must match the other's contributions 1:1.
    If Anna puts 1000€, Marco must also put 1000€ to be even."""
    # Get person IDs
    marco = db.query(models.Person).filter(models.Person.name == "MARCO").first()
    anna = db.query(models.Person).filter(models.Person.name == "ANNA").first()

    marco_total = 0.0
    anna_total = 0.0

    if marco:
        marco_total = db.query(func.sum(models.LargeAdvance.amount)).filter(
            models.LargeAdvance.person_id == marco.id
        ).scalar() or 0.0

    if anna:
        anna_total = db.query(func.sum(models.LargeAdvance.amount)).filter(
            models.LargeAdvance.person_id == anna.id
        ).scalar() or 0.0

    # Total advances
    total_advances = marco_total + anna_total

    # Calculate who owes whom
    # Positive = Marco has put more, Anna owes Marco
    # Negative = Anna has put more, Marco owes Anna
    difference = marco_total - anna_total

    return {
        "marco_total": marco_total,
        "anna_total": anna_total,
        "total_advances": total_advances,
        "difference": difference,  # positive = Anna owes Marco, negative = Marco owes Anna
    }

# --- Person CRUD ---

def get_person(db: Session, person_id: int):
    return db.query(models.Person).filter(models.Person.id == person_id).first()

def get_person_by_name(db: Session, name: str):
    return db.query(models.Person).filter(models.Person.name == name).first()

def get_persons(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Person).offset(skip).limit(limit).all()

def create_person(db: Session, person: schemas.PersonCreate):
    db_person = models.Person(name=person.name)
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person

def update_person(db: Session, person_id: int, person: schemas.PersonUpdate):
    db_person = get_person(db, person_id)
    if db_person:
        db_person.name = person.name
        db.commit()
        db.refresh(db_person)
    return db_person

def delete_person(db: Session, person_id: int):
    db_person = get_person(db, person_id)
    if db_person:
        db.delete(db_person)
        db.commit()
    return db_person

# --- AppSettings CRUD ---

def get_app_settings(db: Session):
    """Get app settings (singleton)"""
    settings = db.query(models.AppSettings).first()
    if not settings:
        # Create default settings if not exist
        settings = models.AppSettings(
            monthly_income=2100.0,
            monthly_contribution_per_person=1050.0,
            smtp_server="smtp.gmail.com",
            smtp_port=587,
            smtp_use_tls=True,
            backup_enabled=False,
            backup_frequency_hours=24
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Calculate monthly_income as 2 * contribution (Marco + Anna)
    settings.monthly_income = settings.monthly_contribution_per_person * 2
    return settings


def get_monthly_income_override(db: Session, year: int, month: int):
    return db.query(models.MonthlyIncomeOverride).filter(
        models.MonthlyIncomeOverride.year == year,
        models.MonthlyIncomeOverride.month == month,
    ).first()


def get_effective_monthly_income(db: Session, year: int, month: int):
    settings = get_app_settings(db)
    calculated_income = settings.monthly_contribution_per_person * 2
    override = get_monthly_income_override(db, year, month)
    if override:
        return float(override.total_income), float(calculated_income), True
    return float(calculated_income), float(calculated_income), False


def upsert_monthly_income_override(db: Session, year: int, month: int, total_income: float | None):
    existing = get_monthly_income_override(db, year, month)
    if total_income is None:
        if existing:
            db.delete(existing)
            db.commit()
        return

    if existing:
        existing.total_income = total_income
    else:
        db.add(models.MonthlyIncomeOverride(year=year, month=month, total_income=total_income))
    db.commit()


def get_monthly_income_config(db: Session, year: int, month: int):
    effective_income, calculated_income, is_overridden = get_effective_monthly_income(db, year, month)
    return schemas.MonthlyIncomeOverrideConfig(
        year=year,
        month=month,
        calculated_income=calculated_income,
        total_income=effective_income,
        is_overridden=is_overridden,
    )


def get_monthly_account_balance(db: Session, year: int, month: int):
    """Get the account balance for a specific month"""
    return db.query(models.MonthlyAccountBalance).filter(
        models.MonthlyAccountBalance.year == year,
        models.MonthlyAccountBalance.month == month,
    ).first()


def upsert_monthly_account_balance(db: Session, year: int, month: int, account_balance: float | None):
    """Create or update the account balance for a specific month"""
    existing = get_monthly_account_balance(db, year, month)
    if account_balance is None:
        if existing:
            db.delete(existing)
            db.commit()
        return

    if existing:
        existing.account_balance = account_balance
    else:
        db.add(models.MonthlyAccountBalance(year=year, month=month, account_balance=account_balance))
    db.commit()


def get_monthly_account_balance_config(db: Session, year: int, month: int):
    """Get account balance config including computed remaining amount"""
    balance_record = get_monthly_account_balance(db, year, month)
    
    # Get total expenses for the month
    total_expenses = db.query(func.sum(models.Transaction.amount)).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    ).scalar() or 0.0
    
    account_balance = balance_record.account_balance if balance_record else None
    account_remaining = None
    
    if account_balance is not None:
        account_remaining = account_balance - float(total_expenses)
    
    return schemas.MonthlyAccountBalanceConfig(
        year=year,
        month=month,
        account_balance=account_balance,
        is_set=balance_record is not None,
        account_remaining=account_remaining,
    )

def update_app_settings(db: Session, settings: schemas.AppSettingsUpdate):
    db_settings = db.query(models.AppSettings).first()
    if not db_settings:
        db_settings = models.AppSettings()
        db.add(db_settings)

    for key, value in settings.dict(exclude_unset=True).items():
        if value is not None:
            setattr(db_settings, key, value)

    if db_settings.backup_frequency_hours is None or db_settings.backup_frequency_hours < 1:
        db_settings.backup_frequency_hours = 24

    # Recalculate monthly_income
    db_settings.monthly_income = db_settings.monthly_contribution_per_person * 2

    db.commit()
    db.refresh(db_settings)
    return get_app_settings(db)  # Use get to ensure calculation

# --- Category CRUD (add update and delete) ---

def update_category(db: Session, category_id: int, category: schemas.CategoryUpdate):
    db_category = get_category(db, category_id)
    if db_category:
        db_category.name = category.name
        db.commit()
        db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: int):
    db_category = get_category(db, category_id)
    if db_category:
        db.delete(db_category)
        db.commit()
    return db_category

# --- Statistics CRUD ---

def get_period_statistics(db: Session, start_date: date, end_date: date):
    """Get statistics for a specific period"""
    # Total expenses
    total_expenses = db.query(func.sum(models.Transaction.amount)).filter(
        and_(
            models.Transaction.date >= start_date,
            models.Transaction.date <= end_date
        )
    ).scalar() or 0.0

    # Total transactions
    total_transactions = db.query(func.count(models.Transaction.id)).filter(
        and_(
            models.Transaction.date >= start_date,
            models.Transaction.date <= end_date
        )
    ).scalar() or 0

    # Expenses by category
    expenses_by_category_raw = db.query(
        models.Category.name,
        func.sum(models.Transaction.amount)
    ).join(models.Transaction).filter(
        and_(
            models.Transaction.date >= start_date,
            models.Transaction.date <= end_date
        )
    ).group_by(models.Category.name).all()

    expenses_by_category = {name: amount for name, amount in expenses_by_category_raw}

    # Get person IDs
    marco = db.query(models.Person).filter(models.Person.name == "MARCO").first()
    anna = db.query(models.Person).filter(models.Person.name == "ANNA").first()

    # Calculate advances from LargeAdvances table
    marco_advances = 0.0
    anna_advances = 0.0
    marco_advance_details = []
    anna_advance_details = []

    if marco:
        marco_advances = db.query(func.sum(models.LargeAdvance.amount)).filter(
            and_(
                models.LargeAdvance.date >= start_date,
                models.LargeAdvance.date <= end_date,
                models.LargeAdvance.person_id == marco.id
            )
        ).scalar() or 0.0

        # Get Marco's advance details from LargeAdvances
        marco_advances_raw = db.query(models.LargeAdvance).filter(
            and_(
                models.LargeAdvance.date >= start_date,
                models.LargeAdvance.date <= end_date,
                models.LargeAdvance.person_id == marco.id
            )
        ).order_by(models.LargeAdvance.date.desc()).all()

        marco_advance_details = [
            schemas.TransactionDetail(
                id=t.id,
                date=t.date,
                description=t.description,
                notes=None,
                amount=t.amount,
                category_name="Anticipo"
            )
            for t in marco_advances_raw
        ]

    if anna:
        anna_advances = db.query(func.sum(models.LargeAdvance.amount)).filter(
            and_(
                models.LargeAdvance.date >= start_date,
                models.LargeAdvance.date <= end_date,
                models.LargeAdvance.person_id == anna.id
            )
        ).scalar() or 0.0

        # Get Anna's advance details from LargeAdvances
        anna_advances_raw = db.query(models.LargeAdvance).filter(
            and_(
                models.LargeAdvance.date >= start_date,
                models.LargeAdvance.date <= end_date,
                models.LargeAdvance.person_id == anna.id
            )
        ).order_by(models.LargeAdvance.date.desc()).all()

        anna_advance_details = [
            schemas.TransactionDetail(
                id=t.id,
                date=t.date,
                description=t.description,
                notes=None,
                amount=t.amount,
                category_name="Anticipo"
            )
            for t in anna_advances_raw
        ]

    # Average transaction
    average_transaction = total_expenses / total_transactions if total_transactions > 0 else 0.0

    # Get major expenses for the period
    major_expenses_raw = db.query(models.MajorExpense).filter(
        and_(
            models.MajorExpense.date >= start_date,
            models.MajorExpense.date <= end_date
        )
    ).order_by(models.MajorExpense.date.desc()).all()

    major_expenses = [
        schemas.MajorExpense(
            id=exp.id,
            date=exp.date,
            description=exp.description,
            category=exp.category,
            amount=exp.amount,
            notes=exp.notes,
        )
        for exp in major_expenses_raw
    ]

    monthly_trends = []
    for year, month in _iter_months(start_date, end_date):
        month_expenses = db.query(func.sum(models.Transaction.amount)).filter(
            extract('year', models.Transaction.date) == year,
            extract('month', models.Transaction.date) == month
        ).scalar() or 0.0

        utilities_expenses = db.query(func.sum(models.Transaction.amount)).join(models.Category).filter(
            extract('year', models.Transaction.date) == year,
            extract('month', models.Transaction.date) == month,
            models.Category.name.ilike('%bollette%')
        ).scalar() or 0.0

        month_income, _, _ = get_effective_monthly_income(db, year, month)
        month_balance = month_income - month_expenses
        monthly_trends.append(
            schemas.MonthlyTrendPoint(
                year=year,
                month=month,
                label=f"{month:02d}/{year}",
                total_income=month_income,
                total_expenses=float(month_expenses),
                balance=float(month_balance),
                positive_balance=float(max(month_balance, 0.0)),
                negative_balance=float(abs(min(month_balance, 0.0))),
                utilities_expenses=float(utilities_expenses),
            )
        )

    # Include the same monthly summary logic used in Home page for current month.
    today = date.today()
    current_month_summary = get_monthly_summary(db, today.year, today.month)

    # Include overall large-advances balance (global section recap).
    large_advances_balance = schemas.LargeAdvancesBalanceSummary(**get_large_advances_balance(db))
    new_major_expenses_total = sum(exp.amount for exp in major_expenses)

    return schemas.PeriodStatistics(
        start_date=start_date,
        end_date=end_date,
        total_expenses=total_expenses,
        total_transactions=total_transactions,
        expenses_by_category=expenses_by_category,
        average_transaction=average_transaction,
        marco_advances=marco_advances,
        anna_advances=anna_advances,
        marco_advance_details=marco_advance_details,
        anna_advance_details=anna_advance_details,
        current_month_summary=current_month_summary,
        large_advances_balance=large_advances_balance,
        monthly_trends=monthly_trends,
        new_major_expenses_count=len(major_expenses),
        new_major_expenses_total=new_major_expenses_total,
        major_expenses=major_expenses
    )
# --- MajorExpense CRUD ---
def create_major_expense(db: Session, major_expense: schemas.MajorExpenseCreate):
    comune = _get_or_create_comune_person(db)
    payload = major_expense.dict()
    payload["person_id"] = comune.id
    db_major_expense = models.MajorExpense(**payload)
    db.add(db_major_expense)
    db.commit()
    db.refresh(db_major_expense)
    return db_major_expense

def get_major_expense(db: Session, major_expense_id: int):
    return db.query(models.MajorExpense).filter(models.MajorExpense.id == major_expense_id).first()

def get_major_expenses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.MajorExpense).order_by(models.MajorExpense.date.desc()).offset(skip).limit(limit).all()

def get_major_expenses_by_year(db: Session, year: int, skip: int = 0, limit: int = 100):
    return db.query(models.MajorExpense).filter(
        extract('year', models.MajorExpense.date) == year
    ).order_by(models.MajorExpense.date.desc()).offset(skip).limit(limit).all()

def get_major_expenses_by_category(db: Session, category: str, skip: int = 0, limit: int = 100):
    return db.query(models.MajorExpense).filter(
        models.MajorExpense.category == category
    ).order_by(models.MajorExpense.date.desc()).offset(skip).limit(limit).all()

def update_major_expense(db: Session, major_expense_id: int, major_expense: schemas.MajorExpenseCreate):
    db_major_expense = get_major_expense(db, major_expense_id)
    if db_major_expense:
        payload = major_expense.dict()
        payload["person_id"] = _get_or_create_comune_person(db).id
        for key, value in payload.items():
            setattr(db_major_expense, key, value)
        db.commit()
        db.refresh(db_major_expense)
    return db_major_expense

def delete_major_expense(db: Session, major_expense_id: int):
    db_major_expense = get_major_expense(db, major_expense_id)
    if db_major_expense:
        db.delete(db_major_expense)
        db.commit()
    return db_major_expense

def get_major_expenses_summary(db: Session):
    """Get summary statistics for major expenses"""
    total = db.query(func.sum(models.MajorExpense.amount)).scalar() or 0.0
    
    # By category
    by_category = db.query(
        models.MajorExpense.category,
        func.sum(models.MajorExpense.amount),
        func.count(models.MajorExpense.id)
    ).group_by(models.MajorExpense.category).all()
    
    return {
        "total": total,
        "by_category": [{"category": cat, "amount": amt, "count": cnt} for cat, amt, cnt in by_category],
        "by_person": []
    }


def copy_transactions_to_month(
    db: Session,
    source_year: int,
    source_month: int,
    target_year: int,
    target_month: int,
    transaction_ids: list[int] | None = None,
):
    source_query = db.query(models.Transaction).filter(
        extract('year', models.Transaction.date) == source_year,
        extract('month', models.Transaction.date) == source_month
    )
    source_transactions = source_query.order_by(
        models.Transaction.category_id.asc(),
        models.Transaction.id.asc(),
    ).all()

    if transaction_ids is not None:
        requested_ids = set(transaction_ids)
        source_transactions = [tx for tx in source_transactions if tx.id in requested_ids]

    copied = []
    target_date = date(target_year, target_month, 1)
    for tx in source_transactions:
        new_tx = models.Transaction(
            date=target_date,
            description=tx.description,
            notes=tx.notes,
            amount=tx.amount,
            category_id=tx.category_id,
            person_id=tx.person_id,
        )
        db.add(new_tx)
        copied.append(new_tx)

    db.commit()
    for tx in copied:
        db.refresh(tx)

    return copied


def export_backup_data(db: Session) -> Dict[str, Any]:
    """Export human-readable backup for the three accounting sections."""
    transactions = db.query(models.Transaction).join(models.Category).join(models.Person).order_by(models.Transaction.date.asc(), models.Transaction.id.asc()).all()
    large_advances = db.query(models.LargeAdvance).join(models.Person).order_by(models.LargeAdvance.date.asc(), models.LargeAdvance.id.asc()).all()
    major_expenses = db.query(models.MajorExpense).order_by(models.MajorExpense.date.asc(), models.MajorExpense.id.asc()).all()

    return {
        "format_version": 1,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "transactions": [
            {
                "date": t.date.isoformat(),
                "description": t.description,
                "notes": t.notes,
                "amount": float(t.amount),
                "category": t.category.name,
                "person": t.person.name,
            }
            for t in transactions
        ],
        "large_advances": [
            {
                "date": a.date.isoformat(),
                "description": a.description,
                "amount": float(a.amount),
                "person": a.person.name,
            }
            for a in large_advances
        ],
        "major_expenses": [
            {
                "date": e.date.isoformat(),
                "description": e.description,
                "category": e.category,
                "amount": float(e.amount),
                "notes": e.notes,
                "person": "COMUNE",
            }
            for e in major_expenses
        ],
    }


def restore_backup_data(db: Session, payload: schemas.BackupPayload) -> Dict[str, int]:
    """Restore backup and overwrite all existing entries in tracked sections."""
    transactions = payload.transactions or []
    large_advances = payload.large_advances or []
    major_expenses = payload.major_expenses or []

    person_names = {"COMUNE", "MARCO", "ANNA"}
    person_names.update(item.person for item in transactions)
    person_names.update(item.person for item in large_advances)
    person_names.update(item.person for item in major_expenses)
    person_names = {name.strip() for name in person_names if name and name.strip()}

    category_names = {item.category.strip() for item in transactions if item.category and item.category.strip()}

    # Ensure referenced people/categories exist before inserting restored entries.
    for person_name in sorted(person_names):
        if not get_person_by_name(db, person_name):
            db.add(models.Person(name=person_name))

    for category_name in sorted(category_names):
        if not get_category_by_name(db, category_name):
            db.add(models.Category(name=category_name))

    db.flush()

    person_by_name = {p.name: p for p in db.query(models.Person).all()}
    category_by_name = {c.name: c for c in db.query(models.Category).all()}

    db.query(models.Transaction).delete(synchronize_session=False)
    db.query(models.LargeAdvance).delete(synchronize_session=False)
    db.query(models.MajorExpense).delete(synchronize_session=False)

    for item in transactions:
        db.add(
            models.Transaction(
                date=item.date,
                description=item.description,
                notes=item.notes,
                amount=item.amount,
                category_id=category_by_name[item.category].id,
                person_id=person_by_name[item.person].id,
            )
        )

    for item in large_advances:
        db.add(
            models.LargeAdvance(
                date=item.date,
                description=item.description,
                amount=item.amount,
                person_id=person_by_name[item.person].id,
            )
        )

    for item in major_expenses:
        db.add(
            models.MajorExpense(
                date=item.date,
                description=item.description,
                category=item.category,
                amount=item.amount,
                notes=item.notes,
                person_id=person_by_name[(item.person or "COMUNE")].id,
            )
        )

    db.commit()

    return {
        "transactions_restored": len(transactions),
        "large_advances_restored": len(large_advances),
        "major_expenses_restored": len(major_expenses),
    }
