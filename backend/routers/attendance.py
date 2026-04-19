from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

class AttendanceMarkRequest(BaseModel):
    employee_id: int
    date: date
    status: str = "present"
    check_in: Optional[str] = None
    check_out: Optional[str] = None

class BulkAttendanceRequest(BaseModel):
    employee_ids: List[int]
    date: date
    status: str = "present"

# ─── Admin Attendance Management ─────────────────────────────────────────────

@router.get("/admin/all", response_model=List[schemas.AttendanceOut])
def get_all_attendance(
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all attendance records with filters (Admin only)"""
    query = db.query(database.AttendanceRecord)
    
    if employee_id:
        query = query.filter(database.AttendanceRecord.employee_id == employee_id)
    if start_date:
        query = query.filter(database.AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(database.AttendanceRecord.date <= end_date)
    if status:
        query = query.filter(database.AttendanceRecord.status == status)
    
    return query.order_by(database.AttendanceRecord.date.desc()).all()

@router.post("/admin/mark", response_model=schemas.AttendanceOut)
def mark_attendance_admin(
    data: AttendanceMarkRequest,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Mark attendance for an employee (Admin only)"""
    # Check if employee exists
    emp = db.query(database.Employee).filter(database.Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if attendance already exists
    existing = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == data.employee_id,
        database.AttendanceRecord.date == data.date
    ).first()
    
    check_in_time = None
    check_out_time = None
    
    if data.check_in:
        hour, minute = map(int, data.check_in.split(':'))
        check_in_time = datetime.combine(data.date, datetime.min.time().replace(hour=hour, minute=minute))
    
    if data.check_out:
        hour, minute = map(int, data.check_out.split(':'))
        check_out_time = datetime.combine(data.date, datetime.min.time().replace(hour=hour, minute=minute))
    
    if existing:
        # Update existing
        existing.status = data.status
        if check_in_time:
            existing.check_in = check_in_time
        if check_out_time:
            existing.check_out = check_out_time
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        record = database.AttendanceRecord(
            employee_id=data.employee_id,
            date=data.date,
            check_in=check_in_time or datetime.now(),
            check_out=check_out_time,
            status=data.status
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

@router.post("/admin/bulk-mark")
def bulk_mark_attendance(
    data: BulkAttendanceRequest,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Mark attendance for multiple employees at once"""
    results = []
    errors = []
    
    for emp_id in data.employee_ids:
        try:
            # Check if employee exists
            emp = db.query(database.Employee).filter(database.Employee.id == emp_id).first()
            if not emp:
                errors.append({"employee_id": emp_id, "error": "Employee not found"})
                continue
            
            # Check if attendance already exists
            existing = db.query(database.AttendanceRecord).filter(
                database.AttendanceRecord.employee_id == emp_id,
                database.AttendanceRecord.date == data.date
            ).first()
            
            if existing:
                existing.status = data.status
                db.commit()
                results.append({
                    "employee_id": emp_id,
                    "employee_name": f"{emp.first_name} {emp.last_name}",
                    "status": "updated",
                    "attendance_status": data.status
                })
            else:
                record = database.AttendanceRecord(
                    employee_id=emp_id,
                    date=data.date,
                    check_in=datetime.now(),
                    status=data.status
                )
                db.add(record)
                db.commit()
                results.append({
                    "employee_id": emp_id,
                    "employee_name": f"{emp.first_name} {emp.last_name}",
                    "status": "created",
                    "attendance_status": data.status
                })
        except Exception as e:
            errors.append({"employee_id": emp_id, "error": str(e)})
    
    return {
        "success_count": len(results),
        "error_count": len(errors),
        "results": results,
        "errors": errors
    }

@router.get("/admin/summary")
def get_attendance_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get attendance summary for a date range"""
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    
    records = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.date >= start_date,
        database.AttendanceRecord.date <= end_date
    ).all()
    
    total_days = (end_date - start_date).days + 1
    total_employees = db.query(database.Employee).filter(database.Employee.is_active == True).count()
    
    status_counts = {}
    for r in records:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    
    # Calculate daily attendance rate
    expected_attendance = total_employees * total_days
    actual_present = status_counts.get('present', 0)
    attendance_rate = (actual_present / expected_attendance * 100) if expected_attendance > 0 else 0
    
    return {
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "total_days": total_days
        },
        "total_active_employees": total_employees,
        "total_records": len(records),
        "status_breakdown": status_counts,
        "attendance_rate": round(attendance_rate, 2),
        "expected_attendance": expected_attendance
    }

@router.get("/admin/employee/{employee_id}/report")
def get_employee_attendance_report(
    employee_id: int,
    month: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get detailed attendance report for a specific employee"""
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Calculate date range for the month
    from datetime import date as dt_date
    start_date = dt_date(year, month, 1)
    if month == 12:
        end_date = dt_date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = dt_date(year, month + 1, 1) - timedelta(days=1)
    
    records = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == employee_id,
        database.AttendanceRecord.date >= start_date,
        database.AttendanceRecord.date <= end_date
    ).order_by(database.AttendanceRecord.date).all()
    
    # Calculate working days (excluding weekends)
    total_working_days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:  # Monday = 0, Friday = 4
            total_working_days += 1
        current += timedelta(days=1)
    
    present_days = len([r for r in records if r.status == "present"])
    absent_days = len([r for r in records if r.status == "absent"])
    leave_days = len([r for r in records if r.status == "leave"])
    
    # Days not marked
    marked_dates = {r.date for r in records}
    unmarked_days = []
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in marked_dates:
            unmarked_days.append(current.isoformat())
        current += timedelta(days=1)
    
    return {
        "employee": {
            "id": employee_id,
            "name": f"{employee.first_name} {employee.last_name}",
            "employee_id": employee.employee_id,
            "department": employee.department
        },
        "month": month,
        "year": year,
        "total_working_days": total_working_days,
        "present_days": present_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "attendance_percentage": round((present_days / total_working_days * 100), 2) if total_working_days > 0 else 0,
        "unmarked_days": unmarked_days,
        "detailed_records": [
            {
                "date": r.date.isoformat(),
                "status": r.status,
                "check_in": r.check_in.isoformat() if r.check_in else None,
                "check_out": r.check_out.isoformat() if r.check_out else None
            }
            for r in records
        ]
    }

# ─── Employee Self-Service ──────────────────────────────────────────────────

@router.get("/my/history")
def get_my_attendance_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's attendance history"""
    query = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id
    )
    
    if start_date:
        query = query.filter(database.AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(database.AttendanceRecord.date <= end_date)
    
    records = query.order_by(database.AttendanceRecord.date.desc()).all()
    
    # Calculate statistics
    total_present = len([r for r in records if r.status == "present"])
    total_absent = len([r for r in records if r.status == "absent"])
    total_leave = len([r for r in records if r.status == "leave"])
    
    return {
        "employee_id": current_user.id,
        "employee_name": f"{current_user.first_name} {current_user.last_name}",
        "total_records": len(records),
        "summary": {
            "present": total_present,
            "absent": total_absent,
            "leave": total_leave
        },
        "records": [
            {
                "date": r.date.isoformat(),
                "status": r.status,
                "check_in": r.check_in.isoformat() if r.check_in else None,
                "check_out": r.check_out.isoformat() if r.check_out else None
            }
            for r in records
        ]
    }

@router.get("/my/stats")
def get_my_attendance_stats(
    month: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get current user's attendance statistics for a specific month"""
    from datetime import date as dt_date
    
    start_date = dt_date(year, month, 1)
    if month == 12:
        end_date = dt_date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = dt_date(year, month + 1, 1) - timedelta(days=1)
    
    records = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        database.AttendanceRecord.date >= start_date,
        database.AttendanceRecord.date <= end_date
    ).all()
    
    # Calculate working days
    total_working_days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            total_working_days += 1
        current += timedelta(days=1)
    
    present_days = len([r for r in records if r.status == "present"])
    absent_days = len([r for r in records if r.status == "absent"])
    leave_days = len([r for r in records if r.status == "leave"])
    
    return {
        "month": month,
        "year": year,
        "employee_name": f"{current_user.first_name} {current_user.last_name}",
        "total_working_days": total_working_days,
        "present_days": present_days,
        "absent_days": absent_days,
        "leave_days": leave_days,
        "attendance_percentage": round((present_days / total_working_days * 100), 2) if total_working_days > 0 else 0
    }

@router.post("/my/check-in")
def check_in(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Check in for the day"""
    today = date.today()
    current_time = datetime.now()
    
    # Check if already checked in today
    existing = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        database.AttendanceRecord.date == today
    ).first()
    
    if existing:
        if existing.check_in:
            raise HTTPException(status_code=400, detail="Already checked in today")
        else:
            # Update existing record with check-in time
            existing.check_in = current_time
            existing.status = "present"
            db.commit()
            return existing
    
    # Create new attendance record
    record = database.AttendanceRecord(
        employee_id=current_user.id,
        date=today,
        check_in=current_time,
        status="present"
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.post("/my/check-out")
def check_out(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Check out for the day"""
    today = date.today()
    current_time = datetime.now()
    
    record = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        database.AttendanceRecord.date == today
    ).first()
    
    if not record:
        raise HTTPException(status_code=400, detail="No check-in record found for today")
    
    if record.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")
    
    record.check_out = current_time
    db.commit()
    db.refresh(record)
    return {
        "message": "Checked out successfully",
        "check_out_time": record.check_out.isoformat(),
        "date": today.isoformat()
    }
