# TaskLedger AI Chatbot - Quick Start

## ⚠️ Important Note
Since TaskLedger is a static HTML/JS application, it cannot directly read `.env` files. You have **two options** to configure your API key:

## Option 1: Easy Setup Page (Recommended ✨)

1. **Get Your API Key**: Visit https://makersuite.google.com/app/apikey

2. **Open Setup Page**: Open `setup-api.html` in your browser

3. **Enter Your Key**: Paste your API key and click "Save"

4. **Done!** You'll be redirected to TaskLedger automatically

## Option 2: Browser Console

1. **Get Your API Key**: Visit https://makersuite.google.com/app/apikey

2. **Open TaskLedger**: Go to `index.html`

3. **Open Console**: Press F12, go to Console tab

4. **Run This Command**:
   ```javascript
   localStorage.setItem('GEMINI_API_KEY', 'your_actual_api_key_here');
   ```

5. **Refresh**: Press F5 to reload the page

## Option 3: config.js File (For Developers)

If you want to hardcode the key (not recommended for sharing):

1. Open `config.js`
2. Uncomment and edit this line:
   ```javascript
   GEMINI_API_KEY: 'your_api_key_here',
   ```
3. Save and refresh

## Test the Chatbot

1. Click the 🤖 button in the bottom-right corner

2. Ask a question like:
   - "How do I fulfill a need?"
   - "What tasks are currently active?"
   - "What are my pending needs?"

## Using the Knowledge Base

The chatbot will automatically remember important information like:
- Login credentials mentioned in tasks
- Contact details in memos
- Important links and notes

Just include keywords like "login", "password", "contact", "email" in your tasks/memos.

---

## Troubleshooting

**"Gemini API key not found" error?**
- Make sure you saved the key using one of the options above
- Check the console: `localStorage.getItem('GEMINI_API_KEY')`
- Try opening `setup-api.html` again

**Chat not responding?**
- Open browser console (F12) and check for errors
- Verify your API key is valid at https://makersuite.google.com/app/apikey
- Make sure you have internet connection

---

See CHATBOT_README.md for detailed documentation.
