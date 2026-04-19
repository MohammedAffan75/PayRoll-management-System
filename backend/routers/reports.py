from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, timedelta
from io import BytesIO
import calendar

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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

@router.get("/payslip/{payroll_id}")
def download_payslip(payroll_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    """Generate and download payslip as PDF"""
    payroll = db.query(database.PayrollRecord).filter(database.PayrollRecord.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    # Check authorization
    if current_user.role not in ["admin", "hr_manager", "finance"] and current_user.id != payroll.employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this payslip")
    
    employee = db.query(database.Employee).filter(database.Employee.id == payroll.employee_id).first()
    
    # Generate PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Center alignment
    )
    
    # Company Header
    elements.append(Paragraph("PAYROLL MANAGEMENT SYSTEM", title_style))
    elements.append(Paragraph("Payslip", styles['Heading2']))
    elements.append(Spacer(1, 20))
    
    # Employee Info
    emp_data = [
        ["Employee Name:", f"{employee.first_name} {employee.last_name}"],
        ["Employee ID:", employee.employee_id],
        ["Department:", employee.department or "N/A"],
        ["Designation:", employee.designation or "N/A"],
        ["Pay Period:", f"{payroll.month:02d}/{payroll.year}"],
        ["Date:", payroll.processed_at.strftime("%Y-%m-%d") if payroll.processed_at else "N/A"]
    ]
    
    emp_table = Table(emp_data, colWidths=[150, 300])
    emp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.grey),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (1, 0), (1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(emp_table)
    elements.append(Spacer(1, 30))
    
    # Earnings
    elements.append(Paragraph("EARNINGS", styles['Heading3']))
    earnings_data = [
        ["Description", "Amount"],
        ["Basic Salary", f"${payroll.basic_salary:,.2f}"],
        ["HRA", f"${payroll.hra:,.2f}"],
        ["Transport Allowance", f"${payroll.transport_allowance:,.2f}"],
        ["Medical Allowance", f"${payroll.medical_allowance:,.2f}"],
        ["Special Allowance", f"${payroll.special_allowance:,.2f}"],
        ["Gross Salary", f"${payroll.gross_salary:,.2f}"]
    ]
    
    earnings_table = Table(earnings_data, colWidths=[300, 150])
    earnings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(earnings_table)
    elements.append(Spacer(1, 20))
    
    # Deductions
    elements.append(Paragraph("DEDUCTIONS", styles['Heading3']))
    deductions_data = [
        ["Description", "Amount"],
        ["PF Deduction", f"${payroll.pf_deduction:,.2f}"],
        ["Tax Deduction", f"${payroll.tax_deduction:,.2f}"],
        ["Other Deductions", f"${payroll.other_deductions:,.2f}"],
        ["Total Deductions", f"${payroll.total_deductions:,.2f}"]
    ]
    
    deductions_table = Table(deductions_data, colWidths=[300, 150])
    deductions_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(deductions_table)
    elements.append(Spacer(1, 30))
    
    # Net Salary
    net_data = [["NET SALARY", f"${payroll.net_salary:,.2f}"]]
    net_table = Table(net_data, colWidths=[300, 150])
    net_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.green),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(net_table)
    elements.append(Spacer(1, 20))
    
    # Attendance Summary
    attendance_data = [
        ["Days Worked", str(payroll.days_worked)],
        ["Days Present", str(payroll.days_present)],
        ["Leaves Taken", str(payroll.leaves_taken)]
    ]
    attendance_table = Table(attendance_data, colWidths=[150, 150])
    attendance_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.grey),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(attendance_table)
    
    # Footer
    elements.append(Spacer(1, 40))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=1
    )
    elements.append(Paragraph("This is a computer-generated payslip and does not require signature.", footer_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))
    
    doc.build(elements)
    
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=payslip_{employee.employee_id}_{payroll.month}_{payroll.year}.pdf"
        }
    )

@router.get("/all", response_model=List[schemas.PayrollRecordOut])
def get_all_payroll(
    month: int = None,
    year: int = None,
    status: str = None,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all payroll records with optional filters"""
    query = db.query(database.PayrollRecord)
    
    if month:
        query = query.filter(database.PayrollRecord.month == month)
    if year:
        query = query.filter(database.PayrollRecord.year == year)
    if status:
        query = query.filter(database.PayrollRecord.status == status)
    
    return query.order_by(database.PayrollRecord.year.desc(), database.PayrollRecord.month.desc()).all()

@router.get("/summary/monthly")
def get_monthly_summary(
    month: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get monthly payroll summary"""
    records = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.month == month,
        database.PayrollRecord.year == year
    ).all()
    
    if not records:
        raise HTTPException(status_code=404, detail="No payroll records found for this period")
    
    total_gross = sum(r.gross_salary for r in records)
    total_deductions = sum(r.total_deductions for r in records)
    total_net = sum(r.net_salary for r in records)
    
    return {
        "month": month,
        "year": year,
        "total_employees": len(records),
        "total_gross_salary": total_gross,
        "total_deductions": total_deductions,
        "total_net_salary": total_net,
        "average_net_salary": total_net / len(records) if records else 0
    }

@router.get("/summary/employee/{employee_id}/yearly")
def get_yearly_summary(
    employee_id: int,
    year: int,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get yearly payroll summary for an employee"""
    # Check authorization
    if current_user.role not in ["admin", "hr_manager", "finance"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    records = db.query(database.PayrollRecord).filter(
        database.PayrollRecord.employee_id == employee_id,
        database.PayrollRecord.year == year
    ).order_by(database.PayrollRecord.month).all()
    
    monthly_data = []
    for r in records:
        monthly_data.append({
            "month": r.month,
            "month_name": datetime(2000, r.month, 1).strftime('%B'),
            "gross_salary": r.gross_salary,
            "total_deductions": r.total_deductions,
            "net_salary": r.net_salary
        })
    
    total_annual_gross = sum(r.gross_salary for r in records)
    total_annual_deductions = sum(r.total_deductions for r in records)
    total_annual_net = sum(r.net_salary for r in records)
    
    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "year": year,
        "total_months_processed": len(records),
        "total_annual_gross": total_annual_gross,
        "total_annual_deductions": total_annual_deductions,
        "total_annual_net": total_annual_net,
        "monthly_breakdown": monthly_data
    }

@router.post("/bulk-process")
def bulk_process_payroll(
    requests: List[schemas.PayrollProcessRequest],
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Process payroll for multiple employees at once"""
    results = []
    errors = []
    
    for req in requests:
        try:
            # Check if already processed
            existing = db.query(database.PayrollRecord).filter(
                database.PayrollRecord.employee_id == req.employee_id,
                database.PayrollRecord.month == req.month,
                database.PayrollRecord.year == req.year
            ).first()
            
            if existing:
                errors.append({
                    "employee_id": req.employee_id,
                    "error": f"Payroll already processed for {req.month}/{req.year}"
                })
                continue
            
            # Get employee & salary structure
            emp = db.query(database.Employee).filter(database.Employee.id == req.employee_id).first()
            if not emp:
                errors.append({
                    "employee_id": req.employee_id,
                    "error": "Employee not found"
                })
                continue
            
            salary = db.query(database.SalaryStructure).filter(
                database.SalaryStructure.employee_id == req.employee_id
            ).first()
            
            if not salary:
                errors.append({
                    "employee_id": req.employee_id,
                    "error": "Salary structure not defined"
                })
                continue
            
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
            
            results.append({
                "employee_id": req.employee_id,
                "employee_name": f"{emp.first_name} {emp.last_name}",
                "month": req.month,
                "year": req.year,
                "net_salary": net_salary,
                "status": "processed"
            })
            
        except Exception as e:
            errors.append({
                "employee_id": req.employee_id,
                "error": str(e)
            })
    
    return {
        "processed_count": len(results),
        "error_count": len(errors),
        "processed": results,
        "errors": errors
    }

@router.get("/payroll-summary")
def get_payroll_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Payroll summary across all time"""
    from sqlalchemy import func
    records = db.query(database.PayrollRecord).all()
    total_gross = sum(r.gross_salary for r in records)
    total_net = sum(r.net_salary for r in records)
    total_deductions = sum(r.total_deductions for r in records)

    by_month = {}
    for r in records:
        key = f"{r.year}-{r.month:02d}"
        if key not in by_month:
            by_month[key] = {"gross": 0, "net": 0, "count": 0}
        by_month[key]["gross"] += r.gross_salary
        by_month[key]["net"] += r.net_salary
        by_month[key]["count"] += 1

    return {
        "total_records": len(records),
        "total_gross_salary": total_gross,
        "total_net_salary": total_net,
        "total_deductions": total_deductions,
        "average_net_salary": total_net / len(records) if records else 0,
        "monthly_breakdown": by_month
    }


@router.get("/attendance-summary")
def get_attendance_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Attendance summary across all employees"""
    from sqlalchemy import func
    records = db.query(database.AttendanceRecord).all()
    total = len(records)
    by_status = {}
    for r in records:
        by_status[r.status] = by_status.get(r.status, 0) + 1

    employees = db.query(database.Employee).filter(database.Employee.is_active == True, database.Employee.role != "admin").all()
    per_employee = []
    for emp in employees:
        emp_records = [r for r in records if r.employee_id == emp.id]
        present = sum(1 for r in emp_records if r.status == "present")
        per_employee.append({
            "employee_id": emp.employee_id,
            "name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department,
            "total_days": len(emp_records),
            "present": present,
            "attendance_rate": round((present / len(emp_records)) * 100, 1) if emp_records else 0
        })

    return {
        "total_records": total,
        "by_status": by_status,
        "per_employee": per_employee
    }


@router.get("/leave-summary")
def get_leave_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Leave summary across all employees"""
    records = db.query(database.LeaveRecord).all()
    by_status = {}
    by_type = {}
    for r in records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        by_type[r.leave_type] = by_type.get(r.leave_type, 0) + r.days

    employees = db.query(database.Employee).filter(database.Employee.is_active == True, database.Employee.role != "admin").all()
    per_employee = []
    for emp in employees:
        emp_leaves = [r for r in records if r.employee_id == emp.id]
        approved_days = sum(r.days for r in emp_leaves if r.status == "approved")
        per_employee.append({
            "employee_id": emp.employee_id,
            "name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department,
            "total_requests": len(emp_leaves),
            "approved_days": approved_days
        })

    return {
        "total_requests": len(records),
        "by_status": by_status,
        "by_leave_type": by_type,
        "per_employee": per_employee
    }
