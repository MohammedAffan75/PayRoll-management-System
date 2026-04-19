from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Fixed departments router
import database
from auth import require_admin, get_current_user

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_all_departments(db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    """Get all departments (Admin only)"""
    # Get unique departments from employees
    departments_query = db.query(database.Employee.department).filter(database.Employee.department.isnot(None)).distinct()
    departments = departments_query.all()
    
    result = []
    for dept_tuple in departments:
        dept_name = dept_tuple[0]
        if dept_name:  # Ensure department name is not null
            # Get employee count for this department
            employee_count = db.query(database.Employee).filter(database.Employee.department == dept_name).count()
            
            # Get total salary budget for this department (calculated net salary)
            salaries = db.query(database.SalaryStructure).join(database.Employee).filter(database.Employee.department == dept_name).all()
            total_budget = sum(
                (s.basic_salary + s.hra + s.transport_allowance + s.medical_allowance + s.special_allowance 
                 - s.pf_deduction - s.tax_deduction - s.other_deductions) for s in salaries
            )
            
            # Get active employee count
            active_count = db.query(database.Employee).filter(
                database.Employee.department == dept_name,
                database.Employee.is_active == True
            ).count()
            
            result.append({
                "name": dept_name,
                "employee_count": employee_count,
                "active_employee_count": active_count,
                "total_budget": total_budget,
                "avg_salary": total_budget / active_count if active_count > 0 else 0
            })
    
    return sorted(result, key=lambda x: x["employee_count"], reverse=True)

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None

@router.get("/list")
def get_departments(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(get_current_user)
):
    """Get all departments with employee counts"""
    # Get unique departments from employees
    departments = db.query(database.Employee.department).distinct().all()
    
    result = []
    for (dept_name,) in departments:
        if dept_name:
            emp_count = db.query(database.Employee).filter(
                database.Employee.department == dept_name,
                database.Employee.is_active == True
            ).count()
            
            # Get manager (first admin/HR in department)
            manager = db.query(database.Employee).filter(
                database.Employee.department == dept_name,
                database.Employee.role.in_(["admin", "hr_manager"])
            ).first()
            
            # Get total salary for department
            total_salary = db.query(func.sum(database.SalaryStructure.basic_salary)).join(
                database.Employee
            ).filter(
                database.Employee.department == dept_name
            ).scalar() or 0
            
            result.append({
                "name": dept_name,
                "employee_count": emp_count,
                "manager": f"{manager.first_name} {manager.last_name}" if manager else None,
                "manager_id": manager.id if manager else None,
                "total_payroll": total_salary
            })
    
    return {"departments": result, "total_count": len(result)}

@router.get("/{dept_name}/employees")
def get_department_employees(
    dept_name: str,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get all employees in a department"""
    employees = db.query(database.Employee).filter(
        database.Employee.department == dept_name
    ).all()
    
    if not employees:
        raise HTTPException(status_code=404, detail="Department not found or empty")
    
    return {
        "department": dept_name,
        "total_employees": len(employees),
        "employees": [
            {
                "id": e.id,
                "employee_id": e.employee_id,
                "name": f"{e.first_name} {e.last_name}",
                "email": e.email,
                "designation": e.designation,
                "is_active": e.is_active,
                "role": e.role,
                "date_of_joining": e.date_of_joining.isoformat() if e.date_of_joining else None
            }
            for e in employees
        ]
    }

@router.get("/{dept_name}/statistics")
def get_department_statistics(
    dept_name: str,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get detailed statistics for a department"""
    employees = db.query(database.Employee).filter(
        database.Employee.department == dept_name
    ).all()
    
    if not employees:
        raise HTTPException(status_code=404, detail="Department not found")
    
    emp_ids = [e.id for e in employees]
    
    # Calculate statistics
    total_emp = len(employees)
    active_emp = len([e for e in employees if e.is_active])
    
    # Salary statistics
    salary_stats = db.query(
        func.avg(database.SalaryStructure.basic_salary).label('avg'),
        func.min(database.SalaryStructure.basic_salary).label('min'),
        func.max(database.SalaryStructure.basic_salary).label('max'),
        func.sum(database.SalaryStructure.basic_salary).label('total')
    ).filter(
        database.SalaryStructure.employee_id.in_(emp_ids)
    ).first()
    
    # Attendance rate (last 30 days)
    from datetime import date, timedelta
    thirty_days_ago = date.today() - timedelta(days=30)
    
    attendance_records = db.query(database.AttendanceRecord).filter(
        database.AttendanceRecord.employee_id.in_(emp_ids),
        database.AttendanceRecord.date >= thirty_days_ago
    ).all()
    
    present_count = len([a for a in attendance_records if a.status == "present"])
    attendance_rate = (present_count / len(attendance_records) * 100) if attendance_records else 0
    
    # Role distribution
    role_distribution = {}
    for e in employees:
        role_distribution[e.role] = role_distribution.get(e.role, 0) + 1
    
    return {
        "department": dept_name,
        "employee_stats": {
            "total": total_emp,
            "active": active_emp,
            "inactive": total_emp - active_emp
        },
        "salary_stats": {
            "average": round(salary_stats.avg, 2) if salary_stats.avg else 0,
            "minimum": salary_stats.min or 0,
            "maximum": salary_stats.max or 0,
            "total_monthly": salary_stats.total or 0
        },
        "attendance_rate": round(attendance_rate, 2),
        "role_distribution": role_distribution
    }

@router.put("/reassign/{employee_id}")
def reassign_employee_department(
    employee_id: int,
    new_department: str,
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Reassign employee to a different department"""
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    old_department = employee.department
    employee.department = new_department
    db.commit()
    
    return {
        "employee_id": employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "old_department": old_department,
        "new_department": new_department,
        "message": f"Employee reassigned to {new_department}"
    }

@router.get("/summary/all")
def get_all_departments_summary(
    db: Session = Depends(database.get_db),
    current_user: database.Employee = Depends(require_admin)
):
    """Get summary of all departments for organization chart"""
    departments = db.query(database.Employee.department, func.count(database.Employee.id)).filter(
        database.Employee.is_active == True
    ).group_by(database.Employee.department).all()
    
    total_employees = sum(count for _, count in departments)
    
    dept_list = []
    for dept_name, count in departments:
        if dept_name:
            # Get department head
            head = db.query(database.Employee).filter(
                database.Employee.department == dept_name,
                database.Employee.role.in_(["admin", "hr_manager"])
            ).first()
            
            dept_list.append({
                "name": dept_name,
                "employee_count": count,
                "percentage": round((count / total_employees * 100), 2) if total_employees > 0 else 0,
                "head": f"{head.first_name} {head.last_name}" if head else None
            })
    
    return {
        "total_departments": len(dept_list),
        "total_employees": total_employees,
        "departments": sorted(dept_list, key=lambda x: x["employee_count"], reverse=True)
    }
