// ONE-TIME MIGRATION SCRIPT
// This script converts old string-based needs to new object format
// Run this once, then delete this file

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function migrateNeeds() {
  console.log("🔄 Starting needs migration...");
  
  const tasksCollection = collection(db, "tasks");
  const snapshot = await getDocs(tasksCollection);
  
  let migratedCount = 0;
  let alreadyMigratedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const task = docSnap.data();
    const needs = task.needs || [];
    
    // Check if migration is needed
    const hasStringNeeds = needs.some(need => typeof need === 'string');
    
    if (hasStringNeeds) {
      // Convert all needs to object format
      const migratedNeeds = needs.map(need => {
        if (typeof need === 'string') {
          return {
            text: need,
            priority: 'medium',
            createdAt: new Date()
          };
        }
        return need; // Already an object
      });
      
      // Update the document
      const taskDoc = doc(db, "tasks", docSnap.id);
      await updateDoc(taskDoc, { needs: migratedNeeds });
      
      console.log(`✅ Migrated task: "${task.title}" (${needs.length} needs)`);
      migratedCount++;
    } else {
      alreadyMigratedCount++;
    }
  }
  
  console.log("\n📊 Migration Complete!");
  console.log(`   Migrated: ${migratedCount} tasks`);
  console.log(`   Already up-to-date: ${alreadyMigratedCount} tasks`);
  console.log(`   Total: ${snapshot.size} tasks`);
  console.log("\n✨ You can now safely delete migrate-needs.js");
}

// Auto-run on page load
document.addEventListener("DOMContentLoaded", () => {
  const runMigration = confirm(
    "🔄 Run one-time needs migration?\n\n" +
    "This will convert all old string-based needs to the new object format.\n\n" +
    "Click OK to proceed, or Cancel if you've already run this."
  );
  
  if (runMigration) {
    migrateNeeds().catch(error => {
      console.error("❌ Migration failed:", error);
    });
  } else {
    console.log("⏭️ Migration skipped");
  }
});
