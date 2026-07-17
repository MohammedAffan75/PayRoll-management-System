# Payroll Management System

Full-stack payroll and HR platform with employee management, attendance tracking, leave workflows, payroll processing, and downloadable reports/payslips.

## 🌐 Live Links

- **Frontend:** https://pay-roll-management-system-lemon.vercel.app/
- **API Documentation (Swagger):**https://payroll-management-system-11pk.onrender.com/docs

  
## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Axios
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** Postgres
- **Reporting:** ReportLab (PDF), CSV export

## Features

- Role-based access (`admin`, `hr_manager`, `finance`, `employee`)
- Employee lifecycle management (create/update/status)
- Attendance check-in/check-out and attendance summaries
- Leave requests + approval workflow
- Gender-based leave rules:
  - Maternity leave for female employees only
  - Paternity leave for male employees only
- Payroll processing with automatic leave impact on deductions
- Payslip generation and reporting/export endpoints
- Animated modern landing page UI

## Project Structure

```text
PayrollSystem/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── auth.py
│   ├── schemas.py
│   ├── routers/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── requirements.txt
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+ (or 20+ recommended)
- npm

## Local Setup

### 1) Clone repository

```bash
git clone <your-repo-url>
cd PayrollSystem
```

### 2) Backend setup

```bash
cd backend
python -m venv venv
```

Activate virtual environment:

- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **macOS/Linux:**
  ```bash
  source venv/bin/activate
  ```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run backend:

```bash
uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`

### 3) Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

## Default Admin Login (Fresh Database)

On first backend startup, a default admin is auto-created:

- **Email:** `admin@payroll.com`
- **Password:** `admin123`

Then:

1. Login as admin
2. Create employees
3. Set salary structure
4. Process payroll

## API Overview

Main routers are mounted under `/api`:

- `/api/auth`
- `/api/employees`
- `/api/payroll`
- `/api/management`
- `/api/reports`
- `/api/attendance`
- `/api/leaves`
- `/api/departments`
- `/api/profile`
- `/api/export`
- `/api/employee`

Interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Security & Production Recommendations

- Move hardcoded secrets to environment variables (e.g. JWT secret)
- Restrict CORS to trusted domains
- Use PostgreSQL (RDS) for scalable production
- Add backups for database and logs
- Add monitoring and centralized logging
