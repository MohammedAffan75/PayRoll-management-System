from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, Text, Enum, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./payroll.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DepartmentEnum(str, enum.Enum):
    ENGINEERING = "Engineering"
    HR = "HR"
    FINANCE = "Finance"
    MARKETING = "Marketing"
    SALES = "Sales"
    OPERATIONS = "Operations"
    IT = "IT"
    ADMINISTRATION = "Administration"

class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    HR_MANAGER = "hr_manager"
    FINANCE = "finance"
    EMPLOYEE = "employee"

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    department = Column(String)
    designation = Column(String)
    gender = Column(String, default="other")
    date_of_joining = Column(Date)
    is_active = Column(Boolean, default=True)
    hashed_password = Column(String)
    role = Column(String, default="employee")
    created_at = Column(DateTime, default=datetime.utcnow)
    salary_structure = relationship("SalaryStructure", back_populates="employee", uselist=False)
    payroll_records = relationship("PayrollRecord", back_populates="employee")
    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    leave_records = relationship("LeaveRecord", back_populates="employee")

class SalaryStructure(Base):
    __tablename__ = "salary_structures"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    basic_salary = Column(Float, default=0)
    hra = Column(Float, default=0)
    transport_allowance = Column(Float, default=0)
    medical_allowance = Column(Float, default=0)
    special_allowance = Column(Float, default=0)
    pf_deduction = Column(Float, default=0)
    tax_deduction = Column(Float, default=0)
    other_deductions = Column(Float, default=0)
    effective_from = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    employee = relationship("Employee", back_populates="salary_structure")

class PayrollRecord(Base):
    __tablename__ = "payroll_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    month = Column(Integer)
    year = Column(Integer)
    basic_salary = Column(Float, default=0)
    hra = Column(Float, default=0)
    transport_allowance = Column(Float, default=0)
    medical_allowance = Column(Float, default=0)
    special_allowance = Column(Float, default=0)
    gross_salary = Column(Float, default=0)
    pf_deduction = Column(Float, default=0)
    tax_deduction = Column(Float, default=0)
    other_deductions = Column(Float, default=0)
    total_deductions = Column(Float, default=0)
    net_salary = Column(Float, default=0)
    days_worked = Column(Integer, default=0)
    days_present = Column(Integer, default=0)
    leaves_taken = Column(Integer, default=0)
    status = Column(String, default="pending")
    payslip_path = Column(String)
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    employee = relationship("Employee", back_populates="payroll_records")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(Date)
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    status = Column(String, default="present")
    employee = relationship("Employee", back_populates="attendance_records")

class LeaveRecord(Base):
    __tablename__ = "leave_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    leave_type = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    days = Column(Integer)
    reason = Column(Text)
    status = Column(String, default="pending")
    applied_at = Column(DateTime, default=datetime.utcnow)
    employee = relationship("Employee", back_populates="leave_records")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    employee_columns = {col["name"] for col in inspector.get_columns("employees")}
    if "gender" not in employee_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE employees ADD COLUMN gender VARCHAR DEFAULT 'other'"))
