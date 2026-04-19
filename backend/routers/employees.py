from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import database
import schemas
from auth import get_current_user, require_admin

router = APIRouter()

@router.get("/", response_model=List[schemas.EmployeeOut])
def get_employees(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
    employees = db.query(database.Employee).filter(
        database.Employee.role != "admin"
    ).offset(skip).limit(limit).all()
    return employees

@router.get("/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(get_current_user)):
    # User can see their own profile, admins can see any profile
    if current_user.role not in ["admin", "hr_manager"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this profile")
        
    employee = db.query(database.Employee).filter(database.Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.put("/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(employee_id: int, emp_in: schemas.EmployeeUpdate, db: Session = Depends(database.get_db), current_user: database.Employee = Depends(require_admin)):
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
    if current_user.role not in ["admin", "hr_manager", "finance"] and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_salary = db.query(database.SalaryStructure).filter(database.SalaryStructure.employee_id == employee_id).first()
    if not db_salary:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    return db_salary
