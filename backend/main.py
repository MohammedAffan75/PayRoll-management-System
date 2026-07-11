import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import database
from database import init_db, SessionLocal, Employee
from auth import get_password_hash, require_admin, get_current_user
from routers import auth, employees, payroll, management, reports, attendance, leaves, departments, profile, export, employee_portal
from sqlalchemy import func
from sqlalchemy.orm import Session

import sys
import os

app = FastAPI(title="Payroll Management System API", version="1.0.0")

cors_origins_str = os.getenv("CORS_ORIGINS", "")
if cors_origins_str:
    origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
else:
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["payroll"])
app.include_router(management.router, prefix="/api/management", tags=["management"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(leaves.router, prefix="/api/leaves", tags=["leaves"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(employee_portal.router, prefix="/api/employee", tags=["employee"])

@app.get("/api/dashboard/stats", tags=["dashboard"])
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    from datetime import datetime, date, timedelta
    
    if current_user.role == "admin":
        # Admin dashboard - full overview
        total_emp = db.query(database.Employee).count()
        active_emp = db.query(database.Employee).filter(database.Employee.is_active == True).count()
        pending_leaves = db.query(database.LeaveRecord).filter(database.LeaveRecord.status == "pending").count()
        
        # Current month payroll
        current_month = datetime.now().month
        current_year = datetime.now().year
        current_month_payroll = db.query(func.sum(database.PayrollRecord.net_salary)).filter(
            database.PayrollRecord.month == current_month,
            database.PayrollRecord.year == current_year
        ).scalar() or 0
        
        # Department distribution
        dept_dist = db.query(database.Employee.department, func.count(database.Employee.id)).filter(
            database.Employee.is_active == True
        ).group_by(database.Employee.department).all()
        
        department_chart = [{"name": d or "Unassigned", "count": c} for d, c in dept_dist if d]
        
        # Recent payroll records
        recent_payroll = db.query(database.PayrollRecord).order_by(
            database.PayrollRecord.processed_at.desc()
        ).limit(5).all()
        
        recent_payroll_data = []
        for p in recent_payroll:
            emp = db.query(database.Employee).filter(database.Employee.id == p.employee_id).first()
            recent_payroll_data.append({
                "id": p.id,
                "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
                "month": p.month,
                "year": p.year,
                "net_salary": p.net_salary,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None
            })
        
        # Monthly payroll trend (last 6 months)
        monthly_trend = []
        for i in range(5, -1, -1):
            month_date = date.today() - timedelta(days=i*30)
            month_total = db.query(func.sum(database.PayrollRecord.net_salary)).filter(
                database.PayrollRecord.month == month_date.month,
                database.PayrollRecord.year == month_date.year
            ).scalar() or 0
            monthly_trend.append({
                "month": month_date.strftime("%b %Y"),
                "total": month_total
            })
        
        # Today's attendance
        today = date.today()
        today_attendance = db.query(database.AttendanceRecord).filter(
            database.AttendanceRecord.date == today
        ).count()
        
        # Upcoming leaves
        upcoming_leaves = db.query(database.LeaveRecord).filter(
            database.LeaveRecord.status == "approved",
            database.LeaveRecord.start_date >= today,
            database.LeaveRecord.start_date <= today + timedelta(days=30)
        ).order_by(database.LeaveRecord.start_date).limit(5).all()
        
        upcoming_leaves_data = []
        for l in upcoming_leaves:
            emp = db.query(database.Employee).filter(database.Employee.id == l.employee_id).first()
            upcoming_leaves_data.append({
                "id": l.id,
                "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
                "start_date": l.start_date.isoformat(),
                "end_date": l.end_date.isoformat(),
                "days": l.days
            })
        
        return {
            "user_role": "admin",
            "overview": {
                "total_employees": total_emp,
                "active_employees": active_emp,
                "inactive_employees": total_emp - active_emp,
                "pending_leaves": pending_leaves,
                "current_month_payroll": current_month_payroll,
                "today_attendance": today_attendance
            },
            "department_distribution": department_chart,
            "monthly_payroll_trend": monthly_trend,
            "recent_payroll": recent_payroll_data,
            "upcoming_leaves": upcoming_leaves_data
        }
    
    else:
        # Employee dashboard - personal data only
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
        
        # Recent payroll records
        recent_payroll = db.query(database.PayrollRecord).filter(
            database.PayrollRecord.employee_id == current_user.id
        ).order_by(database.PayrollRecord.processed_at.desc()).limit(3).all()
        
        recent_payroll_data = []
        for p in recent_payroll:
            recent_payroll_data.append({
                "id": p.id,
                "month": p.month,
                "year": p.year,
                "net_salary": p.net_salary,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None
            })
        
        # Recent leave requests
        recent_leaves = db.query(database.LeaveRecord).filter(
            database.LeaveRecord.employee_id == current_user.id
        ).order_by(database.LeaveRecord.applied_at.desc()).limit(3).all()
        
        recent_leaves_data = []
        for l in recent_leaves:
            recent_leaves_data.append({
                "id": l.id,
                "leave_type": l.leave_type,
                "start_date": l.start_date.isoformat(),
                "end_date": l.end_date.isoformat(),
                "days": l.days,
                "status": l.status,
                "applied_at": l.applied_at.isoformat() if l.applied_at else None
            })
        
        return {
            "user_role": "employee",
            "employee": {
                "id": current_user.id,
                "name": f"{current_user.first_name} {current_user.last_name}",
                "email": current_user.email,
                "department": current_user.department,
                "designation": current_user.designation,
                "employee_id": current_user.employee_id
            },
            "summary": {
                "payroll_records": payroll_count,
                "attendance_this_month": attendance_count,
                "pending_leave_requests": pending_leaves,
                "approved_leaves_this_year": approved_leaves
            },
            "salary_info": salary_info,
            "recent_payroll": recent_payroll_data,
            "recent_leaves": recent_leaves_data
        }

@app.get("/api/admin/dashboard-stats", tags=["admin"])
def get_admin_dashboard_summary(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    total_emp = db.query(database.Employee).count()
    active_emp = db.query(database.Employee).filter(database.Employee.is_active == True).count()
    pending_leaves = db.query(database.LeaveRecord).filter(database.LeaveRecord.status == "pending").count()
    total_net_payroll = db.query(func.sum(database.PayrollRecord.net_salary)).scalar() or 0
    
    return {
        "total_employees": total_emp,
        "active_employees": active_emp,
        "pending_leaves": pending_leaves,
        "total_payroll": total_net_payroll
    }

@app.on_event("startup")
def on_startup():
    init_db()
    
    # Create default admin user if none exists
    db = SessionLocal()
    admin = db.query(Employee).filter(Employee.email == "admin@payroll.com").first()
    if not admin:
        admin_user = Employee(
            employee_id="ADM0001",
            first_name="System",
            last_name="Admin",
            email="admin@payroll.com",
            department="Administration",
            designation="Administrator",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
    db.close()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
