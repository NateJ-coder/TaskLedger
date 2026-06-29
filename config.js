// Configuration file for TaskLedger
// API key for Gemini chatbot
// Get your API key from: https://makersuite.google.com/app/apikey

export const config = {
  // API key from .env file
  GEMINI_API_KEY: 'AIzaSyAQ.Ab8RN6IW5oHpMScDSS-H1ikcNOUP6-nxw1GUv8JGNlRFE-P6ow',
  
  // API endpoint - using gemini-2.0-flash-exp (tested and working)
  geminiApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
};