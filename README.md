# Electron WebView App

A frameless, transparent Electron application with a single webview component that can display any URL.

## Features

- **Frameless Window**: Clean UI without standard window chrome
- **Transparent Background**: Modern, sleek appearance
- **Configurable WebView**: Point to any URL at runtime
- **Custom Title Bar**: Draggable title bar with window controls
- **Persistent Settings**: URL preferences saved locally
- **Windows Installers**: Build as EXE (NSIS) or MSI

## Project Structure

```
electron-webview-app/
├── main.js              # Electron main process
├── index.html           # Renderer HTML with webview
├── preload.js           # Security preload script
├── package.json         # Dependencies and build config
├── setup.ps1            # PowerShell setup script
├── build.ps1            # PowerShell build script
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Prerequisites

- **Node.js** (v18 or higher): [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **PowerShell** (Windows)
- **Git** (for version control)

## Setup Instructions

### 1. Initial Setup

```powershell
# Run the setup script to install dependencies
.\setup.ps1
```

This will:
- Check for Node.js and npm
- Install all required dependencies
- Prepare the project for development

### 2. Development

```powershell
# Start the app in development mode
npm start
```

The app will launch with:
- A frameless, transparent window
- Default webview pointing to Google
- A settings button to configure the URL
- Window controls (minimize, maximize, close)

### 3. Configuring the WebView

Once the app is running:
1. Click the "⚙ Configure URL" button in the title bar
2. Enter your desired URL (e.g., `https://example.com`)
3. Click "Load" or press Enter
4. The URL is saved and will persist between sessions

### 4. Building for Production

```powershell
# Build installable packages (EXE and MSI)
.\build.ps1
```

This creates:
- **NSIS Installer** (.exe): Full-featured installer with options
- **MSI Installer** (.msi): Windows Installer package

Build outputs are located in the `dist/` folder.

## VSCode Setup

### Recommended Extensions

- **ESLint**: For code linting
- **Prettier**: For code formatting
- **Electron Debug**: For debugging Electron apps

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

### Tasks Configuration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Electron",
      "type": "npm",
      "script": "start",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Build for Windows",
      "type": "npm",
      "script": "build:win",
      "problemMatcher": []
    }
  ]
}
```

## Customization

### Change Default URL

Edit `index.html` and modify the webview src:

```html
<webview id="webview" src="https://your-url-here.com"></webview>
```

Also update the default value in the URL input:

```html
<input type="text" id="url-input" value="https://your-url-here.com">
```

### Window Size

Edit `main.js` to change default dimensions:

```javascript
mainWindow = new BrowserWindow({
  width: 1200,  // Change width
  height: 800,  // Change height
  // ...
});
```

### Transparency

To disable transparency (solid window):
1. Remove `transparent: true` from `main.js`
2. Remove `backgroundColor: '#00000000'` from `main.js`
3. Update background colors in `index.html`

### Add Application Icon

1. Create an icon file: `build/icon.ico` (256x256 or larger)
2. Icon will be used automatically during build
3. For development, add icon parameter to BrowserWindow in `main.js`:

```javascript
mainWindow = new BrowserWindow({
  // ... other options
  icon: path.join(__dirname, 'build/icon.ico')
});
```

## Build Configuration

The `package.json` includes electron-builder configuration:

- **Output Directory**: `dist/`
- **Targets**: NSIS installer and MSI package
- **Architecture**: x64
- **Files Included**: Only essential runtime files

### Build Options

```powershell
# Build directory only (no installer)
npm run build:dir

# Build just the package (no installer)
npm run pack

# Build with specific options
npm run build:win
```

## Troubleshooting

### "electron is not recognized"

**Solution**: Run `.\setup.ps1` to install dependencies

### Build fails with icon error

**Solution**: Create a `build/` folder and add `icon.ico`, or remove the icon configuration from `package.json`

### WebView doesn't load

**Possible causes**:
1. Invalid URL format (must include `https://` or `http://`)
2. Network connectivity issues
3. CORS restrictions on target site

### Window controls don't work

**Solution**: The app requires `@electron/remote` for window controls. Install it:

```powershell
npm install @electron/remote
```

Then add to `main.js`:

```javascript
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

// In createWindow function:
remoteMain.enable(mainWindow.webContents);
```

## Deployment

### Git Repository Setup

```powershell
# Initialize git repository
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Electron WebView App"

# Add remote repository
git remote add origin https://github.com/yourusername/electron-webview-app.git

# Push to GitHub
git push -u origin main
```

### Distribution

After building:
1. Test the installer on a clean Windows machine
2. The installer/MSI files in `dist/` can be distributed directly
3. Consider code signing for production releases
4. Host on GitHub Releases or your preferred platform

## Security Notes

- WebView sandboxing is enabled by default
- Context isolation is enabled for security
- Node integration is disabled in renderer
- Use preload scripts for any IPC communication

## License

MIT

## Support

For issues or questions:
1. Check the Electron documentation: https://www.electronjs.org/docs
2. Check electron-builder documentation: https://www.electron.build/
3. Open an issue on GitHub
