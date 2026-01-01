### DevOps Project Final Report

#### Group Members
1. Ahmed Elgendy - aelgend
2. Uchswas Paul - upaul

#### Introduction

Todo/Task Manager is a full-stack web application that aims to help users organize and track their daily tasks. It consists of three main components: a user interface frontend based on React, an API layer for data processing built on Flask, and a PostgreSQL database that stores all user and task information. Users can create tasks with different priorities and categories, track completion status, and view statistics about their productivity.

#### Problem Statement and Motivation

Manually building, testing, and deploying becomes inefficient and error-prone as our application grows. With the application consisting of several components, even small changes to a single component can cause unexpected bugs. This lack of automation becomes problematic as it slows down the overall progress and decreases the reliability of our application. This not only affects developers but also users who can experience downtime or bugs in new releases, which leads to lower trust in our application.

As a result, we needed a solution that makes our integration and delivery operations faster and more reliable. We decided to implement a fully automated CI/CD pipeline, primarily based on GitHub Actions. Using different triggering operations (ex: pushes, pull requests), the CI workflow runs a combination of linting and different test types that are executed depending on the target branch. Additionally, we require all code changes targeting shared branches (`main`, `dev`, `release`) to be integrated through PRs and must be reviewed and approved. This is done through GitHub's branch protection rules and ensures that only reviewed and tested code reaches these branches. The only actions that require user interaction in this automated pipeline are PR related actions (creation, review, merging). 

The CD part of our pipeline extends automation to the application's delivery and environment management. Once the CI pipeline completes successfully and code is merged to either the `dev` or `main` branch, Ansible playbooks automatically build and deploy the application to the proper environment. We use Docker images and containers to maintain consistency across environments and eliminate configuration inconsistencies. All of this is done while keeping security in mind: we store sensitive secrets and credentials using the GitHub Secret Manager. We also have a stage in the workflow that scans the code for leaking secrets and scans both our frontend and backend dependencies for high-risk vulnerabilities. Using this workflow, our pipeline enables faster, more secure, and more reliable releases of our application with minimal manual effort.


#### Technical Approach: Pipeline Figure

![pipeline](https://github.ncsu.edu/aelgend/csc519-task-manager/blob/main/pipeline.svg)

#### Technical Approach: Description of Pipeline

##### Code Stage

We use VS Code as the main IDE to write and debug code locally before committing the changes to GitHub. GitHub serves as the central repository and version control system. All source code and configuration files are stored within the GitHub repository.

##### Continuous Integration (PR to `dev`)

When a developer creates a PR from a feature branch to be merged into the `dev` branch, GitHub Actions runs the CI workflow. The workflow executes backend and frontend linting using Pylint and ESLint, respectively. The linting step is followed by frontend and backend unit and integration tests to ensure that the PR changes did not break functionality. All test cases must be successful for the workflow to continue. Security checks are then run to ensure no secrets were committed and no vulnerabilities exist in our dependencies. The PR must have a reviewer who provides comments or requests changes. The workflow runs using a self-hosted action runner.

##### Provision Test Environment (PR merged to `dev`)

After a PR is merged into `dev`, a new workflow is triggered to build and deploy the application in a controlled test environment. We build Docker images from the latest commit and use Ansible to automatically configure and provision the test server. Ansible ensures that the server has all the required dependencies, system packages, and configurations needed for the application’s Docker containers to run smoothly. Once the environment is ready, the newly built images are deployed. The testing environment is hosted on Google Cloud. This stage is considered successful when the Docker images are deployed, and the environment is correctly configured. Developers use this environment for regression testing.

##### User Acceptance Testing (PR from `dev` to `release`)

When we are ready for a new release, we create a PR from `dev` to `release`. This triggers another workflow that repeats backend and frontend linting and testing (unit and integration), and security checks. E2E tests are also performed using Playwright to simulate real user interactions with the system. The goal of this stage is to validate the application’s overall behavior and functionality before preparing for the production release.

##### Pre-Deployment Stage (PR merged to `release`)

Once the PR is approved and merged into the `release` branch, a new workflow is executed that generates a changelog summarizing all pull requests since the previous release. It also automatically tags the merge commit with a new release tag following the project’s versioning scheme. A new PR is then automatically created by the GitHub bot in the `main` branch.

##### Pre-Deployment Validation (PR from `release` to `main`)

After the creation of an automated PR from `release` to the  `main` branch, all the tests are run for the final validation in the merged code. This includes unit tests, integration tests, followed by E2E tests and security checks. 

##### Deploy to Production (PR merged to `main`)

When the final PR is merged into the `main` branch, the workflow builds the final Docker images from this commit. Once the built images are ready, Ansible connects to the `production` server and performs a rolling restart of the application containers, sequentially stopping and replacing each container with the updated version. The production server is hosted on Google Cloud. The deployment is considered successful once all services are healthy and stable.

#### Use of Generative AI

We mainly used ChatGPT throughout this project for debugging, understanding how different tools work, and getting examples. For instance, when we were working on tests, ChatGPT provided us with examples of how pytest, Jest, and Playwright work, as well as guidance on test case structure and configuration requirements. It was also very helpful for debugging errors in the CI/CD workflows we encountered.

#### Retrospective: What Worked

1. Dividing the work clearly helped us. Ahmed focused on testing and linting, and Uchswas focused on infrastructure, workflows, and deployment. This allowed us to work in parallel.
2. GitHub Issues and the project board kept us organized. We could see exactly what tasks were being worked on and what was left.
3. Using feature branches kept our main code stable. We created a separate branch for each task and merged it only when it was complete.
4. Docker solved our environment problems. It made sure the app ran the same way on everyone's computer.

#### Retrospective: What Didn't Work

1. VCL only lets the person who provisioned the VM connect, and they must stay on the same Wi‑Fi/mobile network, or the firewall blocks SSH, so using VCL wasn’t an option.
2. We didn't have sudo access on the VCL servers. This meant we couldn't use Ansible to install the system packages we needed.
3. At first, our workflows didn’t run in a fixed order, which caused problems. Sometimes, deployment ran before tests, so buggy code got deployed, and we also ran unnecessary tests. For example, running integration tests even after unit tests had already failed
4. Only the repo owner had access to the GitHub repository settings. This caused delays when we needed to change the settings (ex: adding runners, adding GitHub secrets, and variables in the appropriate environment), and that person wasn't available.
5. A few of the Playwright tests were flaky, which took some time to debug.


#### Retrospective: What We Would Do Differently

1. Use Google Cloud from the start. We wasted time trying to make VCL work.
2. Set deadlines for every task. This would help us catch delays earlier.
3. Break large tasks into smaller pieces. This would make it easier to see our progress.
4. Add extra time to our estimates. Debugging took longer than we had anticipated.

#### Who Did What

1. **Uchswas** focused on writing configuration code. It includes packaging the systems (frontend, backend, database) using Docker, deploying the containers using Ansible, and provisioning servers on Google Cloud. After that, he focused on implementing the CI/CD pipeline. That includes writing workflows to trigger tests and deployment, as well as ordering workflow execution using branch-specific workflow pipelines. He also worked on refactoring the  codebase for management and security purposes. 


2. **Ahmed** mainly focused on linting, testing, and the security workflow. He wrote unit and integration tests for the backend using pytest and for the frontend using Jest. He set up Playwright and wrote end-to-end tests for features like logging in, managing tasks, and the dashboard. He also addressed the code style issues in the backend and assisted in integrating security scanning tools into the pipeline.


