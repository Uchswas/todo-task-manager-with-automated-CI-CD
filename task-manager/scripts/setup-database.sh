#!/bin/bash

set -e  # Exit on any error

ORIGINAL_ARGS=("$@")

ENVIRONMENT=""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ENVIRONMENT="${ENVIRONMENT:-dev}"
ENVIRONMENT=$1

# Database configuration based on environment
case "$ENVIRONMENT" in
    dev)
        DB_NAME="${DB_NAME:-todo_app_dev}"
        DB_USER="${DB_USER:-todo_user}"
        DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD}}"
        DB_HOST="${DB_HOST:-localhost}"
        DB_PORT="${DB_PORT:-5432}"
        ;;
    test)
        DB_NAME="${DB_NAME:-todo_app_test}"
        DB_USER="${DB_USER:-todo_user_test}"
        DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_TEST_PASSWORD}}"
        DB_HOST="${DB_HOST:-localhost}"
        DB_PORT="${DB_PORT:-5432}"
        ;;
    *)
        echo -e "${RED}Error: Invalid environment '${ENVIRONMENT}'${NC}"
        echo "Valid options: dev, test, prod"
        exit 1
        ;;
esac

# Validate required password
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Database password is required${NC}"
    echo "Set DB_PASSWORD or POSTGRES_PASSWORD (for dev) / POSTGRES_TEST_PASSWORD (for test) environment variable."
    exit 1
fi

POSTGRES_RUNNER=""

################################################################################
# Privilege Handling
################################################################################

ensure_postgres_runner() {
    # If we are already root, use su to switch to postgres
    if [ "$EUID" -eq 0 ]; then
        if command -v su >/dev/null 2>&1; then
            POSTGRES_RUNNER="su"
            return 0
        fi
        if command -v sudo >/dev/null 2>&1; then
            POSTGRES_RUNNER="sudo"
            return 0
        fi
        echo "This script requires either 'su' or 'sudo' to switch to the postgres user, but neither was found." >&2
        exit 1
    fi

    # Try to run a harmless command as postgres to confirm privileges
    if command -v sudo >/dev/null 2>&1; then
        if sudo -u postgres true 2>/dev/null; then
            POSTGRES_RUNNER="sudo"
            return 0
        fi
        echo "Elevating privileges with sudo to complete database setup..." >&2
        exec sudo "$0" "${ORIGINAL_ARGS[@]}"
    fi

    echo "This script requires the ability to run commands as the 'postgres' user." >&2
    echo "Please run it with sudo or ask an administrator to grant you access." >&2
    exit 1
}

run_as_postgres() {
    if [ -z "$POSTGRES_RUNNER" ]; then
        echo "Internal error: POSTGRES_RUNNER is not configured." >&2
        exit 1
    fi

    if [ "$POSTGRES_RUNNER" = "sudo" ]; then
        sudo -u postgres "$@"
    else
        local cmd=""
        for arg in "$@"; do
            cmd+="$(printf '%q ' "$arg")"
        done
        cmd=${cmd% }
        su - postgres -c "$cmd"
    fi
}

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_error() {
    echo -e "${RED} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW} $1${NC}"
}

print_info() {
    echo -e "${BLUE} $1${NC}"
}

ensure_postgres_runner

################################################################################
# Prerequisite Checks
################################################################################

print_header "Checking Prerequisites"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client (psql) not found"
    echo "Please install PostgreSQL"
    exit 1
fi
print_success "PostgreSQL client found"

# Check if PostgreSQL service is running
if ! sudo service postgresql status &> /dev/null; then
    print_warning "PostgreSQL service is not running"
    print_info "Attempting to start PostgreSQL service..."
    if sudo service postgresql start &> /dev/null; then
        print_success "PostgreSQL service started"
    else
        print_error "Failed to start PostgreSQL service automatically"
        exit 1
    fi
else
    print_success "PostgreSQL service is running"
fi

################################################################################
# Database Setup
################################################################################

print_header "Setting up Database: ${DB_NAME}"

print_info "Dropping database '${DB_NAME}' if it exists..."
run_as_postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null
print_success "Database dropped (if it existed)"

print_info "Dropping user '${DB_USER}' if it exists..."
run_as_postgres psql -c "DROP ROLE IF EXISTS ${DB_USER};" >/dev/null
print_success "User dropped (if it existed)"

# Create database user if it doesn't exist
print_info "Creating database user '${DB_USER}'..."
run_as_postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" >/dev/null
print_success "User '${DB_USER}' created"

# Create database
print_info "Creating database '${DB_NAME}'..."
run_as_postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
print_success "Database '${DB_NAME}' created"

# Grant privileges
print_info "Granting privileges..."
run_as_postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
run_as_postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true
print_success "Privileges granted"

################################################################################
# Verification
################################################################################

print_header "Verifying Database Setup"

# Test connection
if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Failed to connect to database"
    exit 1
fi

# Display database info
print_info "Database Information:"
echo "  Name:     ${DB_NAME}"
echo "  User:     ${DB_USER}"
echo "  Host:     ${DB_HOST}"
echo "  Port:     ${DB_PORT}"

################################################################################
# Summary
################################################################################

print_header "Setup Complete!"
print_success "Database '${DB_NAME}' is ready for use"

