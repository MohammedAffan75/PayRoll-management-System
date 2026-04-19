from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime

# ─── Auth ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# ─── Employee ────────────────────────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    department: str
    designation: str
    gender: Optional[str] = "other"
    date_of_joining: date
    password: str
    role: Optional[str] = "employee"

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    gender: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None

class EmployeeOut(BaseModel):
    id: int
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    department: Optional[str]
    designation: Optional[str]
    gender: Optional[str]
    date_of_joining: Optional[date]
    is_active: bool
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Salary Structure ─────────────────────────────────────────────────────────
class SalaryStructureCreate(BaseModel):
    employee_id: int
    basic_salary: float
    hra: float = 0
    transport_allowance: float = 0
    medical_allowance: float = 0
    special_allowance: float = 0
    pf_deduction: float = 0
    tax_deduction: float = 0
    other_deductions: float = 0
    effective_from: date

class SalaryStructureOut(BaseModel):
    id: int
    employee_id: int
    basic_salary: float
    hra: float
    transport_allowance: float
    medical_allowance: float
    special_allowance: float
    pf_deduction: float
    tax_deduction: float
    other_deductions: float
    effective_from: Optional[date]

    class Config:
        from_attributes = True

# ─── Payroll ──────────────────────────────────────────────────────────────────
class PayrollProcessRequest(BaseModel):
    employee_id: int
    month: int
    year: int
    days_present: Optional[int] = None
    leaves_taken: Optional[int] = 0
    other_deductions: Optional[float] = 0

class PayrollRecordOut(BaseModel):
    id: int
    employee_id: int
    month: int
    year: int
    basic_salary: float
    hra: float
    transport_allowance: float
    medical_allowance: float
    special_allowance: float
    gross_salary: float
    pf_deduction: float
    tax_deduction: float
    other_deductions: float
    total_deductions: float
    net_salary: float
    days_worked: int
    days_present: int
    leaves_taken: int
    status: str
    processed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Attendance ───────────────────────────────────────────────────────────────
class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    status: str = "present"

class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    status: str

    class Config:
        from_attributes = True

# ─── Leave ───────────────────────────────────────────────────────────────────
class LeaveCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str

class LeaveUpdate(BaseModel):
    status: str

class LeaveOut(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    days: int
    reason: str
    status: str
    applied_at: datetime

    class Config:
        from_attributes = True

# ─── Dashboard Stats ──────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    total_payroll_this_month: float
    pending_leaves: int
    departments: List[dict]
    recent_payroll: List[dict]
