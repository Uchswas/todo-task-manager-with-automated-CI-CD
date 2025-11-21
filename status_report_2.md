# Status Report 2

## 1. Accomplishments

### Ahmed Elgendy

**Playwright E2E Infrastructure** ([commit c5ee0b4](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/c5ee0b43375962991feb9c585bfb993dee6b4d19), [commit ef4d491](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/ef4d4912f1eb5e3030cfbed21d99867038ef916a))
- Added a Playwright config that starts backend/frontend automatically, injects test secrets, and targets Chromium, Firefox, and Safari.
- Per file test parallelism so multiple files can execute at once while tests inside a file stay sequential.

**Authentication E2E Tests** ([commit 1c047ba](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/1c047ba5b71b68273b5a120dadd5d6ad35cdfec1))
- Covered registration, login/logout, validation errors, and token persistence with reusable fixtures.
- Fixtures now generate fresh users, manage auth state, and expose helpers (`registerUser`, `waitForAuthRedirect`, etc.).

**Task Management E2E Tests** ([commit 52e743c](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/52e743c3f8324f86509df0dbe8d30876b717ea6e))
- Added end-to-end coverage for creating, editing, deleting, filtering, and toggling task completion.
- Shared task helpers generate the reusable task data and modal interactions the suite needs.

**Categories E2E Tests** ([commit efbe58a](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/efbe58adf60f1dc8cad9ed5a1fadcd9a54effc83))
- Covered create, edit, and delete category flows.
- Tightened the category routes so duplicate names or invalid colors return clear, consistent errors.

**Dashboard E2E Tests** ([commit 9ebb0f1](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/9ebb0f16690ce63aac92bedfa296519884c41a3a), [commit 2e6f1d8](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/2e6f1d83fae10791c2d014297e131c009fdf0f3b))
- Added dashboard coverage for stats cards, overdue lists, and quick actions.
- Documented the new `npm run test:e2e:*` scripts so headed and headless modes are easy to run.

---

### Uchswas Paul
**Secret and Code Management (single .env)** ([commit 18942a4](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/commits/18942a47ae0ae412461e879fdfd742bc5e20502a), [commit c6e81d6](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/commits/c6e81d60652a8420e8f8db61a81376835e8ffc4a), [commit f8cd34d](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/commits/f8cd34db1ef99db2c39583bbd4d20e2e61a9c553))
- Removed hard-coded secrets from the codebase and legacy setup scripts.
- Consolidated multiple .env files into a single environment file.
- Migrated project setup from custom .sh scripts to a Docker-based workflow.

**Ansible Configuration** ([commit beac25f](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/28/commits/beac25f54a06f53726d66692e61b5724f8f02f41))
- Added Ansible configuration for deploying the project to the server.
- Use Ansible to install Docker and Nginx, manage secrets, and run Docker containers.

**Automated Deployment Workflow** ([commit 022a7f7](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/022a7f731c639ffb4ac150aa72970e638a99dc62))
- Added a GitHub Actions workflow to deploy to the development server whenever code is pushed to the dev branch.

**GitHub Environments**
- Created development and production environments in GitHub
- Added variables and secrets to these environments to enable the CI/CD pipeline to deploy the project.

---

### Value Added

Our testing now includes very thorough E2E test coverage for different application flows (auth, dashboard, tasks, and categories). This is accomplished using Playwright scripts that run on headless or headed mode on Chrome, Firefox, and Safari. This give us higher confidence of our application and that no regression is happening.

Moreover, our deployment and configuration process is now much more secure, consistent, and maintainable. Centralizing configuration into a single .env file makes it  easier to manage and maintain. Moving secrets into GitHub environments and removing hard-coded secrets from the codebase and scripts, reducing security risk and configuration drift. The new Ansible playbooks and GitHub Actions workflow provide a repeatable, automated path to deploy Dockerized services to our servers, which will shorten the release time.

---

## 2. Next Steps

| Task | Owner | Duration |
|------|-------|----------|
| Create workflow that triggers on PR merge to `release/*` branches | Ahmed Elgendy | 1 day |
| Implement changelog generation from commit history | Ahmed Elgendy | 1 day |
| Add functionality to create PR to main with changelog | Ahmed Elgendy | 1 day |
| Test release workflow end-to-end | Ahmed Elgendy | 1 day |
| Provision and setup Google Cloud Service | Uchswas Paul| 1 day |
| Implement changelog generation from commit history | Uchswas Paul | 0.5 day |
| Create workflow that triggers on PR merge to release/* branches | Uchswas Paul | 1 day |
| Create workflow to run tests like unit tests, e2e tests | Uchswas Paul | 0.5 day |
| Test Full pipeline | Uchswas Paul | 1 day |

---

## 3. Retrospective for the Sprint

### What Worked Well

- Detailed Playwright docs made the E2E setup straightforward.
- We kept collaboration smooth through GitHub Issues and branching.
- The branching strategy still prevented conflicts and let us develop in parallel.

### What Didn’t Work Well

- VCL only lets the person who provisioned the VM connect, and they must stay on the same Wi‑Fi/mobile network or the firewall blocks SSH, so using VCL isn’t an option.
- Some Playwright suites were flaky and tough to debug because of parallelism.

### What We’ll Do Differently
- We will use  Google Cloud infrastructure instead of VCL so that it doesn't block the deployment from the runner
- Start sooner, so environment or test surprises don’t erupt at the end.

