
## Todo Task Manager

A modern, full-stack todo application built with React and Flask, featuring user authentication, task management, and categories.

## Project Structure


### Backend 

- **Code**: `task-manager/backend/app/` - Flask application with routes, models, and utilities
- **Unit Tests**: `task-manager/backend/tests/unit/` - Unit tests for individual components and functions
- **Integration Tests**: `task-manager/backend/tests/integration/` - Integration tests for API endpoints and database interactions


### Frontend

- **Code**: `task-manager/frontend/src/` - React application with components, pages, hooks, and utilities
- **Unit Tests**: `task-manager/frontend/src/tests/unit/` - Unit tests for React components and hooks
- **Integration Tests**: `task-manager/frontend/src/tests/integration/` - Integration tests for page components and user flows
- **E2E Tests**: `task-manager/frontend/src/tests/e2e/` - End-to-end tests using Playwright


### Docker Configuration

- **Docker Compose**: `task-manager/docker-compose.yaml` - Orchestrates database, backend, and frontend services
- **Backend Dockerfile**: `task-manager/backend/Dockerfile` - Container image configuration for Flask backend
- **Frontend Dockerfile**: `task-manager/frontend/Dockerfile` - Container image configuration for React frontend

### Ansible Deployment Code

- **Deployment Playbook**: `ansible/deploy.yml` - Main Ansible playbook for server deployment
- **Host Configuration**: `ansible/host.yaml` - Inventory file defining target servers

### CI/CD Workflows

**Location**: `.github/workflows/`

#### Orchestrator Pipelines 

- **Feature Branch Pipeline**: `.github/workflows/feature-branch-pipeline.yml`
  - Triggers: Push/PR to feature branches
  - Runs: Linting + Unit Tests + Security Scan

- **Dev Branch Pipeline**: `.github/workflows/dev-branch-pipeline.yml`
  - Triggers: PR to dev branch (tests on PR create, deploy on merge)
  - Runs: Linting + Unit Tests + Integration Tests + Security Scan → Deploy on merge

- **Release Branch Pipeline**: `.github/workflows/release-branch-pipeline.yml`
  - Triggers: PR to release branch (tests on PR create, changelog on merge)
  - Runs: Linting + Unit Tests + Integration Tests + E2E Tests + Security Scan → Generate Changelog on merge

- **Main Branch Pipeline**: `.github/workflows/main-branch-pipeline.yml`
  - Triggers: PR to main branch (tests on PR create, deploy on merge)
  - Runs: Linting + Unit Tests + Integration Tests + E2E Tests + Security Scan → Deploy on merge

#### Reusable Workflows (Called by Pipelines)

- **Linting**:
  - `.github/workflows/python-lint.yaml` - Python/Pylint checks
  - `.github/workflows/es-lint.yaml` - JavaScript/ESLint checks

- **Unit Tests**:
  - `.github/workflows/backend-unit-tests.yml` - Backend unit tests
  - `.github/workflows/frontend-unit-tests.yml` - Frontend unit tests

- **Integration Tests**:
  - `.github/workflows/backend-integration-tests.yml` - Backend integration tests
  - `.github/workflows/frontend-integration-tests.yml` - Frontend integration tests

- **E2E Tests**:
  - `.github/workflows/e2e-tests.yml` - End-to-end tests with Playwright

- **Security**:
  - `.github/workflows/security-check.yml` - Security vulnerability scanning

- **Deployment**:
  - `.github/workflows/development-deploy.yml` - Deploy to development environment
  - `.github/workflows/production-deploy.yml` - Deploy to production environment
  - `.github/workflows/generate-changelog.yml` - Generate changelog, create GitHub release and create automatic PR to main


## Contributions and Technical Depth

**Uchswas** focused on writing configuration code. It includes packaging the systems (frontend, backend, database) using Docker, deploying the containers using Ansible and provisioning servers on Google Cloud. After that, he focused on implementing the CI/CD pipeline. That includes writing workflows to trigger tests and deployment, as well as ordering workflow execution using branch-specific workflow pipelines. He also worked on refactoring codebase for management and security purposes. 

**Ahmed** mainly focused on linting, testing, and the security workflow. He wrote unit and integration tests for the backend using pytest and for the frontend using Jest. He set up Playwright and wrote end-to-end tests for features like logging in, managing tasks, and the dashboard. He also fixed the code style issues in the backend and helped integrate the security scanning tools into the pipeline.



## Security Extra Credit

**Ahmed** set up the automated security scanning in the CI/CD pipeline which incorporates 2 security features, dependency vulnerability checking and secret leakage checking (`.github/workflows/security-check.yml`). (1) Snyk checks for security issues in the project's dependencies. Snyk scans both the Python backend and JavaScript frontend code for known vulnerabilities. (2) Gitleaks finds any secret keys or passwords that might have accidentally been committed to the code's history. Gitleaks helps catch these before they become a bigger problem. All the results from these security scans are saved and uploaded to GitHub as artifacts.

**Uchswas** (1) cleaned up the codebase to handle configuration and secrets. Before, it used multiple .env files for different parts of the system (frontend, backend, database), which was hard to manage and could easily lead to inconsistencies and security issues. (2) Moreover, there were lots of hard-coded secrets and variables that were removed from the code and switched to using environment-based configuration instead. (3) He then moved sensitive values and some non-sensitive ones, such as HOST_IP_ADDRESS, into GitHub environment secrets and variables. It makes the setup more secure and less exposed.


## Quick Start

Follow these steps in order; every command is expected to run from inside the task-manager directory unless noted otherwise.

### 1. Install System Prerequisites

Ensure the following are available on your machine:

- Docker
- Ansible



### 2. Clone the Repository and Configuration

- **Clone the Repository**:
    ```bash
    git clone https://github.ncsu.edu/aelgend/csc519-task-manager.git
    cd csc519-task-manager/task-manager
    ```

- **Copy the example environment file**:
    ```bash
    cp .env.example .env
    ```

- **Edit `.env`** and fill in the configuration values


### 3. Run the Project

You can run the application using either Docker Compose or Ansible deployment:

- #### Option A: Using Docker Compose (Recommended for Local Development)

    ```bash
    docker compose up
    ```


    The application will be available at:
    - **Frontend**: http://localhost:3000
    - **Backend API**: http://localhost:5000

- #### Option B: Using Ansible (For Remote Deployment)

    ```bash
    cd ../ansible
    ansible-playbook -i host.yaml deploy.yml
    ```

> **Note**: Ensure SSH key-based authentication is configured for passwordless login to the target server.



### 4. Linting & Testing

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
