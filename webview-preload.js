// Webview preload script - tracks mouse events inside webview and communicates to parent
// Uses postMessage for secure communication without nodeintegration

let isMouseInWebview = false;

window.addEventListener('DOMContentLoaded', () => {
    console.log('Webview preload loaded');
    
    // Track when mouse enters the webview content
    document.addEventListener('mouseenter', () => {
        if (!isMouseInWebview) {
            isMouseInWebview = true;
            // Send message to parent via postMessage
            window.parent.postMessage({ type: 'webview-mouse-enter' }, '*');
        }
    });

    // Track when mouse leaves the webview content  
    document.addEventListener('mouseleave', () => {
        if (isMouseInWebview) {
            isMouseInWebview = false;
            // Send message to parent via postMessage
            window.parent.postMessage({ type: 'webview-mouse-leave' }, '*');
        }
    });

    // Track mouse movement continuously
    let lastMoveTime = Date.now();
    document.addEventListener('mousemove', (e) => {
        lastMoveTime = Date.now();
        // Send mouse position updates
        window.parent.postMessage({ 
            type: 'webview-mouse-move', 
            x: e.clientX, 
            y: e.clientY 
        }, '*');
    });

    // Check for mouse inactivity (means it left)
    setInterval(() => {
        if (isMouseInWebview && Date.now() - lastMoveTime > 100) {
            isMouseInWebview = false;
            window.parent.postMessage({ type: 'webview-mouse-leave' }, '*');
        }
    }, 50);
});