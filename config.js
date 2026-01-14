// Configuration file for TaskLedger
// To use the chatbot, add your Gemini API key here
// Get your API key from: https://makersuite.google.com/app/apikey

export const config = {
  // Option 1: Add your API key directly here (NOT recommended for production)
  // GEMINI_API_KEY: 'your_api_key_here',
  
  // Option 2: Will try to read from localStorage (recommended for client-side)
  // Run in console: localStorage.setItem('GEMINI_API_KEY', 'your_key_here')
  GEMINI_API_KEY: localStorage.getItem('GEMINI_API_KEY') || '',
};

// Note: .env files only work with build tools (Vite, Webpack, etc.)
// For a static HTML site, use localStorage or add the key directly above
