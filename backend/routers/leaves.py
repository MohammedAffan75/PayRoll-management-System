from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

@router.get("/", response_model=List[schemas.LeaveOut])
def get_all_leaves(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all leave requests with optional filters (Admin only)"""
    query = db.query(database.LeaveRecord)
    
    if status:
        query = query.filter(database.LeaveRecord.status == status)
    if employee_id:
        query = query.filter(database.LeaveRecord.employee_id == employee_id)
    
    return query.order_by(database.LeaveRecord.applied_at.desc()).all()

class LeaveBalance(BaseModel):
    leave_type: str
    entitled: int
    used: int
    remaining: int

class LeaveTypeCreate(BaseModel):
    name: str
    description: str
    days_per_year: int
    carry_forward: bool = False

# ─── Leave Management ────────────────────────────────────────────────────────

@router.get("/my/requests")
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
    
    records = query.order_by(database.LeaveRecord.applied_at.desc()).all()
    
    return {
        "employee_id": current_user.id,
        "total_requests": len(records),
        "requests": [
            {
                "id": r.id,
                "leave_type": r.leave_type,
                "start_date": r.start_date.isoformat(),
                "end_date": r.end_date.isoformat(),
                "days": r.days,
                "reason": r.reason,
                "status": r.status,
                "applied_at": r.applied_at.isoformat() if r.applied_at else None
            }
            for r in records
        ]
    }

@router.get("/my/balance")
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

@router.get("/admin/all")
def get_all_leave_requests(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all leave requests with filters (Admin only)"""
    query = db.query(database.LeaveRecord)
    
    if status:
        query = query.filter(database.LeaveRecord.status == status)
    if employee_id:
        query = query.filter(database.LeaveRecord.employee_id == employee_id)
    if start_date:
        query = query.filter(database.LeaveRecord.start_date >= start_date)
    if end_date:
        query = query.filter(database.LeaveRecord.end_date <= end_date)
    
    records = query.order_by(database.LeaveRecord.applied_at.desc()).all()
    
    result = []
    for r in records:
        employee = db.query(database.Employee).filter(database.Employee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name}" if employee else "Unknown",
            "employee_department": employee.department if employee else None,
            "leave_type": r.leave_type,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "days": r.days,
            "reason": r.reason,
            "status": r.status,
            "applied_at": r.applied_at.isoformat() if r.applied_at else None
        })
    
    return {
        "total_requests": len(result),
        "requests": result
    }

@router.get("/admin/summary")
def get_leave_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get leave summary for a month/year"""
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    # Get leaves for the month
    from datetime import date as dt_date
    start_date = dt_date(year, month, 1)
    if month == 12:
        end_date = dt_date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = dt_date(year, month + 1, 1) - timedelta(days=1)
    
    records = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.start_date <= end_date,
        database.LeaveRecord.end_date >= start_date
    ).all()
    
    # Summary by status
    status_summary = {}
    for r in records:
        status_summary[r.status] = status_summary.get(r.status, 0) + 1
    
    # Summary by leave type
    type_summary = {}
    for r in records:
        type_summary[r.leave_type] = type_summary.get(r.leave_type, 0) + r.days
    
    # Summary by department
    dept_summary = {}
    for r in records:
        emp = db.query(database.Employee).filter(database.Employee.id == r.employee_id).first()
        if emp:
            dept = emp.department or "Unknown"
            if dept not in dept_summary:
                dept_summary[dept] = {"count": 0, "days": 0}
            dept_summary[dept]["count"] += 1
            dept_summary[dept]["days"] += r.days
    
    return {
        "month": month,
        "year": year,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "total_requests": len(records),
        "by_status": status_summary,
        "by_type": type_summary,
        "by_department": dept_summary
    }

@router.get("/admin/employee/{employee_id}/history")
def get_employee_leave_history(
    employee_id: int,
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get detailed leave history for an employee"""
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if not year:
        year = datetime.now().year
    
    records = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.employee_id == employee_id,
        func.extract('year', database.LeaveRecord.start_date) == year
    ).order_by(database.LeaveRecord.start_date.desc()).all()
    
    # Calculate statistics
    approved_days = sum(r.days for r in records if r.status == "approved")
    pending_days = sum(r.days for r in records if r.status == "pending")
    rejected_days = sum(r.days for r in records if r.status == "rejected")
    
    return {
        "employee": {
            "id": employee_id,
            "name": f"{employee.first_name} {employee.last_name}",
            "employee_id": employee.employee_id,
            "department": employee.department
        },
        "year": year,
        "summary": {
            "total_requests": len(records),
            "approved_days": approved_days,
            "pending_days": pending_days,
            "rejected_days": rejected_days
        },
        "leave_requests": [
            {
                "id": r.id,
                "leave_type": r.leave_type,
                "start_date": r.start_date.isoformat(),
                "end_date": r.end_date.isoformat(),
                "days": r.days,
                "reason": r.reason,
                "status": r.status,
                "applied_at": r.applied_at.isoformat() if r.applied_at else None
            }
            for r in records
        ]
    }

@router.put("/admin/{leave_id}/status")
def update_leave_status_admin(
    leave_id: int,
    status: str,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Update leave status (approve/reject)"""
    if status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be: approved, rejected, or pending")
    
    db_leave = db.query(database.LeaveRecord).filter(database.LeaveRecord.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    db_leave.status = status
    db.commit()
    db.refresh(db_leave)
    
    return {
        "id": leave_id,
        "status": status,
        "message": f"Leave request {status} successfully"
    }

@router.get("/calendar")
def get_leave_calendar(
    month: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get leave calendar showing who is on leave for a month"""
    from datetime import date as dt_date
    
    start_date = dt_date(year, month, 1)
    if month == 12:
        end_date = dt_date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = dt_date(year, month + 1, 1) - timedelta(days=1)
    
    # Get approved leaves for the period
    records = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.status == "approved",
        database.LeaveRecord.start_date <= end_date,
        database.LeaveRecord.end_date >= start_date
    ).all()
    
    # Build calendar data
    calendar_data = {}
    current = start_date
    while current <= end_date:
        calendar_data[current.isoformat()] = []
        current += timedelta(days=1)
    
    for r in records:
        employee = db.query(database.Employee).filter(database.Employee.id == r.employee_id).first()
        emp_name = f"{employee.first_name} {employee.last_name}" if employee else "Unknown"
        
        # Mark all days in the leave range
        leave_start = max(r.start_date, start_date)
        leave_end = min(r.end_date, end_date)
        
        current = leave_start
        while current <= leave_end:
            if current.isoformat() in calendar_data:
                calendar_data[current.isoformat()].append({
                    "employee_id": r.employee_id,
                    "employee_name": emp_name,
                    "leave_type": r.leave_type
                })
            current += timedelta(days=1)
    
    return {
        "month": month,
        "year": year,
        "calendar": calendar_data
    }

@router.post("/cancel/{leave_id}")
def cancel_leave_request(
    leave_id: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Cancel own pending leave request"""
    db_leave = db.query(database.LeaveRecord).filter(
        database.LeaveRecord.id == leave_id,
        database.LeaveRecord.employee_id == current_user.id
    ).first()
    
    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    if db_leave.status != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending leave requests")
    
    db.delete(db_leave)
    db.commit()
    
    return {"message": "Leave request cancelled successfully"}
