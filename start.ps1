# Start development mode for Electron WebView App

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Starting Electron WebView App" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "ERROR: Dependencies not installed!" -ForegroundColor Red
    Write-Host "Please run setup.ps1 first" -ForegroundColor Red
    exit 1
}

Write-Host "Launching application in development mode..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Tips:" -ForegroundColor Cyan
Write-Host "  - Use Ctrl+Shift+I in the app to open DevTools" -ForegroundColor White
Write-Host "  - Press Ctrl+C in this window to stop the app" -ForegroundColor White
Write-Host ""

npm start