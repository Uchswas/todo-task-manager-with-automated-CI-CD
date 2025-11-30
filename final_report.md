### DevOps Pipeline Final Report

#### Introduction

Todo/Task Manager is a full-stack web application that aims to help users organize and track their daily tasks. It consists of three main components: a user interface frontend based on React, an API layer for data processing built on Flask, and a PostgreSQL database that stores all user and task information. Users can create tasks with different priorities and categories, track completion status, and view statistics about their productivity.

#### Problem Statement and Motivation

Manually building, testing, and deploying our applications becomes inefficient and error-prone as it grows. With the application consisting of several components, even small changes to a single component can cause unexpected bugs. This lack of automation becomes problematic as it slows down the overall progress and decreases the reliability of our application. This not only affects developers but also users who can experience downtime or bugs in new releases, which leads to lower trust in our application.

As a result, we needed a solution that makes our integration and delivery operations faster and more reliable. We decided to implement a fully automated CI/CD pipeline, primarily based on GitHub Actions. Using different triggering operations (ex: pushes, pull requests), the CI workflow runs a combination of linting and different test types that are executed depending on the target branch. Additionally, we require all code changes targeting shared branches (`main`, `dev`, `release`) to be integrated through PRs and must be reviewed and approved. This is done through GitHub's branch protection rules and ensures that only reviewed and tested code reaches these branches. The only actions that require user interaction in this automated pipeline are PR related actions (creation, review, merging). 

The CD part of our pipeline extends automation to the application's delivery and environment management. Once the CI pipeline completes successfully and code is merged to either the `dev` or `main` branch, Ansible playbooks automatically build and deploy the application to the proper environment. We use Docker images and containers to maintain consistency across environments and eliminate configuration inconsistencies. All of this is done while keeping security in mind: we store sensitive secrets and credentials using the GitHub Secret Manager. We also have a stage in the workflow that scans the code for leaking secrets and scans both our frontend and backend dependencies for high-risk vulnerabilities. Using this workflow, our pipeline enables faster, more secure, and more reliable releases of our application with minimal manual effort.


#### Summarized Accomplishments

1. Wrote Unit and Integration tests for the backend using pytest. We also wrote frontend tests using Jest.   [PR #3](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/3), [PR #11](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/11) 
2. Used Playwright to build an automated end-to-end (E2E) testing suite. It checks the entire app on Chrome, Firefox, and Safari for features such as logging in, managing tasks, and categories.  [PR #23](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/23) 
3. Set up Pylint and ESLint in our CI pipeline. These tools check our code for style problems and errors. [PR #12](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/12) 
4. Cleaned up the codebase by centralizing configuration and removing hard-coded values and secrets. The app previously relied on multiple .env files with many hard-coded secrets and variables. We now use only one `.env` file and GitHub environment secrets & variables in our CI/CD pipeline, which has significantly improved security and maintainability.  [PR #26](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/files) 
5. Used Docker and Docker Compose to package our database, backend, and frontend. This ensures the app runs consistently everywhere. [PR #16](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/16) 
6. Used Ansible to automate server provisioning and to deploy the application’s Docker containers.  [PR #28](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/28/files) 
7. Implemented GitHub Actions workflows for Unit, Integration, and E2E testing, as well as for automating deployment to test and production servers.  [PR #35](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/35/files) 
8. Added Snyk and Gitleaks to our pipeline. Snyk finds security problems in our code's dependencies, and Gitleaks finds secret keys that might have accidentally been committed.  [PR #69](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/69/files) 
9. Implemented branch-specific `workflow pipeline` to control the execution order of workflows. This ensures tests and deployment run in the correct sequence.  [PR #49](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/49/files) 
10. Created a release process that automatically adds version tags, makes a list of changes (changelog), and sends a pull request to the `main` branch for new release deployment.  [Commit ba7669](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/ba7669329b7037251841b4ccdc2c44f39d958f8a) 
11. Enabled GitHub branch protection rules to make sure all code is reviewed before merging.
12. Configured the pipeline to save security reports as artifacts so we can check them later.

#### Technical Approach: Updated Pipeline Figure

![pipeline](https://github.ncsu.edu/aelgend/csc519-task-manager/blob/main/updated_pipeline.svg)

#### Technical Approach: Description of Pipeline

##### Code Stage

We use VS Code as the main IDE to write and debug code locally before committing the changes to GitHub. GitHub serves as the central repository and version control system. All source code and configuration files are stored within the GitHub repository.

##### Continuous Integration (PR to `dev`)

When a developer creates a PR from a feature branch to be merged into the `dev` branch, GitHub Actions runs the CI workflow. The workflow executes backend and frontend linting using Pylint and ESLint, respectively. The linting step is followed by unit and integration tests to ensure that the PR changes did not break functionality. All testcases must be successful for the workflow to continue. Security checks are then run to ensure no secrets were committed and no vulnerabilities exist in our dependencies. The PR must have a reviewer who provides comments or requests changes. The workflow runs using a self-hosted action runner.

##### Provision Test Environment (PR merged to `dev`)

After a PR is merged into `dev`, a new workflow is triggered to build and deploy the application in a controlled test environment. We build Docker images from the latest commit and use Ansible to automatically configure and provision the test server. Ansible ensures that the server has all the required dependencies, system packages, and configurations needed for the application’s Docker containers to run smoothly. Once the environment is ready, the newly built images are deployed. The testing environment is hosted on Google Cloud. This stage is considered successful when the Docker images are deployed, and the environment is correctly configured. Developers use this environment for regression testing.

##### User Acceptance Testing (PR from `dev` to `release`)

When we are ready for a new release, we create a PR from `dev` to `release`. This triggers another workflow that repeats backend and frontend linting, integration testing, and security checks. E2E tests are also performed using Playwright to simulate real user interactions with the system. The goal of this stage is to validate the application’s overall behavior and functionality before preparing for the production release.

##### Pre-Deployment Stage (PR merged to `release`)

Once the PR is approved and merged into the `release` branch, a new workflow is executed that generates a changelog summarizing all pull requests since the previous release. It also automatically tags the merge commit with a new release tag following the project’s versioning scheme. A new PR is then automatically created by the GitHub bot in the `main` branch.

##### Pre-Deployment Validation (PR from `release` to `main`)

After the creation of an automated PR from `release` to the  `main` branch, all the tests are run for the final validation in the merged code. This includes unit tests, integration tests, followed by E2E tests and security tests. 

##### Deploy to Production (PR merged to `main`)

When the final PR is merged into the `main` branch, the workflow builds the final Docker images from this tagged commit. Once the built images are ready, Ansible connects to the `production` server and performs a rolling restart of the application containers, sequentially stopping and replacing each container with the updated version. The production server is hosted on Google Cloud. The deployment is considered successful once all services are healthy and stable.


#### Use of Generative AI

We mainly used ChatGPT throughout this project for debugging and getting examples. For instance, when we were working on tests, ChatGPT provided us with examples of how pytest, Jest, and Playwright work, as well as guidance on test case structure. It was very helpful for debugging errors in workflows we encountered. Generative AI was also used to find out hard-coded secrets in codebases and replace them with appropriate environment variables.

#### Retrospective: What Worked

1. Dividing the work clearly helped us. Ahmed focused on testing and linting, and Uchswas focused on infrastructure, workflows, and deployment. This allowed us to work in parallel.
2. GitHub Issues and the project board kept us organized. We could see exactly what tasks were being worked on and what was left.
3. Using feature branches kept our main code stable. We created a separate branch for each task and merged it only when it was complete.
4. Docker solved our environment problems. It made sure the app ran the same way on everyone's computer.

#### Retrospective: What Didn't Work

1. VCL only lets the person who provisioned the VM connect, and they must stay on the same Wi‑Fi/mobile network, or the firewall blocks SSH, so using VCL wasn’t an option.
2. We didn't have sudo access on the VCL servers. This meant we couldn't use Ansible to install the system packages we needed.
3. At first, our workflows didn’t run in a fixed order, which caused problems. Sometimes, deployment ran before tests, so buggy code got deployed, and we also ran unnecessary tests. For example, running integration tests even after unit tests had already failed
4. Only one person had access to the GitHub settings, for example, adding runners, adding GitHub secrets, and variables in the appropriate environment. This caused delays when we needed to change the settings, and that person wasn't available.
5. A few of the Playwright tests were flaky, which took some time to debug.


#### Retrospective: What We Would Do Differently

1. Use Google Cloud from the start. We wasted time trying to make VCL work.
2. Set deadlines for every task. This would help us catch delays earlier.
3. Break large tasks into smaller pieces. This would make it easier to see our progress.
4. Add extra time to our estimates. Debugging took longer than we thought it would.

#### Who Did What

Ahmed mainly focused on linting, testing, and the security workflow. He wrote unit and integration tests for the backend using pytest and for the frontend using Jest. He set up Playwright and wrote end-to-end tests for features like logging in, managing tasks, and the dashboard. He also fixed the code style issues in the backend and helped integrate the security scanning tools into the pipeline.

Uchswas focused on writing configuration codes. It includes packaging the systems (frontend, backend, database) using Docker, deploying the containers using Ansible and provisioning servers on VCL and Google Cloud. After that, he focused on implementing the CI/CD pipeline. That includes writing workflows to trigger tests and deployment, as well as ordering workflow execution using branch-specific workflow pipelines. He also worked on **refactoring** codebase for management and security purposes. 

#### Security Extra Credit

Ahmed set up the automated security scanning in the CI/CD pipeline which uses two tools. First, Snyk checks for security problems in the project's dependencies. Snyk scans both the Python backend and JavaScript frontend code for known vulnerabilities. Second, Gitleaks finds any secret keys or passwords that might have accidentally been committed to the code's history. Gitleaks helps catch these before they become a bigger problem. All the results from these security scans are saved and uploaded to GitHub.

Uchswas cleaned up the codebase to handle configuration and secrets. Before, it used multiple .env files for different parts of the system (frontend, backend, database), which was hard to manage and could easily lead to inconsistencies and security issues. Moreover, there were lots of hard-coded secrets and variables that were removed from the code and switched to using environment-based configuration instead. He then moved sensitive values and some non-sensitive ones, such as HOST_IP_ADDRESS,  into GitHub environment secrets and variables. It  makes the setup more secure and less exposed.

#### Technical Commits

Ahmed:
1.  **Fixing Linting Issues** ([commit 6865427](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/6865427))
2.  **Integration Test** ([commit 94a75af](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/94a75af))
3.  **Security Workflow** ([commit d8ce9cc](https://github.ncsu.edu/aelgend/csc519-task-manager/commit/d8ce9cc))


Uchswas:
1. **Dockerized Setup & Ansible Deployment** ([commit fc1e80f](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/16/commits/fc1e80f241f5ff37d6c733c41d20ecbe2c003006), [commit beac25f](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/28/commits/beac25f54a06f53726d66692e61b5724f8f02f41))
2. **GitHub Workflows & Workflow Pipeline** ([commit 6dcd152](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/49/commits/6dcd152af3f364f4f734456e5b779f30c4b3dcc0), [commit e2d9118](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/35/commits/e2d911874ec871e500ef9bac765045d540480f23))
3. **Code Cleaning and Hard-Coded Secrets & Variables Removal** ([commit 18942a4](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/commits/18942a47ae0ae412461e879fdfd742bc5e20502a), [commit c6e81d6](https://github.ncsu.edu/aelgend/csc519-task-manager/pull/26/commits/c6e81d60652a8420e8f8db61a81376835e8ffc4a))

