### Group Members
- Ahmed Elgendy - aelgend
- Uchswas Paul - upaul

# Todo Task Manager

A modern, full-stack todo application built with React and Flask, featuring user authentication, task management, and categories.

## Quick Start

Follow these steps in order; every command is expected to run from inside the task-manager directory unless noted otherwise.

### 1. Install System Prerequisites

Ensure the following are available on your machine:

- Python **3.11+** with `python3`, `pip`, and `venv`
- Node.js **18+** with `npm`
- PostgreSQL **15+** (server + `psql` CLI)
- Git

Example installation commands:

- **Ubuntu/Debian**
  ```bash
  sudo apt update
  sudo apt install -y python3 python3-venv python3-pip nodejs npm postgresql postgresql-contrib git
  ```

> Make sure the PostgreSQL service is running. On Linux you can use `sudo service postgresql start`.

### 2. Clone the Repository

```bash
git clone https://github.ncsu.edu/aelgend/csc519-task-manager.git
cd csc519-task-manager/task-manager
```

### 3. Bootstrap the Project

Run the automated bootstrap script (requires sudo so it can create PostgreSQL users/databases):

```bash
sudo ./scripts/bootstrap.sh --api-url http://localhost:5000 --frontend-url http://localhost:3000
```

The script will:
- Recreate `backend/venv` and install `requirements.txt`
- Install all frontend dependencies (`npm install`)
- Install Playwright browsers and system dependencies
- Drop and recreate the dev/test databases and roles
- Generate fresh secrets and write `backend/.env`, `frontend/.env`, and Playwright env hints
- Initialize the development database schema so the API is ready immediately

If you need to target a remote host, override defaults with `--api-url`, `--frontend-url`, and `--playwright-url`.

### 4. Start the Application

Open two terminals:

1. **Backend API**
   ```bash
   cd backend
   source venv/bin/activate
   python run.py
   ```
   - API base URL: http://localhost:5000
   - Health checks: http://localhost:5000/health and http://localhost:5000/health/detailed

2. **Frontend**
   ```bash
   cd frontend
   npm start
   ```
   - Web app: http://localhost:3000

### 5. Linting & Testing

#### Backend

- Activate the virtual environment:
  ```bash
  cd backend
  source venv/bin/activate
  ```
- Lint the codebase:
  ```bash
  pylint app/ tests/
  ```
- Run all tests:
  ```bash
  pytest
  ```
- To focus on a subset:
  ```bash
  pytest tests/unit
  pytest tests/integration
  ```

#### Frontend

- Lint the codebase:
  ```bash
  npm run lint
  ```
- Run tests:
  ```bash
  cd frontend
  npm run test:unit
  npm run test:integration
  npm run test:e2e
  ```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

#### Tasks
- `GET /api/tasks` - Get user tasks (with filtering)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

#### Categories
- `GET /api/categories` - Get user categories
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Statistics
- `GET /api/stats` - Get user task statistics

### Database Schema

#### Users
- id (Primary Key)
- email (Unique)
- name
- password_hash
- created_at, updated_at

#### Categories
- id (Primary Key)
- name
- color
- user_id (Foreign Key)
- created_at, updated_at

#### Tasks
- id (Primary Key)
- title
- description
- completed
- priority (high, medium, low)
- due_date
- user_id (Foreign Key)
- category_id (Foreign Key)
- created_at, updated_at