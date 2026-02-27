from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from datetime import date
from . import models, schemas

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

    return schemas.MonthlySummary(
        year=year,
        month=month,
        total_income=settings.monthly_income,
        total_expenses=total_expenses,
        balance=settings.monthly_income - total_expenses,
        expenses_by_category=expenses_by_category,
        person_contributions=person_contributions
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
            smtp_use_tls=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Calculate monthly_income as 2 * contribution (Marco + Anna)
    settings.monthly_income = settings.monthly_contribution_per_person * 2
    return settings

def update_app_settings(db: Session, settings: schemas.AppSettingsUpdate):
    db_settings = db.query(models.AppSettings).first()
    if not db_settings:
        db_settings = models.AppSettings()
        db.add(db_settings)

    for key, value in settings.dict(exclude_unset=True).items():
        if value is not None:
            setattr(db_settings, key, value)

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
            person_id=exp.person_id,
            person=schemas.Person(id=exp.person.id, name=exp.person.name)
        )
        for exp in major_expenses_raw
    ]

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
        new_major_expenses_count=len(major_expenses),
        new_major_expenses_total=new_major_expenses_total,
        major_expenses=major_expenses
    )
# --- MajorExpense CRUD ---
def create_major_expense(db: Session, major_expense: schemas.MajorExpenseCreate):
    db_major_expense = models.MajorExpense(**major_expense.dict())
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
        for key, value in major_expense.dict().items():
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
    
    # By person
    by_person = db.query(
        models.Person.name,
        func.sum(models.MajorExpense.amount),
        func.count(models.MajorExpense.id)
    ).join(models.MajorExpense).group_by(models.Person.name).all()
    
    return {
        "total": total,
        "by_category": [{"category": cat, "amount": amt, "count": cnt} for cat, amt, cnt in by_category],
        "by_person": [{"person": person, "amount": amt, "count": cnt} for person, amt, cnt in by_person]
    }
