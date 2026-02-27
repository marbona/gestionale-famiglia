from pydantic import BaseModel
from datetime import date
from typing import List, Optional, Dict

# --- Person Schemas ---
class PersonBase(BaseModel):
    name: str

class PersonCreate(PersonBase):
    pass

class PersonUpdate(PersonBase):
    pass

class Person(PersonBase):
    id: int

    class Config:
        from_attributes = True

# --- AppSettings Schemas ---
class AppSettingsBase(BaseModel):
    # monthly_income is now calculated automatically as sum of contributions
    monthly_contribution_per_person: float = 1050.0
    smtp_server: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = True
    email_recipients: Optional[str] = None  # JSON string of email list

class AppSettingsUpdate(BaseModel):
    monthly_contribution_per_person: Optional[float] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    email_recipients: Optional[str] = None

class AppSettings(BaseModel):
    id: int
    monthly_contribution_per_person: float
    monthly_income: float  # Calculated: 2 * monthly_contribution_per_person
    smtp_server: Optional[str]
    smtp_port: Optional[int]
    smtp_username: Optional[str]
    smtp_password: Optional[str]
    smtp_use_tls: Optional[bool]
    email_recipients: Optional[str]

    class Config:
        from_attributes = True

# --- Category Schemas ---
class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True

# --- Transaction Schemas ---
class TransactionBase(BaseModel):
    date: date
    description: str
    amount: float
    category_id: int
    person_id: int

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    category: Category
    person: Person

    class Config:
        from_attributes = True

# --- PersonalAdvance Schemas ---
class PersonalAdvanceBase(BaseModel):
    person_id: int
    amount: float
    date: date

class PersonalAdvanceCreate(PersonalAdvanceBase):
    pass

class PersonalAdvance(PersonalAdvanceBase):
    id: int
    person: Person
    reconciled: bool

    class Config:
        from_attributes = True


# --- LargeAdvance Schemas ---
class LargeAdvanceBase(BaseModel):
    person_id: int
    amount: float
    date: date
    description: Optional[str] = None

class LargeAdvanceCreate(LargeAdvanceBase):
    pass

class LargeAdvance(LargeAdvanceBase):
    id: int
    person: Person

    class Config:
        from_attributes = True

# --- Summary Schemas ---
class MonthlySummary(BaseModel):
    year: int
    month: int
    total_income: float
    total_expenses: float
    balance: float
    expenses_by_category: Dict[str, float]
    person_contributions: Dict[str, Dict[str, float]]  # {person_name: {paid: X, needs_to_pay: Y}}

    class Config:
        from_attributes = True

# --- Statistics Schemas ---
class TransactionDetail(BaseModel):
    id: int
    date: date
    description: str
    amount: float
    category_name: str

class LargeAdvancesBalanceSummary(BaseModel):
    marco_total: float
    anna_total: float
    total_advances: float
    difference: float

class PeriodStatistics(BaseModel):
    start_date: date
    end_date: date
    total_expenses: float
    total_transactions: int
    expenses_by_category: Dict[str, float]
    average_transaction: float
    marco_advances: float
    anna_advances: float
    marco_advance_details: List[TransactionDetail]
    anna_advance_details: List[TransactionDetail]
    current_month_summary: MonthlySummary
    large_advances_balance: LargeAdvancesBalanceSummary
    new_major_expenses_count: int
    new_major_expenses_total: float
    major_expenses: List['MajorExpense'] = []

    class Config:
        from_attributes = True
# --- MajorExpense Schemas ---
class MajorExpenseBase(BaseModel):
    date: date
    description: str
    category: str
    amount: float
    notes: Optional[str] = None
    person_id: int

class MajorExpenseCreate(MajorExpenseBase):
    pass

class MajorExpense(MajorExpenseBase):
    id: int
    person: Person

    class Config:
        from_attributes = True
