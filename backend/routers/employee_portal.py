from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date, timedelta

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

# Employee self-service endpoints for leave management

# ─── Employee Self-Service Endpoints ────────────────────────────────────────

@router.get("/me", response_model=schemas.EmployeeOut)
def get_my_profile(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's profile"""
    return current_user

@router.get("/me/salary", response_model=schemas.SalaryStructureOut)
def get_my_salary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's salary structure"""
    salary = db.query(database.SalaryStructure).filter(
        database.SalaryStructure.employee_id == current_user.id
    ).first()
    
    if not salary:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    
    return salary

@router.get("/me/payroll", response_model=List[schemas.PayrollRecordOut])
def get_my_payroll_history(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's payroll history"""
    query = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.employee_id == current_user.id
    )
    
    if month:
        query = query.filter(database.PayrollRecord.month == month)
    if year:
        query = query.filter(database.PayrollRecord.year == year)
    
    return query.order_by(database.PayrollRecord.year.desc(), database.PayrollRecord.month.desc()).all()

@router.get("/me/attendance", response_model=List[schemas.AttendanceOut])
def get_my_attendance(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's attendance records"""
    query = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id
    )
    
    if start_date:
        query = query.filter(database.AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(database.AttendanceRecord.date <= end_date)
    
    return query.order_by(database.AttendanceRecord.date.desc()).all()

@router.get("/me/leaves", response_model=List[schemas.LeaveOut])
def get_my_leave_requests(
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's leave requests"""
    query = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == current_user.id
    )
    
    if status:
        query = query.filter(database.LeaveRecord.status == status)
    
    return query.order_by(database.LeaveRecord.applied_at.desc()).all()

@router.post("/me/leaves", response_model=schemas.LeaveOut)
def apply_leave(
    leave_request: schemas.LeaveCreate,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Apply for leave"""
    leave_type = (leave_request.leave_type or "").lower()
    employee_gender = (current_user.gender or "other").lower()
    if leave_type == "maternity" and employee_gender != "female":
        raise HTTPException(status_code=400, detail="Maternity leave is available for female employees only")
    if leave_type == "paternity" and employee_gender != "male":
        raise HTTPException(status_code=400, detail="Paternity leave is available for male employees only")

    # Calculate days
    start_date = leave_request.start_date
    end_date = leave_request.end_date
    days = (end_date - start_date).days + 1
    
    # Check for overlapping leave requests
    existing = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == current_user.id,
        database.LeaveRecord.status.in_(["pending", "approved"]),
        database.LeaveRecord.start_date <= end_date,
        database.LeaveRecord.end_date >= start_date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Overlapping leave request exists")
    
    # Create leave record
    leave = database.LeaveRecord(
        employee_id=current_user.id,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        days=days,
        reason=leave_request.reason,
        status="pending",
        applied_at=datetime.now()
    )
    
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave

@router.get("/me/leave-balance")
def get_my_leave_balance(
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's leave balance for the year"""
    if not year:
        year = datetime.now().year
    
    # Default leave types and their annual allocation
    leave_types = {
        "annual": 20,
        "sick": 10,
        "casual": 8,
        "maternity": 180,
        "paternity": 15,
        "bereavement": 5,
        "unpaid": 0
    }
    employee_gender = (current_user.gender or "other").lower()
    if employee_gender == "male":
        leave_types.pop("maternity", None)
    elif employee_gender == "female":
        leave_types.pop("paternity", None)
    else:
        leave_types.pop("maternity", None)
        leave_types.pop("paternity", None)
    
    # Get all approved leaves for the year
    leaves = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == current_user.id,
        database.LeaveRecord.status == "approved",
        func.extract('year', database.LeaveRecord.start_date) == year
    ).all()
    
    # Calculate used leaves by type
    used_leaves = {}
    for leave in leaves:
        leave_type = leave.leave_type.lower()
        used_leaves[leave_type] = used_leaves.get(leave_type, 0) + leave.days
    
    # Build balance report
    balance_report = []
    for leave_type, entitled_days in leave_types.items():
        used = used_leaves.get(leave_type, 0)
        remaining = max(0, entitled_days - used)
        
        balance_report.append({
            "leave_type": leave_type,
            "entitled": entitled_days,
            "used": used,
            "remaining": remaining
        })
    
    total_used = sum(used_leaves.values())
    total_entitled = sum(leave_types.values())
    
    return {
        "year": year,
        "employee_id": current_user.id,
        "employee_name": f"{current_user.first_name} {current_user.last_name}",
        "total_entitled": total_entitled,
        "total_used": total_used,
        "total_remaining": total_entitled - total_used,
        "balance_by_type": balance_report
    }

@router.get("/me/summary")
def get_my_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get comprehensive summary for current user"""
    # Payroll count
    payroll_count = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.employee_id == current_user.id
    ).count()
    
    # Attendance this month
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    attendance_count = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        func.extract('month', database.AttendanceRecord.date) == current_month,
        func.extract('year', database.AttendanceRecord.date) == current_year
    ).count()
    
    # Leave counts
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
            "total_deductions": salary.pf_deduction + salary.tax_deduction + salary.other_deductions,
            "net_salary": salary.basic_salary + salary.hra + salary.transport_allowance + salary.medical_allowance + salary.special_allowance - (salary.pf_deduction + salary.tax_deduction + salary.other_deductions)
        }
    
    return {
        "employee": {
            "id": current_user.id,
            "name": f"{current_user.first_name} {current_user.last_name}",
            "email": current_user.email,
            "department": current_user.department,
            "designation": current_user.designation,
            "role": current_user.role,
            "employee_id": current_user.employee_id
        },
        "summary": {
            "payroll_records": payroll_count,
            "attendance_this_month": attendance_count,
            "pending_leave_requests": pending_leaves,
            "approved_leaves_this_year": approved_leaves
        },
        "salary_info": salary_info
    }

# ─── Admin Only Endpoints (Keep existing functionality) ─────────────────────

@router.get("/", response_model=List[schemas.EmployeeOut])
def get_employees(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    """Get all employees (Admin only)"""
    employees = db.query(database.Employee).offset(skip).limit(limit).all()
    return employees

@router.get("/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    """Get specific employee (Self or Admin/HR)"""
    # User can see their own profile, admins can see any profile
    if current_user.role not in ["admin", "hr_manager"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this profile")
        
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.put("/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(employee_id: int, emp_in: schemas.EmployeeUpdate, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    """Update employee (Admin only)"""
    db_emp = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    update_data = emp_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_emp, key, value)
        
    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.post("/{employee_id}/salary", response_model=schemas.SalaryStructureOut)
def create_or_update_salary(employee_id: int, salary: schemas.SalaryStructureCreate, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    """Create or update salary structure (Admin only)"""
    db_emp = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    db_salary = db.query(database.SalaryStructure).filter(database.SalaryStructure.employee_id == employee_id).first()
    
    if db_salary:
        # Update existing
        update_data = salary.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_salary, key, value)
    else:
        # Create new
        db_salary = database.SalaryStructure(**salary.model_dump())
        db.add(db_salary)
        
    db.commit()
    db.refresh(db_salary)
    return db_salary

@router.get("/{employee_id}/salary", response_model=schemas.SalaryStructureOut)
def get_salary(employee_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    """Get salary structure (Self or Admin/HR/Finance)"""
    if current_user.role not in ["admin", "hr_manager", "finance"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_salary = db.query(database.SalaryStructure).filter(database.SalaryStructure.employee_id == employee_id).first()
    if not db_salary:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    return db_salary
