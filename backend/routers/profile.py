from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from pydantic import BaseModel
from datetime import date

import database
import schemas
from auth import get_current_user, require_admin, verify_password, get_password_hash

router = APIRouter()

class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ProfileOut(BaseModel):
    id: int
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    department: Optional[str]
    designation: Optional[str]
    date_of_joining: Optional[date]
    role: str
    is_active: bool

@router.get("/me", response_model=ProfileOut)
def get_my_profile(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's profile"""
    return {
        "id": current_user.id,
        "employee_id": current_user.employee_id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "department": current_user.department,
        "designation": current_user.designation,
        "date_of_joining": current_user.date_of_joining,
        "role": current_user.role,
        "is_active": current_user.is_active
    }

@router.put("/me")
def update_my_profile(
    update: ProfileUpdate,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Update current user's profile"""
    if update.phone:
        current_user.phone = update.phone
    
    if update.email:
        # Check if email already exists
        existing = db.query(database.Employee).filter(
            database.Employee.email == update.email,
            database.Employee.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = update.email
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": "Profile updated successfully",
        "profile": {
            "id": current_user.id,
            "email": current_user.email,
            "phone": current_user.phone
        }
    }

@router.post("/me/change-password")
def change_my_password(
    data: PasswordChange,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Change current user's password"""
    # Verify current password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

@router.get("/me/summary")
def get_my_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get summary of current user's data"""
    # Payroll count
    payroll_count = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.employee_id == current_user.id
    ).count()
    
    # Attendance this month
    from datetime import datetime
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    attendance_count = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        func.extract('month', database.AttendanceRecord.date) == current_month,
        func.extract('year', database.AttendanceRecord.date) == current_year
    ).count()
    
    # Leave balance
    pending_leaves = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == current_user.id,
        database.LeaveRecord.status == "pending"
    ).count()
    
    approved_leaves = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == current_user.id,
        database.LeaveRecord.status == "approved"
    ).count()
    
    # Salary info
    salary = db.query(database.SalaryStructure).filter(
        database.SalaryStructure.employee_id == current_user.id
    ).first()
    
    salary_info = None
    if salary:
        salary_info = {
            "basic_salary": salary.basic_salary,
            "hra": salary.hra,
            "total_allowances": salary.hra + salary.transport_allowance + salary.medical_allowance + salary.special_allowance,
            "total_deductions": salary.pf_deduction + salary.tax_deduction + salary.other_deductions
        }
    
    return {
        "employee": {
            "id": current_user.id,
            "name": f"{current_user.first_name} {current_user.last_name}",
            "department": current_user.department,
            "designation": current_user.designation
        },
        "summary": {
            "payroll_records": payroll_count,
            "attendance_this_month": attendance_count,
            "pending_leave_requests": pending_leaves,
            "approved_leaves_this_year": approved_leaves
        },
        "salary_info": salary_info
    }

@router.get("/search")
def search_employees(
    q: str,
    department: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Search employees by name, email, or employee ID"""
    query = db.query(database.Employee)
    
    # Search filter
    if q:
        search_filter = or_(
            database.Employee.first_name.ilike(f"%{q}%"),
            database.Employee.last_name.ilike(f"%{q}%"),
            database.Employee.email.ilike(f"%{q}%"),
            database.Employee.employee_id.ilike(f"%{q}%")
        )
        query = query.filter(search_filter)
    
    # Additional filters
    if department:
        query = query.filter(database.Employee.department == department)
    if role:
        query = query.filter(database.Employee.role == role)
    if is_active is not None:
        query = query.filter(database.Employee.is_active == is_active)
    
    total = query.count()
    employees = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": [
            {
                "id": e.id,
                "employee_id": e.employee_id,
                "name": f"{e.first_name} {e.last_name}",
                "email": e.email,
                "department": e.department,
                "designation": e.designation,
                "role": e.role,
                "is_active": e.is_active
            }
            for e in employees
        ]
    }

@router.get("/filter-options")
def get_filter_options(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get available filter options for employee search"""
    departments = db.query(database.Employee.department).distinct().all()
    roles = db.query(database.Employee.role).distinct().all()
    designations = db.query(database.Employee.designation).distinct().all()
    
    return {
        "departments": [d[0] for d in departments if d[0]],
        "roles": [r[0] for r in roles if r[0]],
        "designations": [d[0] for d in designations if d[0]]
    }
