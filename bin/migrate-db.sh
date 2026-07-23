#!/usr/bin/env bash
# Script: Apply PostgreSQL Schema Migrations
# Purpose: Run backend/_shared/migrations/*.sql against local or deployed PostgreSQL
# Usage: ./bin/migrate-db.sh [local|aws]

set -e

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [local|aws]"
    echo "Apply pending SQL migrations to PostgreSQL (default: local)"
    echo ""
    echo "  local  Connects to the PostgreSQL instance started by setup-environment.sh"
    echo "  aws    Reads Aurora connection details from Terraform outputs"
    exit 0
fi

TARGET="${1:-local}"

SCRIPT_DIR="$(cd "$(dirname "$0")" > /dev/null 2>&1 || exit 1; pwd -P)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." > /dev/null 2>&1 || exit 1; pwd -P)"
INFRA_DIR="$PROJECT_ROOT/infra"
SHARED_DIR="$PROJECT_ROOT/backend/_shared"

echo "======================================"
echo "Coding Workshop - Database Migrations"
echo "======================================"
echo ""

echo "Installing migration runner dependencies..."
python3 -m pip install --quiet --user -r "$SHARED_DIR/requirements.txt"

if [ "$TARGET" = "local" ]; then
    echo "Target: local PostgreSQL (localhost:5432)"
    export IS_LOCAL=true
    export POSTGRES_HOST=localhost
    export POSTGRES_PORT=5432
    export POSTGRES_USER=postgres
    export POSTGRES_PASS=postgres123
    export POSTGRES_NAME=postgres
elif [ "$TARGET" = "aws" ]; then
    echo "Target: AWS Aurora PostgreSQL"

    PARTICIPANT_CONFIG="$PROJECT_ROOT/ENVIRONMENT.config"
    if [ -f "$PARTICIPANT_CONFIG" ]; then
        source "$PARTICIPANT_CONFIG"
    fi

    cd "$INFRA_DIR"
    BUCKET_NAME="coding-workshop-tfstate-${PARTICIPANT_ID:-abcd1234}"
    terraform init -reconfigure \
        -backend-config="bucket=$BUCKET_NAME" \
        -backend-config="region=${AWS_REGION:-us-east-1}" \
        > /dev/null 2>&1

    CONN_JSON=$(terraform output -json postgres_connection 2>/dev/null || echo "{}")
    export IS_LOCAL=false

    ENV_EXPORTS=$(echo "$CONN_JSON" | python3 -c '
import json, sys, shlex
d = json.load(sys.stdin)
mapping = {
    "host": "POSTGRES_HOST",
    "port": "POSTGRES_PORT",
    "database": "POSTGRES_NAME",
    "username": "POSTGRES_USER",
    "password": "POSTGRES_PASS",
}
for key, env_name in mapping.items():
    print(f"export {env_name}={shlex.quote(str(d.get(key, \"\")))}")
')
    eval "$ENV_EXPORTS"

    if [ -z "$POSTGRES_HOST" ]; then
        echo "  ✗ Could not resolve Aurora connection details from Terraform outputs."
        echo "    Make sure ./bin/deploy-backend.sh aws has been run first."
        exit 1
    fi

    cd "$PROJECT_ROOT"
else
    echo "Unknown target: $TARGET (expected 'local' or 'aws')"
    exit 1
fi

echo ""
python3 "$SHARED_DIR/migrate.py"
