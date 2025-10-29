# Todo/Task Manager DevOps Pipeline

## Problem Statement
The problem is that as our Todo/Task Manager application continues to grow, manually building, testing, and deploying becomes inefficient and prone to errors. Since the application comprises several components (backend API, React frontend, and PostgreSQL database), even small changes in a single component can cause inconsistencies and/or unexpected bugs. This is important because little to no automation slows down the overall progress and decreases the reliability of our application. These challenges not only affect developers but also users who can experience downtime or bugs in new releases which leads to lower trust in the application.

Our solution is to implement a fully automated CI/CD pipeline that makes our integration and delivery faster and more reliable. By using GitHub Actions, the CI workflow runs automatically on the targeted branch where linting, unit, and integration tests are executed as shown in the CI block in the pipeline figure. Additionally, we require all code changes targeting shared branches (ex: `main`, `dev`, `release`) be integrated through PRs that must be reviewed and approved. This ensures that only reviewed and tested code reaches these critical branches. PR related actions (creation, review, merging) are the only actions requiring user interaction.

The CD process extends automation to the application's delivery and environment management. Once the CI pipeline completes successfully and code is merged, Ansible playbooks automatically deploy the application to the proper environment. We use Docker containers to maintain consistency across environments and eliminate configuration inconsistencies. All of this is done while keeping security in mind where we store sensitive secrets and credentials using the GitHub Secret Manager and/or Ansible Vault. Using this workflow, our pipeline enables faster, safer, and more reliable releases of the Todo/Task Manager application with minimal manual effort.

Tagline: Automate the process, accelerate the progress.

## Use Case

```
Use Case: PR to dev triggers automated CI and deployment to the test environment

1. Preconditions
  - dev branch exists
  - Required GitHub secrets (SSH key, database credentials, JSON Web Token (JWT) secret) are stored.
  - A Github Action runner configured
  - Test environment is provisioned. 

2. Main Flow
  - The developer opens a PR from feature/* to dev [S1][S2].
  - GitHub Actions automatically runs the CI pipeline [S3].
  - After all checks pass, the PR is reviewed and approved by at least one team member [E2]. 
  - The PR gets merged into dev.
  - The merge commit triggers the test environment deployment workflow [S4].
  - Upon completion, the pipeline reports the deployment result in GitHub Actions, and the updated application is accessible on the test environment.

3. Subflows
[S1] The developer provides a PR description summarizing the feature and assigns a reviewer.
[S2] The reviewer comments or requests changes; the developer commits fixes and pushes updates, which automatically re-triggers the workflow.
[S3] Backend linting is done using Pylint with a passing score of 80%. Frontend linting is done using ESLint with a passing score of 80%. Unit and integration tests are executed for both the backend and the frontend [E1].
[S4] Ansible is used to install Docker and dependencies, and to provision and start containers for PostgreSQL, the backend, and the frontend [E3][E4].

4. Alternative Flows
[E1] Linting or tests fail, GitHub Actions halts the pipeline and marks the PR as failing.
[E2] The PR lacks required approvals, GitHub blocks merging.
[E3] Ansible fails to connect to the test host, so deployment halts and error logs are shown in the workflow output.
[E4] Container startup fails, so the workflow reports failure and marks the PR as failing.
```

## The DevOps Pipeline

![pipeline](https://github.ncsu.edu/upaul/csc519-project/assets/30366/6e2366ea-94b9-4a9e-9251-68364b5f01fa)


##### Code Stage

We will use VS Code as the main IDE to write and debug code locally before committing the changes to GitHub. Github serves as the central repository and version control system. All source code and configuration files are stored within the GitHub repository.

##### Continuous Integration (PR to `dev`)

When someone creates a PR to be merged into the `dev` branch, GitHub Actions automatically runs the CI workflow. The workflow exectues backend and frontend linting using Pylint and ESLint, respectively. Linting is considered successful if it achieves a score that meets or exceeds 80%. The linting step is followed by unit and integration tests to ensure that the PR changes did not break functionality and all testcases must be successful for the workflow to continue. The PR must have a reviewer where the reviewer comments or requests changes; the developer commits fixes and pushes updates, which automatically re-triggers the workflow. The workflow runs using a self hosted action runner.

##### Provision Test Environment (PR merged to `dev`)

After a PR is merged into `dev`, a new workflow is triggered to build and validate the application in a controlled test environment. We build Docker images from the latest commit and use Ansible to automatically configure and provision the test server. Ansible ensures that the server has all the required dependencies, system packages, and configurations needed for the application’s Docker containers to run smoothly. Once the environment is ready, the newly built images are deployed, and smoke tests are executed to verify that the containers start correctly and key endpoints respond as expected. The testing environment is hosted on one of the VMs provided for each individual in the DevOps class. This stage is considered successful when the Docker images are deployed, the environment is correctly configured, and the application passes its smoke checks.

##### User Acceptance Testing (PR from `dev` to `release`)

When we are ready for a new release, we create a PR from `dev` to `release`. This triggers another workflow that repeats backend and frontend linting as well as integration testing to ensure code consistency. End-to-end (E2E) tests are also performed using Playwright to simulate real user interactions with the system. The goal of this stage is to validate the application’s overall behavior and functionality before preparing for the production release. This stage is considered successful when the linting score meets or exceeds 80% and all tests are completed without failure.

##### Pre-Deploy Stage (PR merged to `release`)

Once the PR is approved and merged into the `release` branch, a new workflow is executed that generates a changelog summarizing all pull requests since the previous release. This can be done using automated changelog generation tools. The changelog is then attached to a new PR into the `main` branch using the GitHub API. This stage is considered successful when the changelog is accurately generated and attached to the main branch PR making the PR ready for final review and approval.

##### Deploy to Production (PR merged to `main`)

When the final PR is merged into the `main` branch, the workflow automatically tags the merge commit with a new release tag following the project’s versioning scheme. It then builds the final Docker images from this tagged commit. Once the built images are ready, Ansible connects to the production server and performs a rolling restart of the application containers where it sequentially stops and replaces each container with the updated version. After the restart, automated health checks verify that the application has started correctly and is serving requests as expected. The production environment is hosted on the other VM provided for each individual in the DevOps class. The deployment is considered successful once all services are healthy and stable.

### Area of Technical Depth

- Ahmed Elgendy will focus mostly on all testing (unit, integration and E2E) and its configuration.
- Uchswas Paul will focus mostly on the configuration aspects of the servers and deployment of containers.

### Branch Strategy

#### Branch Types & Protection Rules

- **`main`** - Production code (protected, no direct pushes)
- **`dev`** - Integration branch (protected, no direct pushes)
- **`feature/*`** - Feature development branches
- **`release/*`** - Release preparation branches (protected, no direct pushes)


## Application Requirements

### Functional Requirements

#### User Management
- User registration with email and password
- User login/logout with JWT authentication
- User profile with name and email

#### Task Management
- Create a task with: title, description, due date, priority (low/medium/high)
- View all tasks for logged-in user
- Edit task details
- Delete tasks
- Mark tasks as complete/incomplete
- Filter tasks by: status (complete/incomplete), priority, due date
- Search tasks by title or description

#### Categories
- Create custom categories (Work, Personal, Shopping, etc.)
- Assign one category to each task
- View tasks by category
- Default "Uncategorized" category

#### Additional Features
- Sort tasks by: creation date, due date, priority
- View overdue tasks separately
