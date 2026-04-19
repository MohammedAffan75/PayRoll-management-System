import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

import database
from auth import require_admin

router = APIRouter()

@router.get("/employees/csv")
def export_employees_csv(
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Export employees data to CSV"""
    query = db.query(database.Employee)
    
    if department:
        query = query.filter(database.Employee.department == department)
    if is_active is not None:
        query = query.filter(database.Employee.is_active == is_active)
    
    employees = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Employee ID', 'First Name', 'Last Name', 'Email', 'Phone',
        'Department', 'Designation', 'Role', 'Date of Joining', 'Is Active'
    ])
    
    # Data
    for emp in employees:
        writer.writerow([
            emp.employee_id,
            emp.first_name,
            emp.last_name,
            emp.email,
            emp.phone or '',
            emp.department or '',
            emp.designation or '',
            emp.role,
            emp.date_of_joining.isoformat() if emp.date_of_joining else '',
            'Yes' if emp.is_active else 'No'
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=employees_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@router.get("/payroll/csv")
def export_payroll_csv(
    month: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Export payroll data for a specific month to CSV"""
    records = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.month == month,
        database.PayrollRecord.year == year
    ).all()
    
    if not records:
        raise HTTPException(status_code=404, detail="No payroll records found for this period")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Employee ID', 'Employee Name', 'Month', 'Year',
        'Basic Salary', 'HRA', 'Transport', 'Medical', 'Special', 'Gross Salary',
        'PF', 'Tax', 'Other Deductions', 'Total Deductions', 'Net Salary',
        'Days Worked', 'Days Present', 'Leaves Taken', 'Status'
    ])
    
    # Data
    for record in records:
        emp = db.query(database.Employee).filter(database.Employee.id == record.employee_id).first()
        emp_name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
        emp_id = emp.employee_id if emp else "Unknown"
        
        writer.writerow([
            emp_id,
            emp_name,
            record.month,
            record.year,
            record.basic_salary,
            record.hra,
            record.transport_allowance,
            record.medical_allowance,
            record.special_allowance,
            record.gross_salary,
            record.pf_deduction,
            record.tax_deduction,
            record.other_deductions,
            record.total_deductions,
            record.net_salary,
            record.days_worked,
            record.days_present,
            record.leaves_taken,
            record.status
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=payroll_{month}_{year}.csv"}
    )

@router.get("/attendance/csv")
def export_attendance_csv(
    start_date: str,
    end_date: str,
    department: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Export attendance data to CSV"""
    from datetime import date as dt_date
    
    start = dt_date.fromisoformat(start_date)
    end = dt_date.fromisoformat(end_date)
    
    query = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.date >= start,
        database.AttendanceRecord.date <= end
    )
    
    records = query.order_by(database.AttendanceRecord.date).all()
    
    # Filter by department if specified
    if department:
        filtered_records = []
        for r in records:
            emp = db.query(database.Employee).filter(database.Employee.id == r.employee_id).first()
            if emp and emp.department == department:
                filtered_records.append((r, emp))
        records = filtered_records
    else:
        records = [(r, db.query(database.Employee).filter(database.Employee.id == r.employee_id).first()) for r in records]
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Date', 'Employee ID', 'Employee Name', 'Department',
        'Status', 'Check In', 'Check Out'
    ])
    
    # Data
    for record, emp in records:
        writer.writerow([
            record.date.isoformat(),
            emp.employee_id if emp else 'Unknown',
            f"{emp.first_name} {emp.last_name}" if emp else 'Unknown',
            emp.department if emp else 'Unknown',
            record.status,
            record.check_in.strftime('%H:%M') if record.check_in else '',
            record.check_out.strftime('%H:%M') if record.check_out else ''
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{start_date}_to_{end_date}.csv"}
    )
