Set-Location $PSScriptRoot\..\..
Write-Host "Starting TimeTracker dev environment..."

if (-not (Test-Path "backend\.env")) {
  Copy-Item "infra\env\.env.example" "backend\.env"
  Write-Host "Created backend/.env — edit DATABASE_URL for your MySQL credentials"
}

if (-not (Test-Path "frontend\apps\web\.env.local")) {
  Copy-Item "frontend\apps\web\.env.local.example" "frontend\apps\web\.env.local"
  Write-Host "Created frontend/apps/web/.env.local"
}

Write-Host ""
Write-Host "Ensure MySQL is running locally and database 'timetracker' exists."
Write-Host "Then run: pnpm db:generate && pnpm db:migrate && pnpm dev"
