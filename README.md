
## Todo Task Manager with CI/CD Pipeline


![Docker](https://img.shields.io/badge/Docker-2496ED.svg)
![Ansible](https://img.shields.io/badge/Ansible-EE0000.svg)
![CI/CD](https://img.shields.io/badge/CI%2FCD-2088FF.svg)
![Flask](https://img.shields.io/badge/Flask-000000.svg)
![Python](https://img.shields.io/badge/Python-3776AB.svg)
![React](https://img.shields.io/badge/React-61DAFB.svg)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-4285F4.svg)


This project showcases a comprehensive CI/CD implementation built on **GitHub Actions** that automates the software delivery lifecycle from code commit to production deployment. The pipeline leverages **Docker** and **Docker Compose** for containerization, **Ansible** playbooks for infrastructure provisioning and deployment on **Google Cloud Platform**, and comprehensive testing strategies including unit tests (**pytest**, **Jest**), integration tests, and end-to-end tests (**Playwright**). Code quality is enforced through automated linting (**Pylint**, **ESLint**), while security is maintained through continuous scanning with **Snyk** for dependency vulnerabilities and **Gitleaks** for secret detection. 

The pipeline implements branch-specific workflows that trigger different stages based on the target branch. Feature branches run basic validation, development branches include integration testing and deployment, release branches add end-to-end testing, and main branch merges trigger production deployments. All sensitive configuration is managed through **GitHub Secrets and environment variables**, with code changes requiring peer review through GitHub's **branch protection rules**.

![pipeline](https://github.com/Uchswas/todo-task-manager-with-automated-CI-CD/blob/main/pipeline.svg)

> **Note**: Detailed CI/CD design and documentation can be found in [`final_report.md`](final_report.md).

## Project Structure

### Docker Configuration

- **Docker Compose**: `task-manager/docker-compose.yaml` - Orchestrates database, backend, and frontend services
- **Backend Dockerfile**: `task-manager/backend/Dockerfile` - Container image configuration for Flask backend
- **Frontend Dockerfile**: `task-manager/frontend/Dockerfile` - Container image configuration for React frontend

### Ansible Deployment Code

- **Deployment Playbook**: `ansible/deploy.yml` - Main Ansible playbook for server deployment
- **Host Configuration**: `ansible/host.yaml` - Inventory file defining target servers

### CI/CD Workflows

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

### Backend 

- **Code**: `task-manager/backend/app/` - Flask application with routes, models, and utilities
- **Unit Tests**: `task-manager/backend/tests/unit/` - Unit tests for individual components and functions
- **Integration Tests**: `task-manager/backend/tests/integration/` - Integration tests for API endpoints and database interactions

### Frontend

- **Code**: `task-manager/frontend/src/` - React application with components, pages, hooks, and utilities
- **Unit Tests**: `task-manager/frontend/src/tests/unit/` - Unit tests for React components and hooks
- **Integration Tests**: `task-manager/frontend/src/tests/integration/` - Integration tests for page components and user flows
- **E2E Tests**: `task-manager/frontend/src/tests/e2e/` - End-to-end tests using Playwright





## Setting Up Runner Access to Google Cloud

To enable the GitHub Actions runner to deploy to Google Cloud VMs, you need to configure SSH access. Follow the steps to enable this:

1. On the runner, generate a new key pair: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/gcp_key`
2. Copy your public key: `cat ~/.ssh/gcp_key.pub`
3. Add the public key to your GCP VM instance metadata:
   - **Google Cloud Console** → **Compute Engine** → **VM instances**
   - Click your VM name → **Edit**
   - Find **SSH Keys** section → **Add item**
   - Paste the public key in the format: `KEY_VALUE USERNAME` (e.g., `ssh-ed25519 AAAAC3... upaul`)
   - Click **Save**

## GitHub Configuration Setup

The CI/CD pipeline requires GitHub **environment variables** (`CORS_ORIGINS`, `FLASK_APP`, `FLASK_ENV`, `REACT_APP_API_URL`, `SQLALCHEMY_ECHO`, `SSH_HOST`, `SSH_USER`, `TASKS_PER_PAGE`) to be configured for each environment (development and production) under **Settings** → **Environments** → **[environment name]** → **Variables**.

The pipeline also requires **environment secrets** (`JWT_SECRET`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_TEST_DB`, `POSTGRES_TEST_USER`, `POSTGRES_TEST_PASSWORD`, `SECRET_KEY`, `SSH_PRIVATE_KEY`) to be configured under **Settings** → **Environments** → **[environment name]** → **Secrets**.

## Quick Start

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


