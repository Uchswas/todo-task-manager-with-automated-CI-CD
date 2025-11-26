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

# Database configuration - all values must come from environment variables
# Map POSTGRES_* variables to DB_* if DB_* are not explicitly set
DB_NAME="${DB_NAME:-${POSTGRES_DB}}"
DB_USER="${DB_USER:-${POSTGRES_USER}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD}}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Validate required variables
if [ -z "$DB_NAME" ]; then
    echo -e "${RED}Error: Database name is required${NC}"
    echo "Set DB_NAME or POSTGRES_DB environment variable."
    exit 1
fi

if [ -z "$DB_USER" ]; then
    echo -e "${RED}Error: Database user is required${NC}"
    echo "Set DB_USER or POSTGRES_USER environment variable."
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: Database password is required${NC}"
    echo "Set DB_PASSWORD or POSTGRES_PASSWORD environment variable."
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
    # If connecting to remote/Docker database, use direct psql connection
    if [ "${DB_HOST:-localhost}" != "localhost" ]; then
        # Docker/remote mode: use POSTGRES_USER as superuser for admin operations
        # In Docker, when POSTGRES_USER is set, that user is created as a superuser
        # with the password from POSTGRES_PASSWORD, so we can use it for admin operations
        # If POSTGRES_USER equals DB_USER, we can still use it since it's a superuser
        local superuser="${POSTGRES_USER:-postgres}"
        
        # Connect to 'postgres' database for admin operations (unless command specifies -d)
        # Check if the command already specifies a database
        local db_specified=false
        for arg in "$@"; do
            if [ "$arg" = "-d" ] || [ "$arg" = "--dbname" ]; then
                db_specified=true
                break
            fi
        done
        
        if [ "$db_specified" = false ]; then
            # No database specified, connect to 'postgres' for admin operations
            PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${superuser}" -d postgres "$@"
        else
            # Database already specified in command
            PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT:-5432}" -U "${superuser}" "$@"
        fi
    else
        # Local mode: switch to postgres user
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

# Only ensure postgres runner for local setup (not Docker/remote)
if [ "${DB_HOST:-localhost}" = "localhost" ]; then
    ensure_postgres_runner
fi

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

# Check if PostgreSQL service is running (skip in Docker - DB_HOST != localhost means remote/Docker)
if [ "${DB_HOST:-localhost}" = "localhost" ]; then
    # Only check service status when running locally
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
else
    # Running in Docker or remote - skip service check
    print_info "Running in Docker/remote mode (DB_HOST=${DB_HOST}), skipping service check"
fi

################################################################################
# Database Setup
################################################################################

print_header "Setting up Database: ${DB_NAME}"

# In Docker, the user might already exist (created by POSTGRES_USER env var)
# Check if user exists and create/update accordingly
print_info "Ensuring database user '${DB_USER}' exists..."
if run_as_postgres -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';" -t 2>/dev/null | grep -q 1; then
    print_info "User '${DB_USER}' already exists, updating password..."
    run_as_postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" >/dev/null
else
    print_info "Creating database user '${DB_USER}'..."
    run_as_postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" >/dev/null
fi
print_success "User '${DB_USER}' ready"

# Check if database exists
print_info "Ensuring database '${DB_NAME}' exists..."
if run_as_postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
    print_info "Database '${DB_NAME}' already exists"
    # Update owner if needed
    run_as_postgres -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};" >/dev/null 2>&1 || true
else
    print_info "Creating database '${DB_NAME}'..."
    run_as_postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
fi
print_success "Database '${DB_NAME}' ready"

# Grant privileges
print_info "Granting privileges..."
run_as_postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
run_as_postgres -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true
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

