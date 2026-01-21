// Configuration file for TaskLedger
// To use the chatbot, add your Gemini API key here
// Get your API key from: https://makersuite.google.com/app/apikey

export const config = {
  // API key for Gemini chatbot
  GEMINI_API_KEY: 'AIzaSyDwxP9c6LFGUxApU6OD7f6OJyBA1VvIAQk',
  
  // API endpoint - using gemini-2.0-flash-exp (tested and working)
  geminiApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
};

// Note: .env files only work with build tools (Vite, Webpack, etc.)
// For a static HTML site, use localStorage or add the key directly above
