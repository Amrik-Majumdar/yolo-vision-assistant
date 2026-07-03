# Setup script for Windows
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vision Assistant Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "[1/6] Checking for Python..." -ForegroundColor Yellow
try {
    $pythonVer = python --version 2>&1
    Write-Host "  Found: $pythonVer" -ForegroundColor Green
} catch {
    Write-Host "  Python not found! Install Python 3.8 or newer" -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
Write-Host "[2/6] Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node --version 2>&1
    Write-Host "  Found: Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  Node.js not found! Install Node.js 14 or newer" -ForegroundColor Red
    exit 1
}

# Create Python virtual environment
Write-Host "[3/6] Setting up Python environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "  Virtual environment already exists" -ForegroundColor Gray
} else {
    python -m venv venv
    Write-Host "  Created virtual environment" -ForegroundColor Green
}

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"
Write-Host "  Activated virtual environment" -ForegroundColor Green

# Install Python packages
Write-Host "[4/6] Installing Python packages..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
pip install requests --quiet
Write-Host "  Installed Python packages" -ForegroundColor Green

# Download YOLO model
Write-Host "[5/6] Downloading YOLO model..." -ForegroundColor Yellow
if (Test-Path "models\yolov8n.onnx") {
    Write-Host "  Model already downloaded" -ForegroundColor Gray
} else {
    python download_model.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Model downloaded successfully" -ForegroundColor Green
    } else {
        Write-Host "  Model download failed" -ForegroundColor Red
        exit 1
    }
}

# Install Node.js packages
Write-Host "[6/6] Installing Node.js packages..." -ForegroundColor Yellow
Push-Location backend
npm install --silent
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Installed Node.js packages" -ForegroundColor Green
} else {
    Write-Host "  Installation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the app:" -ForegroundColor White
Write-Host "  1. Run: cd backend && node server.js" -ForegroundColor Yellow
Write-Host "  2. Open: http://localhost:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or just run: .\start.ps1" -ForegroundColor Cyan
Write-Host ""

# Ask to start now
$answer = Read-Host "Start the app now? (Y/n)"
if ($answer -eq "" -or $answer -eq "Y" -or $answer -eq "y") {
    Write-Host ""
    Write-Host "Starting server..." -ForegroundColor Yellow
    
    # Start server in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; node server.js"
    
    # Wait for server
    Start-Sleep -Seconds 2
    
    # Open browser
    Write-Host "Opening browser..." -ForegroundColor Yellow
    Start-Process "http://localhost:5000"
    
    Write-Host ""
    Write-Host "App started!" -ForegroundColor Green
    Write-Host "  Server running in new window" -ForegroundColor Gray
}