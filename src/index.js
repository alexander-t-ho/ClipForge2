import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Add a test to see if we can even log to console
console.log('=== Index.js loaded ===');
console.log('React:', typeof React);
console.log('ReactDOM:', typeof ReactDOM);
console.log('Document ready state:', document.readyState);

// Error boundary handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error lineno:', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Wait for DOM to be ready
function init() {
  console.log('=== Initializing React App ===');
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);
  console.log('Document body:', document.body);
  
  if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<div style="padding: 20px; color: red; background: black; font-size: 24px;">ERROR: Root element not found!</div>';
    return;
  }
  
  // Add a visible test element first to verify rendering works
  rootElement.innerHTML = '<div style="padding: 20px; color: white; background: #333; font-size: 20px; position: fixed; top: 0; left: 0; right: 0; z-index: 9999;">Loading ClipForge...</div>';
  
  try {
    console.log('Creating React root...');
    const root = ReactDOM.createRoot(rootElement);
    console.log('React root created:', root);
    console.log('Rendering simple test component first...');
    
    // First try a simple test component
    root.render(React.createElement('div', { 
      style: { 
        padding: '20px', 
        color: 'white', 
        background: '#333', 
        fontSize: '20px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      } 
    }, 'React is working! Loading App...'));
    
    console.log('✅ Simple React component rendered');
    
    // Then try the App component after a delay
    setTimeout(() => {
      console.log('Now rendering App component...');
      root.render(React.createElement(App));
      console.log('✅ App component rendered');
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to render React app:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: white; background: #ff0000; font-family: monospace; white-space: pre-wrap;">
        <h1>Error Loading App</h1>
        <p><strong>${error.name}: ${error.message}</strong></p>
        <pre style="background: #000; padding: 10px; overflow: auto;">${error.stack}</pre>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
  console.log('Waiting for DOMContentLoaded...');
} else {
  console.log('DOM already ready, initializing immediately...');
  init();
}
