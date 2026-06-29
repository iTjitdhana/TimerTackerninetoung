#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "Starting TimeTracker dev environment..."

if [ ! -f backend/.env ]; then
  cp infra/env/.env.example backend/.env
  echo "Created backend/.env — edit DATABASE_URL for your MySQL credentials"
fi

if [ ! -f frontend/apps/web/.env.local ]; then
  cp frontend/apps/web/.env.local.example frontend/apps/web/.env.local
  echo "Created frontend/apps/web/.env.local"
fi

echo ""
echo "Ensure MySQL is running locally and database 'timetracker' exists."
echo "Then run: pnpm db:generate && pnpm db:migrate && pnpm dev"
