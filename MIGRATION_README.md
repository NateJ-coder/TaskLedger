# One-Time Migration Instructions

## How to Run the Migration

1. **Temporarily add** the migration script to your `index.html`:

   ```html
   <script type="module" src="firebase-config.js"></script>
   <script type="module" src="migrate-needs.js"></script>
   <script type="module" src="script.js"></script>
   ```

2. **Refresh** your browser

3. **Click OK** when prompted to run the migration

4. **Check the console** for success messages

5. **Remove** the migration script line from `index.html`

6. **Delete** both `migrate-needs.js` and this file

## What It Does

- Finds all tasks with string-based needs
- Converts them to object format: `{ text: "...", priority: "medium", createdAt: Date }`
- Updates Firestore automatically
- Shows progress in console

## After Migration

Your app will work perfectly with both:
- Old tasks (now migrated)
- New tasks (already in correct format)

No more TypeErrors! 🎉
