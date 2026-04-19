from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, timedelta
import calendar

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

LEAVE_ENTITLEMENTS = {
    "annual": 20,
    "sick": 10,
    "casual": 8,
    "maternity": 180,
    "paternity": 15,
    "bereavement": 5,
    "unpaid": 0
}


def _calculate_month_leave_impact(db: Session, employee_id: int, month: int, year: int, gross_salary: float):
    month_days = calendar.monthrange(year, month)[1]
    month_end = date(year, month, month_days)
    year_start = date(year, 1, 1)

    approved_leaves = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == employee_id,
        database.LeaveRecord.status == "approved",
        database.LeaveRecord.start_date <= month_end,
        database.LeaveRecord.end_date >= year_start
    ).order_by(database.LeaveRecord.start_date.asc(), database.LeaveRecord.id.asc()).all()

    used_paid_days = {}
    month_leave_days = 0
    unpaid_days_in_month = 0

    for leave in approved_leaves:
        leave_type = (leave.leave_type or "").lower()
        leave_start = max(leave.start_date, year_start)
        leave_end = min(leave.end_date, month_end)
        if leave_start > leave_end:
            continue

        current_day = leave_start
        while current_day <= leave_end:
            entitled = LEAVE_ENTITLEMENTS.get(leave_type, 0)
            paid_used = used_paid_days.get(leave_type, 0)
            is_unpaid_day = leave_type == "unpaid" or paid_used >= entitled

            if leave_type != "unpaid" and paid_used < entitled:
                used_paid_days[leave_type] = paid_used + 1

            if current_day.month == month and current_day.year == year:
                month_leave_days += 1
                if is_unpaid_day:
                    unpaid_days_in_month += 1

            current_day += timedelta(days=1)

    per_day_salary = gross_salary / month_days if month_days > 0 else 0
    leave_deduction = round(per_day_salary * unpaid_days_in_month, 2)
    return month_days, month_leave_days, unpaid_days_in_month, leave_deduction

@router.get("/", response_model=List[schemas.PayrollRecordOut])
def get_all_payroll(
    month: int = None,
    year: int = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all payroll records with optional month/year filter (Admin only)"""
    query = db.query(database.PayrollRecord)
    
    if month:
        query = query.filter(database.PayrollRecord.month == month)
    if year:
        query = query.filter(database.PayrollRecord.year == year)
    
    return query.order_by(database.PayrollRecord.year.desc(), database.PayrollRecord.month.desc()).all()

@router.post("/process", response_model=schemas.PayrollRecordOut)
def process_payroll(req: schemas.PayrollProcessRequest, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    # Check if already processed
    existing = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.employee_id == req.employee_id,
        database.PayrollRecord.month == req.month,
        database.PayrollRecord.year == req.year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payroll already processed for this month")

    # Get employee & salary structure
    emp = db.query(database.Employee).filter(database.Employee.id == req.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    salary = db.query(database.SalaryStructure).filter(database.SalaryStructure.employee_id == req.employee_id).first()
    if not salary:
        raise HTTPException(status_code=400, detail="Salary structure not defined for employee")

    gross_salary = salary.basic_salary + salary.hra + salary.transport_allowance + salary.medical_allowance + salary.special_allowance
    month_days, leave_days, _unpaid_leave_days, leave_deduction = _calculate_month_leave_impact(
        db, req.employee_id, req.month, req.year, gross_salary
    )
    base_other_deductions = salary.other_deductions + (req.other_deductions or 0)
    total_deductions = salary.pf_deduction + salary.tax_deduction + base_other_deductions + leave_deduction
    net_salary = max(0, gross_salary - total_deductions)
    days_present = req.days_present if req.days_present is not None else max(0, month_days - leave_days)

    payroll = database.PayrollRecord(
        employee_id=req.employee_id,
        month=req.month,
        year=req.year,
        basic_salary=salary.basic_salary,
        hra=salary.hra,
        transport_allowance=salary.transport_allowance,
        medical_allowance=salary.medical_allowance,
        special_allowance=salary.special_allowance,
        gross_salary=gross_salary,
        pf_deduction=salary.pf_deduction,
        tax_deduction=salary.tax_deduction,
        other_deductions=base_other_deductions + leave_deduction,
        total_deductions=total_deductions,
        net_salary=net_salary,
        days_worked=days_present,
        days_present=days_present,
        leaves_taken=leave_days,
        status="processed",
        processed_at=datetime.utcnow()
    )

    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return payroll

@router.get("/employee/{employee_id}", response_model=List[schemas.PayrollRecordOut])
def get_employee_payroll(employee_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    if current_user.role not in ["admin", "hr_manager", "finance"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    records = db.query(database.PayrollRecord).filter(database.PayrollRecord.employee_id == employee_id).order_by(database.PayrollRecord.year.desc(), database.PayrollRecord.month.desc()).all()
    return records
