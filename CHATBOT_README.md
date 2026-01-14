# AI Chatbot Setup Guide

## Overview
The AI chatbot provides intelligent assistance for TaskLedger, helping Craig and Nate:
- Answer questions about how to use TaskLedger features
- Retrieve stored information (login details, credentials, contacts)
- Get context-aware help based on current tasks and needs
- Access a knowledge base of critical information

## Setup Instructions

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure the API Key

#### Option A: Using Environment Variables (Recommended for Development)
1. Create a `.env` file in the project root
2. Add your API key:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Restart your development server

#### Option B: Using Browser localStorage (For Testing)
1. Open browser console (F12)
2. Run:
   ```javascript
   localStorage.setItem('GEMINI_API_KEY', 'your_actual_api_key_here');
   ```
3. Refresh the page

### 3. How It Works

#### Knowledge Base
- The chatbot automatically extracts critical information from:
  - Task descriptions containing keywords: login, password, credential, username, email, phone, contact
  - Updates and memos with important details
- Information is saved to Firestore when the app closes
- The knowledge base persists across sessions

#### Context Awareness
The chatbot has access to:
- Current user (Craig or Nate)
- Active tasks, needs, and memos
- Recent activity
- Knowledge base entries

#### Smart Information Extraction
- Runs automatically when the browser tab closes
- Extracts and saves credential information
- Tags content with relevant keywords
- Avoids duplicate entries

## Usage Examples

### Ask About Features
- "How do I fulfill a need?"
- "What's the difference between completing and fulfilling a need?"
- "How do I submit a task for review?"

### Retrieve Information
- "What are the login details for the client portal?"
- "Show me contact information for Project X"
- "What's the password for the admin panel?"

### Get Context Help
- "What tasks are currently pending?"
- "Show me my active needs"
- "What's the status of the project?"

## Knowledge Base Structure

Each knowledge entry contains:
- **Type**: credential, update, or other
- **Source**: Where it came from (task, memo, update)
- **Title**: Brief description
- **Content**: Full text
- **Tags**: Keywords for searching
- **Metadata**: Created by, timestamp, task ID

## Cost Optimization

The chatbot is designed to minimize API costs:
1. **Batch Processing**: Information extraction happens only on app close
2. **Context Limits**: Only sends last 10 messages and top 3 knowledge matches
3. **Smart Caching**: Knowledge base is loaded once per session
4. **Deduplication**: Prevents saving duplicate information

## Troubleshooting

### "Gemini API key not found"
- Check your `.env` file has the correct variable name: `VITE_GEMINI_API_KEY`
- Or set it in localStorage: `localStorage.setItem('GEMINI_API_KEY', 'your_key')`
- Restart dev server after adding `.env`

### Chat not responding
- Check browser console for errors
- Verify API key is valid
- Check network tab for API request failures

### Knowledge base not populating
- Ensure tasks/memos contain keywords like "login", "password", "credential"
- Check Firestore for the `knowledgeBase` collection
- Close and reopen the app to trigger extraction

## Security Notes

⚠️ **Important**: 
- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- API keys in localStorage are visible in browser dev tools
- For production, use a backend proxy to protect the API key
- Knowledge base in Firestore should have proper security rules

## Future Enhancements

Potential improvements:
- Backend API proxy for secure key management
- More sophisticated NLP for information extraction
- Categorized knowledge base (credentials, contacts, resources)
- Manual knowledge entry interface
- Export/import knowledge base
- Search and edit knowledge entries
