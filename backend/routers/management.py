from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

# ─── Attendance ───────────────────────────────────────────────────────────────
@router.post("/attendance/check-in", response_model=schemas.AttendanceOut)
def check_in(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    today = date.today()
    existing = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id == current_user.id,
        database.AttendanceRecord.date == today
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in for today")
    
    record = database.AttendanceRecord(
        employee_id=current_user.id,
        date=today,
        check_in=datetime.now(),
        status="present"
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.get("/attendance/me", response_model=List[schemas.AttendanceOut])
def get_my_attendance(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    return db.query(database.AttendanceRecord).filter(database.AttendanceRecord.employee_id == current_user.id).all()

# ─── Leaves ───────────────────────────────────────────────────────────────────
@router.post("/leaves/apply", response_model=schemas.LeaveOut)
def apply_leave(leave: schemas.LeaveCreate, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    leave_type = (leave.leave_type or "").lower()
    employee_gender = (current_user.gender or "other").lower()
    if leave_type == "maternity" and employee_gender != "female":
        raise HTTPException(status_code=400, detail="Maternity leave is available for female employees only")
    if leave_type == "paternity" and employee_gender != "male":
        raise HTTPException(status_code=400, detail="Paternity leave is available for male employees only")

    days = (leave.end_date - leave.start_date).days + 1
    if days <= 0:
        raise HTTPException(status_code=400, detail="Invalid date range")
    
    db_leave = database.LeaveRecord(
        employee_id=current_user.id,
        leave_type=leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        days=days,
        reason=leave.reason,
        status="pending"
    )
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    return db_leave

@router.get("/leaves/pending", response_model=List[schemas.LeaveOut])
def get_pending_leaves(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    return db.query(database.LeaveRecord).filter(database.LeaveRecord.status == "pending").all()

@router.put("/leaves/{leave_id}/approve", response_model=schemas.LeaveOut)
def approve_leave(leave_id: int, update: schemas.LeaveUpdate, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    db_leave = db.query(database.LeaveRecord).filter(database.LeaveRecord.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    db_leave.status = update.status
    db.commit()
    db.refresh(db_leave)
    return db_leave

@router.post("/leaves/{leave_id}/approve", response_model=schemas.LeaveOut)
def approve_leave_post(leave_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    db_leave = db.query(database.LeaveRecord).filter(database.LeaveRecord.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")
    db_leave.status = "approved"
    db.commit()
    db.refresh(db_leave)
    return db_leave

@router.post("/leaves/{leave_id}/reject", response_model=schemas.LeaveOut)
def reject_leave_post(leave_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    db_leave = db.query(database.LeaveRecord).filter(database.LeaveRecord.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")
    db_leave.status = "rejected"
    db.commit()
    db.refresh(db_leave)
    return db_leave
