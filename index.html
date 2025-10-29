<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'">
    <title>TTT Timer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            background: transparent;
        }

        body {
            background: transparent;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        #titlebar {
            height: 32px;
            background: rgb(30, 30, 30);
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            color: white;
            font-size: 13px;
            backdrop-filter: blur(10px);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 5000;
            transform: translateY(-32px);
            transition: transform 0.3s ease-out;
        }

        #titlebar.visible {
            transform: translateY(0);
        }

        #window-controls {
            -webkit-app-region: no-drag;
            display: flex;
            gap: 0;
        }

        .window-button {
            width: 46px;
            height: 32px;
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
            -webkit-app-region: no-drag;
        }

        .window-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        #config-btn {
            width: 46px;
            height: 32px;
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s;
            -webkit-app-region: no-drag;
        }

        #config-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        #minimize-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        #maximize-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        #close-btn:hover {
            background: #e81123;
        }

        #webview-container {
            width: 100%;
            height: calc(100vh - 50px);
            background: transparent;
            position: relative;
            z-index: 1000;
        }

        #hover-strip {
            height: 50px;
            /* HARDCODED: Use exact same color as React app (rgb 18,18,18) with 15% opacity */
            /* This matches: hexToRgba('#121212', 0.15) from React app */
            background: rgba(18, 18, 18, 0.15);
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            border-top: 1px solid rgba(102, 211, 224, 0.15);
            backdrop-filter: blur(10px);
        }

        #hover-message {
            background: rgba(102, 211, 224, 0.9);
            color: rgba(18, 18, 18, 0.95);
            padding: 8px 16px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 8px rgba(102, 211, 224, 0.3);
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
            pointer-events: none;
        }

        #hover-message.show {
            opacity: 1;
            transform: translateY(0);
        }

        /* Custom resize handles */
        .resize-handle {
            position: fixed;
            z-index: 6000;
            -webkit-app-region: no-drag;
            pointer-events: auto;
        }

        .resize-n {
            top: 0;
            left: 8px;
            right: 8px;
            height: 8px;
            cursor: ns-resize;
        }

        .resize-s {
            bottom: 0;
            left: 8px;
            right: 8px;
            height: 8px;
            cursor: ns-resize;
        }

        .resize-e {
            top: 8px;
            bottom: 8px;
            right: 0;
            width: 8px;
            cursor: ew-resize;
        }

        .resize-w {
            top: 8px;
            bottom: 8px;
            left: 0;
            width: 8px;
            cursor: ew-resize;
        }

        .resize-ne {
            top: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: nesw-resize;
        }

        .resize-nw {
            top: 0;
            left: 0;
            width: 16px;
            height: 16px;
            cursor: nwse-resize;
        }

        .resize-se {
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: nwse-resize;
        }

        .resize-sw {
            bottom: 0;
            left: 0;
            width: 16px;
            height: 16px;
            cursor: nesw-resize;
        }

        .resize-handle:hover {
            background: rgba(102, 211, 224, 0.3);
        }

        .resize-handle.resizing {
            background: rgba(102, 211, 224, 0.5);
        }
    </style>
</head>
<body>
    <div id="titlebar">
        <div style="display: flex; align-items: center; -webkit-app-region: drag;">
            <span id="title-text">TTT Timer</span>
        </div>
        <div id="window-controls">
            <button id="config-btn" title="Settings">&#9881;</button>
            <button class="window-button" id="minimize-btn" title="Minimize">-</button>
            <button class="window-button" id="maximize-btn" title="Maximize">[]</button>
            <button class="window-button" id="close-btn" title="Close">X</button>
        </div>
    </div>

    <div id="webview-container">
        <!-- WebContentsView added by main process -->
    </div>

    <div id="hover-strip">
        <div id="hover-message">RIGHT CLICK FOR CONTROLS</div>
    </div>

    <!-- Custom resize handles -->
    <div class="resize-handle resize-n" data-direction="n"></div>
    <div class="resize-handle resize-s" data-direction="s"></div>
    <div class="resize-handle resize-e" data-direction="e"></div>
    <div class="resize-handle resize-w" data-direction="w"></div>
    <div class="resize-handle resize-ne" data-direction="ne"></div>
    <div class="resize-handle resize-nw" data-direction="nw"></div>
    <div class="resize-handle resize-se" data-direction="se"></div>
    <div class="resize-handle resize-sw" data-direction="sw"></div>

    <script>
        function log(message) {
            console.log(message);
            window.electronAPI.logToMain(message);
        }

        const titlebar = document.getElementById('titlebar');
        let titlebarVisible = false;

        // Show titlebar - NOTIFY MAIN PROCESS FIRST, THEN ANIMATE
        function showTitlebar() {
            if (!titlebarVisible) {
                titlebarVisible = true;
                
                window.electronAPI.notifyTitlebarVisibility(true);
                log('[TITLEBAR] Notified main process - WebView should move down');
                
                setTimeout(() => {
                    titlebar.classList.add('visible');
                    log('[TITLEBAR] CSS animation started - titlebar sliding down');
                }, 10);
            }
        }

        // Hide titlebar - NOTIFY MAIN PROCESS FIRST, THEN ANIMATE
        function hideTitlebar() {
            if (titlebarVisible) {
                titlebarVisible = false;
                
                window.electronAPI.notifyTitlebarVisibility(false);
                log('[TITLEBAR] Notified main process - WebView should move up');
                
                titlebar.classList.remove('visible');
                log('[TITLEBAR] CSS animation started - titlebar sliding up');
            }
        }

        function toggleTitlebar() {
            if (titlebarVisible) {
                hideTitlebar();
            } else {
                showTitlebar();
            }
        }

        window.electronAPI.onTitlebarToggle(() => {
            log('[TITLEBAR] Toggle command received from main process');
            toggleTitlebar();
        });

        // Hide titlebar when clicking outside
        document.addEventListener('click', (e) => {
            const onTitlebar = titlebar.contains(e.target);
            const onResizeHandle = e.target.classList.contains('resize-handle');
            
            if (!onTitlebar && !onResizeHandle && titlebarVisible) {
                hideTitlebar();
            }
        });

        // Window controls
        document.getElementById('minimize-btn').addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        document.getElementById('maximize-btn').addEventListener('click', () => {
            window.electronAPI.toggleMaximize();
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });

        // Settings
        const configBtn = document.getElementById('config-btn');
        const titleText = document.getElementById('title-text');

        configBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.electronAPI.openSettings();
        });

        function capitalizeTeam(team) {
            return team.charAt(0).toUpperCase() + team.slice(1);
        }

        function updateTitle(team) {
            if (team) {
                titleText.textContent = `TTT Timer - ${capitalizeTeam(team)}`;
            } else {
                titleText.textContent = 'TTT Timer';
            }
        }

        function getTeamUrl(team) {
            return `https://${team}.ttt-timer.com`;
        }

        window.electronAPI.onTeamUpdated((team) => {
            log(`[SETTINGS] Team updated to: ${team}`);
            updateTitle(team);
            const teamUrl = getTeamUrl(team);
            window.electronAPI.loadURL(teamUrl);
        });

        window.addEventListener('DOMContentLoaded', () => {
            const savedTeam = localStorage.getItem('selected-team') || 'sigrid';
            updateTitle(savedTeam);
            const teamUrl = getTeamUrl(savedTeam);
            window.electronAPI.loadURL(teamUrl);
        });

        // Hover message
        const hoverMessage = document.getElementById('hover-message');
        let hoverTimeout = null;
        let hideTimeout = null;
        let isInWindow = false;

        function startAnimation() {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hideTimeout) clearTimeout(hideTimeout);
            
            hoverMessage.classList.remove('show');

            hoverTimeout = setTimeout(() => {
                hoverMessage.classList.add('show');
                hideTimeout = setTimeout(() => {
                    hoverMessage.classList.remove('show');
                }, 3000);
            }, 500);
        }

        function stopAnimation() {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hideTimeout) clearTimeout(hideTimeout);
            hoverMessage.classList.remove('show');
        }

        async function checkMouseInWindow() {
            try {
                const mousePos = await window.electronAPI.getMousePosition();
                const windowBounds = await window.electronAPI.getWindowBounds();
                
                if (!mousePos || !windowBounds) return;
                
                const inBounds = mousePos.x >= windowBounds.x && 
                                mousePos.x <= windowBounds.x + windowBounds.width &&
                                mousePos.y >= windowBounds.y && 
                                mousePos.y <= windowBounds.y + windowBounds.height;
                
                if (inBounds && !isInWindow) {
                    isInWindow = true;
                    startAnimation();
                } else if (!inBounds && isInWindow) {
                    isInWindow = false;
                    stopAnimation();
                }
            } catch (err) {
                console.error('Error checking mouse position:', err);
            }
        }

        setInterval(checkMouseInWindow, 50);

        // Custom resize handles
        let isResizing = false;
        let resizeDirection = null;
        let startX = 0;
        let startY = 0;

        const resizeHandles = document.querySelectorAll('.resize-handle');

        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                isResizing = true;
                resizeDirection = handle.getAttribute('data-direction');
                startX = e.screenX;
                startY = e.screenY;
                
                handle.classList.add('resizing');
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.screenX - startX;
            const deltaY = e.screenY - startY;

            window.electronAPI.resizeWindow(resizeDirection, deltaX, deltaY);

            startX = e.screenX;
            startY = e.screenY;
        });

        document.addEventListener('mouseup', (e) => {
            if (isResizing) {
                isResizing = false;
                resizeHandles.forEach(handle => {
                    handle.classList.remove('resizing');
                });
                resizeDirection = null;
            }
        });

        // Mousewheel scrolling
        document.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                window.electronAPI.scrollWindow(e.deltaY);
            }
        }, { passive: false });

        log('[INIT] TTT Timer initialized - hover strip hardcoded to rgba(18,18,18,0.15)');
    </script>
</body>
</html>