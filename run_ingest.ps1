$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
& .\.venv\Scripts\python.exe -m src.ingest @args
