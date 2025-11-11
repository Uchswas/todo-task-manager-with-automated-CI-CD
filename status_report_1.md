# Status Report 1

## 1. Accomplishments

### Ahmed Elgendy

**Backend Unit Tests** ([commit 919e4b4](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/919e4b4))
- Implemented unit test modules using pytest and pytest-flask
- Tests cover models and routes (auth, tasks, categories, stats, health) as well as validators and auth utilities
- Used mocking to isolate components without database dependencies

**Backend Integration Tests** ([commit 7a80c01](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/7a80c01))
- Created integration test suites with test cases covering authentication, tasks, categories, statistics, and health endpoints
- Set up dedicated PostgreSQL test database (`todo_app_test`)
- Implemented database cleanup between tests using `TRUNCATE TABLE ... RESTART IDENTITY CASCADE`
- Built reusable fixtures (`authorized_client`, `register_user`, `login_user`) for testing JWT authentication flows

**Frontend Unit Tests** ([commit 2b03fea](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/2b03fea))
- Wrote unit tests using Jest and React Testing Library
- Covered custom hooks (`useAuth`, `useTasks`, `useCategories`) along with utilities and UI components

**Frontend Integration Tests** ([commit ccb3379](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/ccb3379))
- Built integration test infrastructure with API mocks simulating backend behavior
- Created integration test suites for authentication flows, dashboard, tasks, categories, statistics, and profile pages
- Tests validate user flows and component interactions without calling actual backend

**Linting Fixes** ([commit 064f041](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/064f041))
- Fixed all Pylint violations across backend codebase to achieve 10/10 score
- Resolved issues with unused imports and naming conventions as well as missing docstrings

---

### Uchswas Paul

**Linting Quality Gate Workflows** ([commit e0d64a1](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/e0d64a1), [commit 980ba2c](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/980ba2c))
- Created Python Lint workflow running pylint on backend code (`app/`, `tests/`, `run.py`)
- Created ESLint workflow running ESLint on frontend (`.js`, `.jsx`, `.ts`, `.tsx` files)
- Both workflows run on every push and pull request using a self-hosted runner
- Enforces 100% quality threshold to prevent merging low-quality code

**Docker Setup** ([commit fc1e80f](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/fc1e80f))
- Created Dockerfiles for backend using Python 3.11-slim and frontend using Node 18-alpine base images
- Backend includes a script (`endpoint.sh`) that waits for PostgreSQL availability before starting Flask

**Docker Compose Configuration** ([commit fc1e80f](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/fc1e80f))
- Configured multi-container orchestration with PostgreSQL database, database initialization, backend API, and frontend services
- Services use `depends_on` to ensure correct startup order (db → db-setup → backend → frontend)
- Container networking enables automatic service discovery between components
- New developers can run `docker-compose up` to get the full environment without manual setup

---

## 2. Next Steps

| Task | Owner | Duration |
|------|-------|----------|
| Set up Playwright test configuration and page object models | Ahmed Elgendy | 0.5 days |
| Write E2E tests for authentication flows (registration and login) | Ahmed Elgendy | 0.5 days |
| Write E2E tests for task management (create, read, update, delete) | Ahmed Elgendy | 1 day |
| Write E2E tests for categories and statistics pages | Ahmed Elgendy | 0.5 days |
| Configure Playwright to run tests across Chrome, Firefox, and Edge | Ahmed Elgendy | 0.5 days |
| Create smoke test suite for critical production paths | Ahmed Elgendy | 1 day |
| Secret Management for deployment | Uchswas Paul | 0.5 days
| Create Ansible playbook for test environment setup | Uchswas Paul | 1 days |
| Create Ansible playbook for production environment setup | Uchswas Paul | 0.5 days |
| Create workflow that triggers on PR merge to release/* branches | Uchswas Paul | 0.5 days |
| Implement changelog generation from commit history | Uchswas Paul | 0.5 days |
| Add functionality to create PR to main with changelog | Uchswas Paul | 0.5 days |
| Test release workflow end-to-end | Uchswas Paul | 0.5 days |

---

## 3. Retrospective for the Sprint

### What Worked Well

- GitHub Issues for task tracking prevented ambiguity
- Email threads resolved technical questions without needing meetings
- GitHub Projects board with tasks made progress tracking easier
- Clear separation of work (Ahmed on testing, Uchswas on workflows and infrastructure) allowed parallel development
- Feature branch workflow prevented merge conflicts

### What Didn't Work Well

- Not having sudo permissions on the VM made us rethink how to use Ansible, since we can't install any system packages
- Not having deadlines on tasks made it hard to track when a task was expected to be done or what was remaining for the task to be completed
- Only the repo owner had access to configure GitHub runners and repository settings, which created bottlenecks

### What We'll Do Differently

- Add explicit deadlines in GitHub Issues
- Post daily progress updates to keep both aware of the status
- Break tasks >2 days into smaller sub-tasks (e.g., "E2E tests" → "Setup Playwright", "Auth tests", "Task tests")
- Add 25% buffer to estimates and track actual vs estimated time
