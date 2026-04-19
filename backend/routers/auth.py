from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any
import uuid
from datetime import timedelta

import database
import schemas
from auth import verify_password, get_password_hash, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
def login(db: Session = Depends(database.get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(database.Employee).filter(database.Employee.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    user_data = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "gender": user.gender
    }
    return {"access_token": access_token, "token_type": "bearer", "user": user_data}

@router.post("/register", response_model=schemas.EmployeeOut)
def register(employee: schemas.EmployeeCreate, db: Session = Depends(database.get_db)):
    db_emp = db.query(database.Employee).filter(database.Employee.email == employee.email).first()
    if db_emp:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate employee ID
    emp_count = db.query(database.Employee).count()
    emp_id = f"EMP{emp_count + 1:04d}"
    
    hashed_password = get_password_hash(employee.password)
    db_employee = database.Employee(
        employee_id=emp_id,
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        phone=employee.phone,
        department=employee.department,
        designation=employee.designation,
        gender=(employee.gender or "other").lower(),
        date_of_joining=employee.date_of_joining,
        hashed_password=hashed_password,
        role=employee.role or "employee"
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@router.get("/me", response_model=schemas.EmployeeOut)
def read_users_me(current_user: database.Employee = Depends(get_current_user)):
    return current_user
