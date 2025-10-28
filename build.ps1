# Build script for Electron WebView App
# Creates installable EXE and MSI files

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Electron WebView App - Build" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "ERROR: Dependencies not installed!" -ForegroundColor Red
    Write-Host "Please run setup.ps1 first" -ForegroundColor Red
    exit 1
}

Write-Host "Building application..." -ForegroundColor Yellow
Write-Host ""

# Build for Windows (NSIS installer and MSI)
npm run build:win

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output location:" -ForegroundColor Cyan
    Write-Host "  dist/" -ForegroundColor White
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    
    if (Test-Path "dist/*.exe") {
        Get-ChildItem "dist/*.exe" | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Green
        }
    }
    
    if (Test-Path "dist/*.msi") {
        Get-ChildItem "dist/*.msi" | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Green
        }
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}