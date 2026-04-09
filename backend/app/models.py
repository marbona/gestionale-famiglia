from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import relationship
import enum

from .database import Base

class PayerEnum(enum.Enum):
    COMUNE = "COMUNE"
    MARCO = "MARCO"
    ANNA = "ANNA"

class Person(Base):
    """Model for managing people (payers)"""
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    transactions = relationship("Transaction", back_populates="person")
    large_advances = relationship("LargeAdvance", back_populates="person")
    personal_advances = relationship("PersonalAdvance", back_populates="person")
    major_expenses = relationship("MajorExpense", back_populates="person")

class AppSettings(Base):
    """Model for application settings (singleton table)"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    # Financial settings
    monthly_income = Column(Float, default=2100.0, nullable=False)
    monthly_contribution_per_person = Column(Float, default=1050.0, nullable=False)

    # SMTP settings
    smtp_server = Column(String, default="smtp.gmail.com")
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String)
    smtp_password = Column(String)
    smtp_use_tls = Column(Boolean, default=True)

    # Email recipients for reports
    email_recipients = Column(Text)  # JSON array of email addresses

    # Scheduled backup settings
    backup_enabled = Column(Boolean, default=False, nullable=False)
    backup_frequency_hours = Column(Integer, default=24, nullable=False)
    backup_recipients = Column(Text)  # JSON array of email addresses
    backup_last_sent_at = Column(DateTime, nullable=True)

class MonthlyIncomeOverride(Base):
    __tablename__ = "monthly_income_overrides"
    __table_args__ = (UniqueConstraint("year", "month", name="uq_monthly_income_overrides_year_month"),)

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    total_income = Column(Float, nullable=False)


class MonthlyAccountBalance(Base):
    """Model for storing the actual bank account balance at the start of each month"""
    __tablename__ = "monthly_account_balances"
    __table_args__ = (UniqueConstraint("year", "month", name="uq_monthly_account_balances_year_month"),)

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    account_balance = Column(Float, nullable=True)  # Null means not set

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    transactions = relationship("Transaction", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", back_populates="transactions")

    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    person = relationship("Person", back_populates="transactions")

class PersonalAdvance(Base):
    __tablename__ = "personal_advances"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    person = relationship("Person", back_populates="personal_advances")
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    reconciled = Column(Integer, default=False) # Using Integer for SQLite boolean compatibility

class LargeAdvance(Base):
    __tablename__ = "large_advances"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    person = relationship("Person", back_populates="large_advances")
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    description = Column(String)

class MajorExpense(Base):
    """Model for tracking major expenses/investments over years (renovations, education, etc.)"""
    __tablename__ = "major_expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False)  # e.g., "Ristrutturazione", "Istruzione", "Manutenzione"
    amount = Column(Float, nullable=False)
    notes = Column(Text)  # Additional details
    
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    person = relationship("Person", back_populates="major_expenses")
