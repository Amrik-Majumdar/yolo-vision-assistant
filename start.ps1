# Quick start script
Write-Host "Starting Vision Assistant..." -ForegroundColor Cyan
Write-Host ""

# Check if setup was run
if (!(Test-Path "backend\node_modules")) {
    Write-Host "Please run setup.ps1 first" -ForegroundColor Red
    exit 1
}

if (!(Test-Path "models\yolov8n.onnx")) {
    Write-Host "YOLO model missing. Please run setup.ps1 first" -ForegroundColor Red
    exit 1
}

# Start server
Write-Host "Starting server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; node server.js"

# Wait a bit
Start-Sleep -Seconds 2

# Open browser
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5000"

Write-Host ""
Write-Host "App started!" -ForegroundColor Green
Write-Host "  Open: http://localhost:5000" -ForegroundColor Gray
Write-Host "  Press Ctrl+C in the server window to stop" -ForegroundColor Gray
Write-Host ""