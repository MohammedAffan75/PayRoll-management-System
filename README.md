# Payroll Management System

Full-stack payroll and HR platform with employee management, attendance tracking, leave workflows, payroll processing, and downloadable reports/payslips.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Axios
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** SQLite (`backend/payroll.db`)
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

## Deployment (AWS EC2 - Single Server)

Recommended simple production setup:

- **Frontend:** build with Vite, serve via Nginx
- **Backend:** run FastAPI with `uvicorn` as `systemd` service
- **Reverse proxy:** Nginx routes `/api` to backend on `127.0.0.1:8000`

High-level steps:

1. Launch Ubuntu EC2 instance
2. Install Python, Node, Nginx
3. Clone repository
4. Setup backend venv + install requirements
5. Create `systemd` service for backend
6. Build frontend (`npm run build`)
7. Configure Nginx for static frontend + `/api` proxy
8. (Optional) Add HTTPS with Certbot

## Notes

- Current frontend API base is set in `frontend/src/App.jsx`:
  - `const API_URL = 'http://localhost:8000/api';`
- For production, consider migrating to:
  - `const API_URL = import.meta.env.VITE_API_URL || '/api';`
  - and use environment-specific `.env` values.

## Security & Production Recommendations

- Move hardcoded secrets to environment variables (e.g. JWT secret)
- Restrict CORS to trusted domains
- Use PostgreSQL (RDS) for scalable production
- Add backups for database and logs
- Add monitoring and centralized logging

## License

This project is for educational/internal use. Add a license file if you plan to open-source publicly.
