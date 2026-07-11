import os
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

# Import local models and helper functions
from database import Employee, init_db, SessionLocal
from auth import get_password_hash

def seed():
    print("Initializing database tables...")
    init_db()
    
    db = SessionLocal()
    try:
        admin_email = "admin@payroll.com"
        print(f"Checking if admin user '{admin_email}' exists...")
        admin = db.query(Employee).filter(Employee.email == admin_email).first()
        
        if not admin:
            print("Admin user not found. Creating default admin user...")
            admin_user = Employee(
                employee_id="ADM0001",
                first_name="System",
                last_name="Admin",
                email=admin_email,
                department="Administration",
                designation="Administrator",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Default admin user created successfully!")
            print("Credentials: Email: admin@payroll.com | Password: admin123")
        else:
            print(f"Admin user already exists! (ID: {admin.employee_id}, Role: {admin.role})")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    load_dotenv()
    seed()
