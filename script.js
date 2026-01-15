import { db, storage } from "./firebase-config.js";
import { config } from "./config.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// -----------------------------
// Make functions available to the browser
// -----------------------------
window.logout = logout;
window.addTask = addTask;
window.toggleDone = toggleDone;
window.toggleSection = toggleSection;
window.jumpTo = jumpTo;
window.saveCompletionDetails = saveCompletionDetails;
window.closeCompletionModal = closeCompletionModal;
window.openAddTaskModal = openAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;
window.openUpdateModal = openUpdateModal;
window.closeUpdateModal = closeUpdateModal;
window.saveUpdate = saveUpdate;
window.toggleNotificationsPanel = toggleNotificationsPanel;
window.changeTaskPriority = changeTaskPriority;
window.changeNeedPriority = changeNeedPriority;
window.navigateToTask = navigateToTask;
window.markNotificationRead = markNotificationRead;
window.handlePriorityChange = handlePriorityChange;
window.openMemoModal = openMemoModal;
window.closeMemoModal = closeMemoModal;
window.saveMemo = saveMemo;
window.openNeedsModal = openNeedsModal;
window.closeNeedsModal = closeNeedsModal;
window.saveNeeds = saveNeeds;
window.openAttachmentModal = openAttachmentModal;
window.closeAttachmentModal = closeAttachmentModal;
window.saveAttachment = saveAttachment;
window.removeAttachment = removeAttachment;
window.openNotificationDetail = openNotificationDetail;
window.closeNotificationDetail = closeNotificationDetail;
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;
window.sendMessage = sendMessage;
window.closeHighPriorityPopup = closeHighPriorityPopup;
window.clearAllNotifications = clearAllNotifications;
window.toggleMemoComplete = toggleMemoComplete;
window.toggleNeedComplete = toggleNeedComplete;
window.toggleCompletedBin = toggleCompletedBin;
window.openNeedCompletionModal = openNeedCompletionModal;
window.closeNeedCompletionModal = closeNeedCompletionModal;
window.saveNeedCompletion = saveNeedCompletion;
window.openFileUploadModal = openFileUploadModal;
window.closeFileUploadModal = closeFileUploadModal;
window.uploadPermanentFile = uploadPermanentFile;
window.deletePermanentFile = deletePermanentFile;
window.submitForReview = submitForReview;
window.verifyTaskComplete = verifyTaskComplete;
window.flagForReview = flagForReview;
window.openReviewFeedbackModal = openReviewFeedbackModal;
window.closeReviewFeedbackModal = closeReviewFeedbackModal;
window.submitReviewAction = submitReviewAction;
window.openFulfillNeedModal = openFulfillNeedModal;
window.closeFulfillNeedModal = closeFulfillNeedModal;
window.saveFulfillNeed = saveFulfillNeed;
window.toggleChatBot = toggleChatBot;
window.sendChatMessage = sendChatMessage;
window.handleChatKeydown = handleChatKeydown;
window.filterCompletedWork = filterCompletedWork;
window.switchResourceTab = switchResourceTab;

// -----------------------------
// Loading Indicator Functions
// -----------------------------
let loadingTimeout;
let activeOperations = 0;

function showLoading(message = 'Syncing data...') {
  activeOperations++;
  const indicator = document.getElementById('loadingIndicator');
  const text = indicator?.querySelector('.loading-text');
  if (indicator) {
    indicator.classList.add('visible');
    if (text) text.textContent = message;
  }
}

function hideLoading() {
  activeOperations = Math.max(0, activeOperations - 1);
  if (activeOperations === 0) {
    clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      const indicator = document.getElementById('loadingIndicator');
      if (indicator) {
        indicator.classList.remove('visible');
      }
    }, 300); // Small delay for smooth UX
  }
}

// -----------------------------
// Global state
// -----------------------------
let currentUser = null;
let tasks = [];
let notifications = [];
let messages = [];
let taskToCompleteId = null;
let taskToUpdateId = null;
let taskToEditMemoId = null;
let taskToEditNeedsId = null;
let taskToAddAttachmentId = null;
let needToCompleteTaskId = null;
let needToCompleteIndex = null;
let needToFulfillTaskId = null;
let needToFulfillIndex = null;
let chatHistory = [];
let knowledgeBase = [];
const tasksCollection = collection(db, "tasks");
const notificationsCollection = collection(db, "notifications");
const messagesCollection = collection(db, "messages");
const chatCollection = collection(db, "chatHistory");
const knowledgeCollection = collection(db, "knowledgeBase");

// -----------------------------
// Login/Logout Functions
// -----------------------------
function logout() {
  if (confirm(`Logout ${currentUser}?`)) {
    currentUser = null;
    localStorage.removeItem("taskledger_user");
    window.location.href = "login.html";
  }
}

function checkLogin() {
  const savedUser = localStorage.getItem("taskledger_user");
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById("currentUserName").textContent = savedUser;
    
    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }
    
    initializeApp();
  } else {
    // Redirect to login page if not logged in
    window.location.href = "login.html";
  }
}

// -----------------------------
// Navigation
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  
  const navLinks = document.querySelectorAll(".nav-link");
  const views = document.querySelectorAll(".view");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const viewName = link.getAttribute("data-view");

      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      views.forEach((view) => {
        if (view.id === `${viewName}-view`) {
          view.classList.add("active");
        } else {
          view.classList.remove("active");
        }
      });
      
      // Render completed work view when activated
      if (viewName === "completed-work") {
        renderCompletedWork();
      }
    }, { passive: false });
  });
  
  // Add passive listeners to text inputs to suppress warnings
  document.querySelectorAll('input, textarea').forEach(element => {
    element.addEventListener('wheel', (e) => {}, { passive: true });
    element.addEventListener('touchstart', (e) => {}, { passive: true });
  });
  
  // Add keyboard support for closing notification panel with Escape
  document.addEventListener('keydown', (e) => {
    const notificationsPanel = document.getElementById("notificationsPanel");
    if (e.key === 'Escape' && notificationsPanel && notificationsPanel.classList.contains('open')) {
      toggleNotificationsPanel();
    }
  });
});

// -----------------------------
// Add Task Modal Logic
// -----------------------------
function openAddTaskModal() {
  document.getElementById("addTaskModal").style.display = "flex";
}

function closeAddTaskModal() {
  document.getElementById("addTaskModal").style.display = "none";
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDescription").value = "";
  document.getElementById("taskNotes").value = "";
  document.getElementById("taskNeeds").value = "";
  document.getElementById("taskPriority").value = "medium";
  document.getElementById("taskDeadline").value = "none";
}

// Handle priority change to auto-set deadline
function handlePriorityChange() {
  const priority = document.getElementById("taskPriority").value;
  const deadlineSelect = document.getElementById("taskDeadline");
  
  if (priority === "high") {
    deadlineSelect.value = "2days"; // High: 2 days default
  } else if (priority === "medium") {
    deadlineSelect.value = "2weeks"; // Medium: 2 weeks default
  } else if (priority === "low") {
    deadlineSelect.value = "1month"; // Low: 1 month default
  }
}

// -----------------------------
async function addTask() {
  showLoading('Creating task...');
  
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const notes = document.getElementById("taskNotes").value.trim();
  const needsText = document.getElementById("taskNeeds").value.trim();
  const priority = document.getElementById("taskPriority").value;
  const deadlineOption = document.getElementById("taskDeadline").value;
  const fileInput = document.getElementById("taskFileInput");
  
  // Calculate deadline date
  let deadline = null;
  if (deadlineOption !== "none") {
    const now = new Date();
    switch(deadlineOption) {
      case "tomorrow":
        deadline = new Date(now.setDate(now.getDate() + 1));
        break;
      case "2days":
        deadline = new Date(now.setDate(now.getDate() + 2));
        break;
      case "1week":
        deadline = new Date(now.setDate(now.getDate() + 7));
        break;
      case "2weeks":
        deadline = new Date(now.setDate(now.getDate() + 14));
        break;
      case "3weeks":
        deadline = new Date(now.setDate(now.getDate() + 21));
        break;
      case "1month":
        deadline = new Date(now.setMonth(now.getMonth() + 1));
        break;
      case "2months":
        deadline = new Date(now.setMonth(now.getMonth() + 2));
        break;
    }
  }
  
  // Parse needs with priority tags from initial input
  const needs = needsText 
    ? needsText.split('\n').map(line => {
        line = line.trim();
        if (!line) return null;
        
        // Check for priority tag at the end
        const highMatch = line.match(/(.+?)\s*\[(high|HIGH)\]\s*$/);
        const mediumMatch = line.match(/(.+?)\s*\[(medium|MEDIUM|med|MED)\]\s*$/);
        const lowMatch = line.match(/(.+?)\s*\[(low|LOW)\]\s*$/);
        
        let text = line;
        let needPriority = 'medium'; // default
        
        if (highMatch) {
          text = highMatch[1].trim();
          needPriority = 'high';
        } else if (mediumMatch) {
          text = mediumMatch[1].trim();
          needPriority = 'medium';
        } else if (lowMatch) {
          text = lowMatch[1].trim();
          needPriority = 'low';
        }
        
        return {
          text,
          priority: needPriority,
          createdAt: new Date()
        };
      }).filter(need => need !== null)
    : [];

  const newTask = await addDoc(tasksCollection, {
    title,
    description,
    notes,
    needs,
    priority,
    deadline,
    done: false,
    createdAt: new Date(),
    completionNotes: "",
    updates: [],
    owner: currentUser,
    createdBy: currentUser,
    attachments: [], // Initialize empty attachments array
  });

  // Upload file if selected
  if (fileInput && fileInput.files[0]) {
    try {
      await uploadTaskFile(newTask.id, fileInput.files[0]);
    } catch (error) {
      console.error('File upload failed:', error);
      // Continue even if file upload fails
    }
  }

  // Determine recipient (the other user)
  // TESTING MODE: Send to self to test notifications
  const recipient = currentUser; // For testing: currentUser === "Nate" ? "Craig" : "Nate";

  // Create notification for new task
  try {
    await addDoc(notificationsCollection, {
      type: "task",
      taskId: newTask.id,
      message: `${currentUser} added a new task: ${title}`,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    // Don't fail the whole operation if notification fails
  }

  closeAddTaskModal();
  hideLoading();
}

// -----------------------------
async function toggleDone(id) {
  showLoading('Updating task...');
  const task = tasks.find((t) => t.id === id);
  const taskDoc = doc(db, "tasks", id);

  if (task.status === 'completed') {
    // If already completed, allow unchecking to move back to active
    await updateDoc(taskDoc, { status: 'active', done: false });
    hideLoading();
  } else if (task.status === 'in-review') {
    // Can't uncheck if in review - needs to be flagged back by reviewer
    hideLoading();
    alert('This task is pending review. Only the reviewer can move it back.');
  } else {
    // If marking as complete, show the review submission modal
    hideLoading();
    openCompletionModal(id);
  }
}

// -----------------------------
// Review Submission Modal Logic
// -----------------------------
function openCompletionModal(id) {
  const task = tasks.find(t => t.id === id);
  taskToCompleteId = id;
  document.getElementById("completionTaskTitle").textContent = `Task: ${task.title}`;
  document.getElementById("completionModal").style.display = "flex";
  document.getElementById("completionNotes").value = "";
  document.getElementById("completionImageUrl").value = "";
  document.getElementById("completionLinks").value = "";
  document.getElementById("completionFileInput").value = "";
  document.getElementById("completionFilePreview").innerHTML = "";
}

function closeCompletionModal() {
  document.getElementById("completionModal").style.display = "none";
  document.getElementById("completionNotes").value = "";
  document.getElementById("completionImageUrl").value = "";
  document.getElementById("completionLinks").value = "";
  document.getElementById("completionFileInput").value = "";
  taskToCompleteId = null;
  // Re-render to uncheck the checkbox
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'in-review');
  renderTasks(activeTasks);
}

async function submitForReview() {
  if (!taskToCompleteId) return;

  showLoading('Submitting for review...');
  const task = tasks.find(t => t.id === taskToCompleteId);
  const notes = document.getElementById("completionNotes").value.trim();
  const imageUrl = document.getElementById("completionImageUrl").value.trim();
  const linksText = document.getElementById("completionLinks").value.trim();
  const fileInput = document.getElementById("completionFileInput");
  
  if (!notes) {
    alert('Please add a completion summary before submitting for review.');
    hideLoading();
    return;
  }
  
  // Parse links
  const completionLinks = linksText ? linksText.split('\n').map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 2 && parts[1]) {
      return { text: parts[0] || parts[1], url: parts[1] };
    }
    return null;
  }).filter(link => link !== null) : [];
  
  const taskDoc = doc(db, "tasks", taskToCompleteId);
  
  // Prepare review submission data
  const reviewSubmission = {
    submittedBy: currentUser,
    submittedAt: new Date(),
    notes: notes,
    imageUrl: imageUrl,
    links: completionLinks,
    files: []
  };
  
  // Upload files if selected
  if (fileInput && fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      try {
        const file = fileInput.files[i];
        const sanitizedName = sanitizeFilename(file.name);
        const path = `review-submissions/${taskToCompleteId}/${Date.now()}_${sanitizedName}`;
        const fileData = await uploadFileToStorage(file, path);
        reviewSubmission.files.push(fileData);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  }
  
  // Update task to in-review status
  // Set reviewer to the opposite user (if Nate submits, Craig reviews)
  const reviewer = currentUser === "Nate" ? "Craig" : "Nate";
  await updateDoc(taskDoc, {
    status: 'in-review',
    reviewSubmission: reviewSubmission,
    reviewer: reviewer,
    done: false // Keep done false so it doesn't show in completed
  });
  
  // Add update to task history
  const updates = task.updates || [];
  updates.push({
    type: 'submitted_for_review',
    text: `Submitted for review: ${notes}`,
    timestamp: new Date(),
    by: currentUser
  });
  await updateDoc(taskDoc, { updates });
  
  // Create notification for reviewer
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  await addDoc(notificationsCollection, {
    type: "review_requested",
    taskId: taskToCompleteId,
    message: `${currentUser} submitted "${task.title}" for review`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });

  closeCompletionModal();
  hideLoading();
  alert('Task submitted for review! 🎉');
}

// Old function kept for backward compatibility but now redirects
async function saveCompletionDetails() {
  await submitForReview();
}


// -----------------------------
// -----------------------------
// Update Modal Logic
// -----------------------------
function openUpdateModal(id) {
  const task = tasks.find(t => t.id === id);
  taskToUpdateId = id;
  document.getElementById("updateTaskTitle").textContent = `Update for: ${task.title}`;
  document.getElementById("updateModal").style.display = "flex";
}

function closeUpdateModal() {
  document.getElementById("updateModal").style.display = "none";
  document.getElementById("updateText").value = "";
  taskToUpdateId = null;
}

async function saveUpdate() {
  if (!taskToUpdateId) return;

  showLoading('Posting update...');
  const task = tasks.find(t => t.id === taskToUpdateId);
  const taskDoc = doc(db, "tasks", taskToUpdateId);
  const updateText = document.getElementById("updateText").value.trim();

  const updates = task.updates || [];
  updates.push({
    text: updateText,
    timestamp: new Date(),
  });

  await updateDoc(taskDoc, { updates });
  
  // Create notification for update
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  await addDoc(notificationsCollection, {
    type: "update",
    taskId: taskToUpdateId,
    message: `${currentUser} posted update on "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
  
  closeUpdateModal();
  hideLoading();
}

// -----------------------------
// Memo Modal Logic
// -----------------------------
function openMemoModal(id) {
  const task = tasks.find(t => t.id === id);
  taskToEditMemoId = id;
  document.getElementById("memoTaskTitle").textContent = `Edit memo for: ${task.title}`;
  document.getElementById("memoText").value = task.description || "";
  
  // Load existing links
  const memoLinks = task.memoLinks || [];
  document.getElementById("memoLinks").value = memoLinks.map(link => `${link.text} | ${link.url}`).join('\n');
  
  document.getElementById("memoModal").style.display = "flex";
}

function closeMemoModal() {
  document.getElementById("memoModal").style.display = "none";
  document.getElementById("memoText").value = "";
  document.getElementById("memoLinks").value = "";
  taskToEditMemoId = null;
}

async function saveMemo() {
  if (!taskToEditMemoId) return;

  showLoading('Saving memo...');
  const task = tasks.find(t => t.id === taskToEditMemoId);
  const memoText = document.getElementById("memoText").value.trim();
  const linksText = document.getElementById("memoLinks").value.trim();
  const fileInput = document.getElementById("memoFileInput");
  
  // Parse links
  const memoLinks = linksText ? linksText.split('\n').map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 2 && parts[1]) {
      return { text: parts[0] || parts[1], url: parts[1] };
    }
    return null;
  }).filter(link => link !== null) : [];
  
  const taskDoc = doc(db, "tasks", taskToEditMemoId);

  await updateDoc(taskDoc, {
    description: memoText,
    memoLinks: memoLinks,
  });

  // Upload file if selected
  if (fileInput && fileInput.files[0]) {
    try {
      await uploadMemoFile(taskToEditMemoId, fileInput.files[0]);
    } catch (error) {
      console.error('Memo file upload failed:', error);
    }
  }

  // Send notification to the other user about memo update
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  
  await addDoc(notificationsCollection, {
    type: "memo_updated",
    taskId: taskToEditMemoId,
    message: `${currentUser} updated memo for "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });

  closeMemoModal();
  hideLoading();
}

// -----------------------------
// Attachment Modal Logic
// -----------------------------
function openAttachmentModal(id) {
  const task = tasks.find(t => t.id === id);
  taskToAddAttachmentId = id;
  document.getElementById("attachmentTaskTitle").textContent = `Add link for: ${task.title}`;
  document.getElementById("attachmentModal").style.display = "flex";
}

function closeAttachmentModal() {
  document.getElementById("attachmentModal").style.display = "none";
  document.getElementById("attachmentName").value = "";
  document.getElementById("attachmentUrl").value = "";
  taskToAddAttachmentId = null;
}

async function saveAttachment() {
  if (!taskToAddAttachmentId) return;

  showLoading('Adding link...');
  const task = tasks.find(t => t.id === taskToAddAttachmentId);
  const name = document.getElementById("attachmentName").value.trim();
  const url = document.getElementById("attachmentUrl").value.trim();

  if (!name || !url) {
    alert("Please provide both a name and URL");
    hideLoading();
    return;
  }

  const attachments = task.attachments || [];
  attachments.push({
    name,
    url,
    addedBy: currentUser,
    addedAt: new Date(),
  });

  const taskDoc = doc(db, "tasks", taskToAddAttachmentId);
  await updateDoc(taskDoc, { attachments });

  // Send notification to the other user
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  
  await addDoc(notificationsCollection, {
    type: "attachment_added",
    taskId: taskToAddAttachmentId,
    message: `${currentUser} added link "${name}" to "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });

  closeAttachmentModal();
}

async function removeAttachment(taskId, attachmentIndex) {
  const task = tasks.find(t => t.id === taskId);
  const attachments = [...(task.attachments || [])];
  
  if (!attachments[attachmentIndex]) return;
  
  const removed = attachments.splice(attachmentIndex, 1)[0];
  
  const taskDoc = doc(db, "tasks", taskId);
  await updateDoc(taskDoc, { attachments });
  
  // Send notification
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  
  await addDoc(notificationsCollection, {
    type: "attachment_removed",
    taskId: taskId,
    message: `${currentUser} removed link "${removed.name}" from "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
}

// -----------------------------
// Needs Modal Logic
// -----------------------------
function openNeedsModal(id) {
  const task = tasks.find(t => t.id === id);
  taskToEditNeedsId = id;
  document.getElementById("needsTaskTitle").textContent = `Edit needs for: ${task.title}`;
  
  // Convert needs array to text with priorities
  const needs = task.needs || [];
  const needsText = needs.map(need => {
    // Handle both old string format and new object format
    if (typeof need === 'string') {
      return need;
    } else {
      const priority = need.priority || 'medium';
      return `${need.text} [${priority}]`;
    }
  }).join('\n');
  
  document.getElementById("needsText").value = needsText;
  
  // Load existing links
  const needsLinks = task.needsLinks || [];
  document.getElementById("needsLinks").value = needsLinks.map(link => `${link.text} | ${link.url}`).join('\n');
  
  document.getElementById("needsModal").style.display = "flex";
}

function closeNeedsModal() {
  document.getElementById("needsModal").style.display = "none";
  document.getElementById("needsText").value = "";
  document.getElementById("needsLinks").value = "";
  taskToEditNeedsId = null;
}

async function saveNeeds() {
  if (!taskToEditNeedsId) return;

  showLoading('Saving needs...');
  const needsText = document.getElementById("needsText").value.trim();
  const linksText = document.getElementById("needsLinks").value.trim();
  
  // Parse links
  const needsLinks = linksText ? linksText.split('\n').map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 2 && parts[1]) {
      return { text: parts[0] || parts[1], url: parts[1] };
    }
    return null;
  }).filter(link => link !== null) : [];
  
  // Parse needs with priority tags [high], [medium], [low]
  const needs = needsText 
    ? needsText.split('\n').map(line => {
        line = line.trim();
        if (!line) return null;
        
        // Check for priority tag at the end
        const highMatch = line.match(/(.+?)\s*\[(high|HIGH)\]\s*$/);
        const mediumMatch = line.match(/(.+?)\s*\[(medium|MEDIUM|med|MED)\]\s*$/);
        const lowMatch = line.match(/(.+?)\s*\[(low|LOW)\]\s*$/);
        
        let text = line;
        let priority = 'medium'; // default
        
        if (highMatch) {
          text = highMatch[1].trim();
          priority = 'high';
        } else if (mediumMatch) {
          text = mediumMatch[1].trim();
          priority = 'medium';
        } else if (lowMatch) {
          text = lowMatch[1].trim();
          priority = 'low';
        }
        
        return {
          text,
          priority,
          createdAt: new Date()
        };
      }).filter(need => need !== null)
    : [];
  
  const taskDoc = doc(db, "tasks", taskToEditNeedsId);
  await updateDoc(taskDoc, {
    needs: needs,
    needsLinks: needsLinks,
  });

  // Send notification to the other user about needs update
  const task = tasks.find(t => t.id === taskToEditNeedsId);
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  
  await addDoc(notificationsCollection, {
    type: "needs_updated",
    taskId: taskToEditNeedsId,
    message: `${currentUser} updated needs for "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });

  closeNeedsModal();
  hideLoading();
}

// -----------------------------
// Priority Change Functions
// -----------------------------
async function changeTaskPriority(taskId) {
  showLoading('Updating priority...');
  const task = tasks.find(t => t.id === taskId);
  const currentPriority = task.priority || "medium";
  
  const priorityNames = { low: "🟢 Low", medium: "🟡 Medium", high: "🔴 High" };
  
  const newPriority = prompt(
    `Current TASK priority: ${priorityNames[currentPriority]}\n\nSelect new priority:\n1 - 🟢 Low\n2 - 🟡 Medium\n3 - 🔴 High\n\nEnter 1, 2, or 3:`,
    currentPriority === "low" ? "1" : currentPriority === "medium" ? "2" : "3"
  );
  
  let selectedPriority;
  if (newPriority === "1") selectedPriority = "low";
  else if (newPriority === "2") selectedPriority = "medium";
  else if (newPriority === "3") selectedPriority = "high";
  else {
    hideLoading();
    return;
  }
  
  if (selectedPriority === currentPriority) {
    hideLoading();
    return;
  }
  
  const taskDoc = doc(db, "tasks", taskId);
  await updateDoc(taskDoc, { priority: selectedPriority });
  
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  await addDoc(notificationsCollection, {
    type: "priority_change",
    taskId: taskId,
    message: `${currentUser} changed priority: "${task.title}" is now ${priorityNames[selectedPriority]}`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
  hideLoading();
}

async function changeNeedPriority(taskId, needIndex) {
  showLoading('Updating need priority...');
  const task = tasks.find(t => t.id === taskId);
  const needs = [...(task.needs || [])];
  
  if (!needs[needIndex]) {
    hideLoading();
    return;
  }
  
  // Normalize the need to an object if it's currently just a string
  if (typeof needs[needIndex] === 'string') {
    needs[needIndex] = { text: needs[needIndex], priority: 'medium' };
  }
  
  const currentPriority = needs[needIndex].priority || "medium";
  const priorityNames = { low: "🟢 Low", medium: "🟡 Medium", high: "🔴 High" };
  
  const newPriority = prompt(
    `Current NEED priority: ${priorityNames[currentPriority]}\n\nSelect new priority:\n1 - 🟢 Low\n2 - 🟡 Medium\n3 - 🔴 High\n\nEnter 1, 2, or 3:`,
    currentPriority === "low" ? "1" : currentPriority === "medium" ? "2" : "3"
  );
  
  let selectedPriority;
  if (newPriority === "1") selectedPriority = "low";
  else if (newPriority === "2") selectedPriority = "medium";
  else if (newPriority === "3") selectedPriority = "high";
  else {
    hideLoading();
    return;
  }
  
  if (selectedPriority === currentPriority) {
    hideLoading();
    return;
  }
  
  needs[needIndex].priority = selectedPriority;
  
  const taskDoc = doc(db, "tasks", taskId);
  await updateDoc(taskDoc, { needs });
  
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  await addDoc(notificationsCollection, {
    type: "need_priority_change",
    taskId: taskId,
    message: `${currentUser} changed need priority in "${task.title}" to ${priorityNames[selectedPriority]}`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
  hideLoading();
}

// -----------------------------
// Notifications Panel
// -----------------------------
function toggleNotificationsPanel() {
  const panel = document.getElementById("notificationsPanel");
  const trigger = document.querySelector(".notifications-trigger");
  const isOpen = panel.classList.toggle("open");
  
  // Update aria-expanded for accessibility
  if (trigger) {
    trigger.setAttribute("aria-expanded", isOpen);
  }
}

// Completed Bin Panel
function toggleCompletedBin() {
  const panel = document.getElementById("completedBinPanel");
  panel.classList.toggle("open");
  
  // Render completed items when opened
  if (panel.classList.contains("open")) {
    renderCompletedBin();
  }
}

async function markNotificationRead(notificationId) {
  if (notificationId) {
    try {
      const notificationDoc = doc(db, "notifications", notificationId);
      await updateDoc(notificationDoc, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }
}

async function clearAllNotifications() {
  if (!confirm("Clear all notifications? This will mark all as read.")) return;
  
  try {
    const q = query(
      notificationsCollection,
      where("recipient", "==", currentUser)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      alert("No notifications to clear.");
      return;
    }
    
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { read: true })
    );
    
    await Promise.all(updatePromises);
    
    // Show success feedback
    const confirmation = document.getElementById("sentConfirmation");
    confirmation.textContent = "All notifications cleared! ✓";
    confirmation.classList.add("show");
    setTimeout(() => {
      confirmation.classList.remove("show");
      confirmation.textContent = "Message sent! ✓";
    }, 2000);
  } catch (error) {
    console.error("Error clearing notifications:", error);
    alert("Failed to clear notifications. Please try again.");
  }
}

function openNotificationDetail(notificationId) {
  const notification = notifications.find(n => n.id === notificationId);
  if (!notification) return;
  
  const content = document.getElementById("notificationDetailContent");
  const task = tasks.find(t => t.id === notification.taskId);
  
  let detailHTML = `
    <div class="notification-detail">
      <p><strong>Type:</strong> ${formatNotificationType(notification.type)}</p>
      <p><strong>From:</strong> ${notification.sender || 'System'}</p>
      <p><strong>Time:</strong> ${new Date(notification.createdAt.seconds * 1000).toLocaleString()}</p>
  `;
  
  // Show full message for message-type notifications
  if (notification.type === "message" && notification.fullMessage) {
    detailHTML += `
      <div class="message-content">
        <p><strong>Message:</strong></p>
        <div class="message-text">${notification.fullMessage}</div>
      </div>
    `;
  } else {
    detailHTML += `<p><strong>Message:</strong> ${notification.message}</p>`;
  }
  
  if (task) {
    detailHTML += `
      <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border);">
      <p><strong>Related Task:</strong> ${task.title}</p>
      <p><strong>Priority:</strong> ${task.priority || 'medium'}</p>
      <button onclick="navigateToTask('${task.id}', '${notificationId}')" class="navigate-btn">Go to Task</button>
    `;
  }
  
  detailHTML += `</div>`;
  content.innerHTML = detailHTML;
  
  document.getElementById("notificationDetailModal").style.display = "flex";
  
  // Mark as read when viewing
  markNotificationRead(notificationId);
}

function closeNotificationDetail() {
  document.getElementById("notificationDetailModal").style.display = "none";
}

function formatNotificationType(type) {
  const types = {
    task: "New Task",
    update: "Task Update",
    completion: "Task Completed",
    priority_change: "Priority Changed",
    priority_auto_escalated: "Priority Auto-Escalated",
    need_priority_change: "Need Priority Changed",
    needs_updated: "Needs Updated",
    memo_updated: "Memo Updated",
    memo_completed: "Memo Completed",
    memo_uncompleted: "Memo Restored",
    need_completed: "Need Completed",
    need_uncompleted: "Need Restored",
    attachment_added: "Link Added",
    attachment_removed: "Link Removed",
    deadline_warning: "Deadline Warning",
    deadline_today: "Due Today",
    deadline_overdue: "Overdue",
    message: "Message"
  };
  return types[type] || type;
}

async function navigateToTask(taskId, notificationId) {
  // Mark notification as read
  await markNotificationRead(notificationId);
  
  // Close notification panel
  toggleNotificationsPanel();
  
  // Navigate to task
  jumpTo("task", taskId);
}

function toggleSection(id, section) {
  const el = document.getElementById(`${section}-${id}`);
  const isOpen = el.style.display === "block";
  el.style.display = isOpen ? "none" : "block";
}

// -----------------------------
// Messaging Functions
// -----------------------------
function openMessageModal() {
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  document.getElementById("messageRecipient").textContent = `To: ${recipient}`;
  document.getElementById("messageModal").style.display = "flex";
}

function closeMessageModal() {
  document.getElementById("messageModal").style.display = "none";
  document.getElementById("messageText").value = "";
  // Reset priority to normal
  document.getElementById("messagePriority").value = "normal";
}

// Check for high-priority unshown messages
async function checkHighPriorityMessages() {
  try {
    const shownMessages = JSON.parse(localStorage.getItem('shownHighPriorityMessages') || '[]');
    
    const q = query(
      notificationsCollection,
      where("recipient", "==", currentUser),
      where("priority", "==", "high"),
      where("type", "==", "message"),
      where("read", "==", false)
    );
    
    const snapshot = await getDocs(q);
    
    // Find first unshown high-priority message
    for (const doc of snapshot.docs) {
      if (!shownMessages.includes(doc.id)) {
        const notification = doc.data();
        showHighPriorityPopup(doc.id, notification);
        break; // Only show one at a time
      }
    }
  } catch (error) {
    console.error("Error checking high-priority messages:", error);
  }
}

function showHighPriorityPopup(notificationId, notification) {
  document.getElementById("highPriorityFrom").textContent = `From: ${notification.sender} • ${new Date(notification.createdAt.toDate()).toLocaleString()}`;
  document.getElementById("highPriorityText").textContent = notification.fullMessage || notification.message;
  document.getElementById("highPriorityPopup").style.display = "flex";
  
  // Mark as shown in localStorage
  const shownMessages = JSON.parse(localStorage.getItem('shownHighPriorityMessages') || '[]');
  shownMessages.push(notificationId);
  localStorage.setItem('shownHighPriorityMessages', JSON.stringify(shownMessages));
}

function closeHighPriorityPopup() {
  document.getElementById("highPriorityPopup").style.display = "none";
}

async function sendMessage() {
  const messageText = document.getElementById("messageText").value.trim();
  const priority = document.getElementById("messagePriority").value;
  
  if (!messageText) {
    alert("Please enter a message");
    return;
  }
  
  showLoading('Sending message...');
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  
  try {
    // Save message to Firestore
    const messageDoc = await addDoc(messagesCollection, {
      sender: currentUser,
      recipient: recipient,
      message: messageText,
      priority: priority,
      createdAt: new Date(),
      read: false,
    });
    
    // Create notification for recipient with messageId reference
    await addDoc(notificationsCollection, {
      type: "message",
      messageId: messageDoc.id,
      message: `New message from ${currentUser}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
      fullMessage: messageText,
      priority: priority,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    hideLoading();
    alert("Failed to send message. Please try again.");
    return;
  }
  
  hideLoading();
  closeMessageModal();
  
  // Show "sent" confirmation
  const confirmation = document.getElementById("sentConfirmation");
  confirmation.classList.add("show");
  setTimeout(() => {
    confirmation.classList.remove("show");
  }, 2000);
}

// -----------------------------
// Rendering Functions
// -----------------------------
function renderTasks(tasksToRender) {
  const container = document.getElementById("taskList");
  container.innerHTML = "";
  
  // Sort tasks by priority and deadline urgency
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedTasks = [...tasksToRender].sort((a, b) => {
    const priorityA = priorityOrder[a.priority || "medium"];
    const priorityB = priorityOrder[b.priority || "medium"];
    
    // First sort by priority
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // Then by deadline (soonest first)
    if (a.deadline && b.deadline) {
      return new Date(a.deadline.seconds * 1000) - new Date(b.deadline.seconds * 1000);
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    
    return 0;
  });
  
  sortedTasks.forEach((task) => {
    const div = document.createElement("div");
    div.className = `task ${task.done ? "done" : ""}`;
    div.id = `task-${task.id}`;

    const priority = task.priority || "medium";
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    const priorityLabel = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
    
    // Check if task needs review (flagged by reviewer)
    const needsReviewBadge = task.status === 'needs-review' ? 
      '<span class="flagged-badge">🚩 Changes Requested</span>' : '';
    
    // Check if task is pending review (submitted by current user)
    const pendingReviewBadge = task.status === 'in-review' && task.reviewSubmission?.submittedBy === currentUser ?
      '<span class="pending-review-badge">⏳ Pending Review</span>' : '';
    
    // Format deadline
    let deadlineHTML = "";
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline.seconds * 1000);
      const now = new Date();
      const daysUntil = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      
      let deadlineClass = "deadline-normal";
      let deadlineText = deadlineDate.toLocaleDateString();
      
      if (daysUntil < 0) {
        deadlineClass = "deadline-overdue";
        deadlineText += ` (Overdue)`;
      } else if (daysUntil === 0) {
        deadlineClass = "deadline-today";
        deadlineText = "Due Today";
      } else if (daysUntil === 1) {
        deadlineClass = "deadline-tomorrow";
        deadlineText = "Due Tomorrow";
      } else if (daysUntil <= 3) {
        deadlineClass = "deadline-soon";
        deadlineText = `Due in ${daysUntil} days`;
      } else if (daysUntil <= 7) {
        deadlineText = `Due in ${daysUntil} days`;
      }
      
      deadlineHTML = `<span class="deadline-badge ${deadlineClass}">⏰ ${deadlineText}</span>`;
    }

    const updates = task.updates || [];
    const updateHistoryHTML = updates.length > 0 ? `
      <div class="toggle" onclick="toggleSection('${task.id}', 'update-history')">📣 Update History (${updates.length})</div>
      <div class="update-history" id="update-history-${task.id}" style="display: none;">
        ${updates.slice().reverse().map(u => `
          <div class="update-history-item">
            <div class="update-timestamp">${new Date(u.timestamp.seconds * 1000).toLocaleString()}</div>
            ${u.text}
          </div>
        `).join("")}
      </div>
    ` : "";

    // Render attachments
    const attachments = task.attachments || [];
    const attachmentsHTML = attachments.length > 0 ? `
      <div class="attachments-section">
        <div class="toggle" onclick="toggleSection('${task.id}', 'attachments')">🔗 Links (${attachments.length})</div>
        <div class="attachments-list" id="attachments-${task.id}" style="display: none;">
          ${attachments.map((att, index) => `
            <div class="attachment-item">
              <a href="${att.url}" target="_blank" rel="noopener noreferrer">${att.name}</a>
              <button class="remove-attachment-btn" onclick="removeAttachment('${task.id}', ${index})">✕</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    // Render attached file (temporary)
    const fileHTML = task.attachedFile ? `
      <div class="task-file-attachment">
        <div class="file-icon">${getFileIcon(task.attachedFile.type)}</div>
        <div class="file-info-compact">
          <div class="file-name-small">${task.attachedFile.name}</div>
          <div class="file-size-small">${(task.attachedFile.size / 1024).toFixed(2)} KB</div>
        </div>
        <a href="${task.attachedFile.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
      </div>
    ` : "";

    // Show flagged feedback if task was flagged for changes
    const flaggedHTML = task.status === 'needs-review' && task.reviewFeedback ? `
      <div class="flagged-notice">
        <strong>🚩 Reviewer Feedback</strong>
        <p><strong>${task.reviewedBy || 'Reviewer'}:</strong> ${task.reviewFeedback}</p>
      </div>
    ` : "";

    // Disable checkbox if task is pending review (can't toggle while awaiting review)
    const checkboxDisabled = task.status === 'in-review' && task.reviewSubmission?.submittedBy === currentUser;
    const checkboxHTML = checkboxDisabled 
      ? `<input type="checkbox" checked disabled title="Task is pending review">`
      : `<input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone('${task.id}')">`;

    div.innerHTML = `
      <div class="task-header">
        <div>
          <strong>${task.title}</strong>
          <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
          ${deadlineHTML}
          ${needsReviewBadge}
          ${pendingReviewBadge}
        </div>
        ${checkboxHTML}
      </div>
      ${flaggedHTML}
      ${updateHistoryHTML}
      ${attachmentsHTML}
      ${fileHTML}
      <div class="task-actions">
        <button onclick="openUpdateModal('${task.id}')">+ Add Update</button>
        <button onclick="openMemoModal('${task.id}')">📝 ${task.description ? 'Edit' : 'Add'} Memo</button>
        <button onclick="openNeedsModal('${task.id}')">📌 Edit Needs</button>
        <button onclick="openAttachmentModal('${task.id}')">🔗 Add Link</button>
        <button class="priority-change-btn" onclick="changeTaskPriority('${task.id}')">🚩 Change Task Priority</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderUpdates(tasksToRender) {
  const container = document.getElementById("updatesList");
  container.innerHTML = "";

  // Collect all updates with task context
  const allUpdates = [];
  tasksToRender.forEach(task => {
    const updates = task.updates || [];
    updates.forEach(update => {
      allUpdates.push({
        ...update,
        taskId: task.id,
        taskTitle: task.title,
      });
    });
  });

  // Sort by timestamp, newest first
  allUpdates.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

  if (allUpdates.length === 0) {
    container.innerHTML = "<p style='color: var(--muted);'>No updates yet. Post an update from a task to get started.</p>";
    return;
  }

  allUpdates.forEach(update => {
    const div = document.createElement("div");
    div.className = "update-item";
    div.innerHTML = `
      <div class="update-meta">
        <span class="update-task-ref" onclick="jumpTo('task', '${update.taskId}')">${update.taskTitle}</span>
        <span>${new Date(update.timestamp.seconds * 1000).toLocaleString()}</span>
      </div>
      <div class="update-body">${update.text}</div>
    `;
    container.appendChild(div);
  });
}

// Toggle memo complete status
async function toggleMemoComplete(taskId) {
  showLoading('Updating memo...');
  const task = tasks.find(t => t.id === taskId);
  const taskDoc = doc(db, "tasks", taskId);
  
  const newStatus = !task.memoCompleted;
  
  // If completing, delete the memo file
  if (newStatus) {
    try {
      await deleteMemoFile(task);
    } catch (error) {
      console.error('Error deleting memo file:', error);
    }
  }
  
  await updateDoc(taskDoc, { memoCompleted: newStatus });
  
  // Send notification
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  try {
    await addDoc(notificationsCollection, {
      type: newStatus ? "memo_completed" : "memo_uncompleted",
      taskId: taskId,
      message: `${currentUser} ${newStatus ? 'completed' : 'uncompleted'} memo for "${task.title}"`,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
  
  hideLoading();
}

// Toggle need complete status
async function toggleNeedComplete(taskId, needIndex) {
  const task = tasks.find(t => t.id === taskId);
  const needs = [...(task.needs || [])];
  
  if (!needs[needIndex]) return;
  
  // Ensure need is an object
  if (typeof needs[needIndex] === 'string') {
    needs[needIndex] = { text: needs[needIndex], priority: 'medium', completed: false };
  }
  
  const isCurrentlyCompleted = needs[needIndex].completed || false;
  
  if (isCurrentlyCompleted) {
    // Uncompleting - just toggle it back
    showLoading('Updating need...');
    needs[needIndex].completed = false;
    needs[needIndex].completionNote = null;
    needs[needIndex].completionLink = null;
    const taskDoc = doc(db, "tasks", taskId);
    await updateDoc(taskDoc, { needs });
    
    // Send notification
    const recipient = currentUser === "Nate" ? "Craig" : "Nate";
    try {
      await addDoc(notificationsCollection, {
        type: "need_uncompleted",
        taskId: taskId,
        message: `${currentUser} uncompleted need in "${task.title}"`,
        createdAt: new Date(),
        read: false,
        recipient: recipient,
        sender: currentUser,
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
    hideLoading();
  } else {
    // Completing - show modal for notes
    openNeedCompletionModal(taskId, needIndex);
  }
}

// Open need completion modal
function openNeedCompletionModal(taskId, needIndex) {
  const task = tasks.find(t => t.id === taskId);
  const needs = task.needs || [];
  const need = needs[needIndex];
  const needText = typeof need === 'string' ? need : need.text;
  
  needToCompleteTaskId = taskId;
  needToCompleteIndex = needIndex;
  
  document.getElementById("needCompletionTaskTitle").textContent = `Completing need from: ${task.title}`;
  document.getElementById("needCompletionText").textContent = needText;
  document.getElementById("needCompletionNote").value = "";
  document.getElementById("needCompletionLink").value = "";
  document.getElementById("needCompletionModal").style.display = "flex";
}

// Close need completion modal
function closeNeedCompletionModal() {
  document.getElementById("needCompletionModal").style.display = "none";
  document.getElementById("needCompletionNote").value = "";
  document.getElementById("needCompletionLink").value = "";
  needToCompleteTaskId = null;
  needToCompleteIndex = null;
  
  // Uncheck the checkbox since user cancelled
  renderNeeds(tasks.filter(t => !t.done));
}

// Save need completion
async function saveNeedCompletion() {
  if (!needToCompleteTaskId || needToCompleteIndex === null) return;
  
  showLoading('Completing need...');
  const task = tasks.find(t => t.id === needToCompleteTaskId);
  const note = document.getElementById("needCompletionNote").value.trim();
  const link = document.getElementById("needCompletionLink").value.trim();
  
  const needs = [...(task.needs || [])];
  if (typeof needs[needToCompleteIndex] === 'string') {
    needs[needToCompleteIndex] = { text: needs[needToCompleteIndex], priority: 'medium' };
  }
  
  // Delete need file if it exists
  try {
    await deleteNeedFile(needs[needToCompleteIndex]);
  } catch (error) {
    console.error('Error deleting need file:', error);
  }
  
  needs[needToCompleteIndex].completed = true;
  needs[needToCompleteIndex].completionNote = note;
  needs[needToCompleteIndex].completionLink = link;
  needs[needToCompleteIndex].completedAt = new Date();
  needs[needToCompleteIndex].completedBy = currentUser;
  
  const taskDoc = doc(db, "tasks", needToCompleteTaskId);
  await updateDoc(taskDoc, { needs });
  
  // Send notification
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  let notificationMessage = `${currentUser} completed need in "${task.title}": ${needs[needToCompleteIndex].text}`;
  if (note) {
    notificationMessage += ` - Note: ${note.substring(0, 50)}${note.length > 50 ? '...' : ''}`;
  }
  
  try {
    await addDoc(notificationsCollection, {
      type: "need_completed",
      taskId: needToCompleteTaskId,
      message: notificationMessage,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
  
  closeNeedCompletionModal();
  hideLoading();
}

// Open fulfill need modal
function openFulfillNeedModal(taskId, needIndex) {
  const task = tasks.find(t => t.id === taskId);
  const needs = task.needs || [];
  const need = needs[needIndex];
  const needText = typeof need === 'string' ? need : need.text;
  
  needToFulfillTaskId = taskId;
  needToFulfillIndex = needIndex;
  
  document.getElementById("fulfillNeedTaskTitle").textContent = `Fulfilling need from: ${task.title}`;
  document.getElementById("fulfillNeedText").textContent = needText;
  document.getElementById("fulfillNeedNote").value = "";
  document.getElementById("fulfillContactDetails").value = "";
  document.getElementById("fulfillNeedLinks").value = "";
  document.getElementById("fulfillNeedFileInput").value = "";
  document.getElementById("fulfillNeedFilePreview").innerHTML = "";
  document.getElementById("fulfillNeedModal").style.display = "flex";
}

// Close fulfill need modal
function closeFulfillNeedModal() {
  document.getElementById("fulfillNeedModal").style.display = "none";
  document.getElementById("fulfillNeedNote").value = "";
  document.getElementById("fulfillContactDetails").value = "";
  document.getElementById("fulfillNeedLinks").value = "";
  document.getElementById("fulfillNeedFileInput").value = "";
  document.getElementById("fulfillNeedFilePreview").innerHTML = "";
  needToFulfillTaskId = null;
  needToFulfillIndex = null;
}

// Save need fulfillment
async function saveFulfillNeed() {
  if (!needToFulfillTaskId || needToFulfillIndex === null) return;
  
  showLoading('Fulfilling need...');
  const task = tasks.find(t => t.id === needToFulfillTaskId);
  const note = document.getElementById("fulfillNeedNote").value.trim();
  const contactDetails = document.getElementById("fulfillContactDetails").value.trim();
  const linksText = document.getElementById("fulfillNeedLinks").value.trim();
  const fileInput = document.getElementById("fulfillNeedFileInput");
  
  // Parse links
  const fulfillmentLinks = linksText ? linksText.split('\n').map(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 2 && parts[1]) {
      return { text: parts[0] || parts[1], url: parts[1] };
    }
    return null;
  }).filter(link => link !== null) : [];
  
  const needs = [...(task.needs || [])];
  if (typeof needs[needToFulfillIndex] === 'string') {
    needs[needToFulfillIndex] = { text: needs[needToFulfillIndex], priority: 'medium' };
  }
  
  // Upload files if selected
  const fulfillmentFiles = [];
  if (fileInput && fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      try {
        const file = fileInput.files[i];
        const sanitizedName = sanitizeFilename(file.name);
        const path = `need-fulfillment/${needToFulfillTaskId}/${Date.now()}_${sanitizedName}`;
        const fileData = await uploadFileToStorage(file, path);
        fulfillmentFiles.push(fileData);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  }
  
  needs[needToFulfillIndex].fulfilled = true;
  needs[needToFulfillIndex].fulfillmentNote = note;
  needs[needToFulfillIndex].fulfillmentContactDetails = contactDetails;
  needs[needToFulfillIndex].fulfillmentLinks = fulfillmentLinks;
  needs[needToFulfillIndex].fulfillmentFiles = fulfillmentFiles;
  needs[needToFulfillIndex].fulfilledAt = new Date();
  needs[needToFulfillIndex].fulfilledBy = currentUser;
  
  const taskDoc = doc(db, "tasks", needToFulfillTaskId);
  await updateDoc(taskDoc, { needs });
  
  // Send notification
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  let notificationMessage = `${currentUser} fulfilled need in "${task.title}": ${needs[needToFulfillIndex].text}`;
  if (note) {
    notificationMessage += ` - ${note.substring(0, 50)}${note.length > 50 ? '...' : ''}`;
  }
  
  try {
    await addDoc(notificationsCollection, {
      type: "need_fulfilled",
      taskId: needToFulfillTaskId,
      message: notificationMessage,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
  
  closeFulfillNeedModal();
  hideLoading();
}

function renderMemos(tasksToRender) {
  const container = document.getElementById("memoList");
  container.innerHTML = "";
  
  // Filter out completed memos
  tasksToRender
    .filter(task => task.description && !task.memoCompleted)
    .forEach((task) => {
      const div = document.createElement("div");
      div.className = "memo";
      div.id = `memo-${task.id}`;
      const isCompleted = task.memoCompleted || false;
      
      // Build media HTML
      let mediaHtml = '';
      if ((task.memoLinks && task.memoLinks.length > 0) || task.memoFile) {
        mediaHtml = '<div class="memo-media">';
        
        // Add file if exists
        if (task.memoFile) {
          mediaHtml += `
            <div class="task-file-attachment">
              <div class="file-icon">${getFileIcon(task.memoFile.type)}</div>
              <div class="file-info-compact">
                <div class="file-name-small">${task.memoFile.name}</div>
                <div class="file-size-small">${(task.memoFile.size / 1024).toFixed(2)} KB</div>
              </div>
              <a href="${task.memoFile.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
            </div>
          `;
        }
        
        // Add links if exist
        if (task.memoLinks && task.memoLinks.length > 0) {
          mediaHtml += '<div class="memo-links">';
          task.memoLinks.forEach(link => {
            mediaHtml += `<a href="${link.url}" target="_blank" rel="noopener noreferrer">🔗 ${link.text}</a>`;
          });
          mediaHtml += '</div>';
        }
        
        mediaHtml += '</div>';
      }
      
      div.innerHTML = `
        <div class="memo-header">
          <div class="memo-header-left">
            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoComplete('${task.id}')" class="memo-checkbox">
            <strong class="${isCompleted ? 'crossed-off' : ''}">${task.title}</strong>
          </div>
          <div class="jump-link" onclick="jumpTo('task', '${task.id}')">✅ View Task</div>
        </div>
        <div class="memo-body ${isCompleted ? 'crossed-off' : ''}" style="display: block;">${task.description}</div>
        ${mediaHtml}
      `;
      container.appendChild(div);
    });
}

function renderNeeds(tasksToRender) {
  const container = document.getElementById("needsList");
  container.innerHTML = "";
  
  // Collect all needs with task context and sort by priority
  const allNeeds = [];
  tasksToRender
    .filter(task => !task.done)
    .forEach((task) => {
      const needs = Array.isArray(task.needs) ? task.needs : [];
      needs.forEach((need, index) => {
        // Handle old format (string) and new format (object)
        const needObj = typeof need === 'string' ? { text: need, priority: 'medium' } : need;
        // Only show non-completed and non-fulfilled needs
        if (!needObj.completed && !needObj.fulfilled) {
          allNeeds.push({
            ...needObj,
            taskId: task.id,
            taskTitle: task.title,
            needIndex: index,
            needsLinks: task.needsLinks || [] // Add task-level links to each need
          });
        }
      });
    });
  
  if (allNeeds.length === 0) {
    container.innerHTML = "<p style='color: var(--muted);'>No needs yet.</p>";
    return;
  }
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allNeeds.sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
  
  allNeeds.forEach((need) => {
    const div = document.createElement("div");
    const isCompleted = need.completed || false;
    div.className = `needs-card ${isCompleted ? 'completed' : ''}`;
    const priority = need.priority || 'medium';
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    const priorityLabel = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
    
    // Build media HTML for needs
    let needMediaHtml = '';
    if (need.needsLinks && need.needsLinks.length > 0) {
      needMediaHtml = '<div class="need-media">';
      
      // Add links if exist
      needMediaHtml += '<div class="need-links">';
      need.needsLinks.forEach(link => {
        needMediaHtml += `<a href="${link.url}" target="_blank" rel="noopener noreferrer">🔗 ${link.text}</a>`;
      });
      needMediaHtml += '</div>';
      
      needMediaHtml += '</div>';
    }
    
    div.innerHTML = `
      <div class="need-header">
        <div class="task-link" onclick="jumpTo('task', '${need.taskId}')">From task: ${need.taskTitle}</div>
        <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
      </div>
      <div class="need-content">
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleNeedComplete('${need.taskId}', ${need.needIndex})" class="need-checkbox">
        <div class="need-text ${isCompleted ? 'crossed-off' : ''}">${need.text}</div>
      </div>
      ${needMediaHtml}
      <div class="need-actions">
        <button class="fulfill-need-btn" onclick="openFulfillNeedModal('${need.taskId}', ${need.needIndex})">✅ Fulfill Need</button>
        <button class="priority-change-btn" onclick="changeNeedPriority('${need.taskId}', ${need.needIndex})">🚩 Change Priority</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderCompleted(tasksToRender) {
  const container = document.getElementById("completedList");
  container.innerHTML = "";
  tasksToRender.forEach((task) => {
    const div = document.createElement("div");
    div.className = "completed-task";
    div.innerHTML = `
      <strong>${task.title}</strong>
      ${task.completionNotes ? `<div class="completion-notes">${task.completionNotes}</div>` : ""}
    `;
    container.appendChild(div);
  });
}

// Render completed bin
function renderCompletedBin() {
  // Render completed memos
  const memosContainer = document.getElementById("completedMemosList");
  const completedMemos = tasks.filter(t => t.memoCompleted && t.description);
  
  if (completedMemos.length === 0) {
    memosContainer.innerHTML = "<p class='no-items'>No completed memos</p>";
  } else {
    memosContainer.innerHTML = completedMemos.map(task => {
      let mediaHtml = '';
      
      // Add links if exist
      if (task.memoLinks && task.memoLinks.length > 0) {
        mediaHtml += '<div class="bin-media-links" style="margin-top: 8px;">';
        task.memoLinks.forEach(link => {
          mediaHtml += `<div><a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-size: 0.85rem;">🔗 ${link.text}</a></div>`;
        });
        mediaHtml += '</div>';
      }
      
      return `
        <div class="bin-item">
          <div class="bin-item-header">
            <strong>${task.title}</strong>
            <button class="restore-btn" onclick="toggleMemoComplete('${task.id}')" title="Restore">↺</button>
          </div>
          <div class="bin-item-body">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</div>
          ${mediaHtml}
        </div>
      `;
    }).join("");
  }
  
  // Render completed needs
  const needsContainer = document.getElementById("completedNeedsList");
  const completedNeeds = [];
  const fulfilledNeeds = [];
  
  tasks.forEach(task => {
    const needs = task.needs || [];
    needs.forEach((need, index) => {
      const needObj = typeof need === 'string' ? { text: need } : need;
      if (needObj.completed) {
        completedNeeds.push({
          ...needObj,
          taskId: task.id,
          taskTitle: task.title,
          needIndex: index
        });
      }
      if (needObj.fulfilled) {
        fulfilledNeeds.push({
          ...needObj,
          taskId: task.id,
          taskTitle: task.title,
          needIndex: index
        });
      }
    });
  });
  
  if (completedNeeds.length === 0) {
    needsContainer.innerHTML = "<p class='no-items'>No completed needs</p>";
  } else {
    needsContainer.innerHTML = completedNeeds.map(need => {
      let detailsHTML = '';
      if (need.completionNote) {
        detailsHTML += `<div class="completion-detail"><strong>Note:</strong> ${need.completionNote}</div>`;
      }
      if (need.completionLink) {
        detailsHTML += `<div class="completion-detail"><strong>Link:</strong> <a href="${need.completionLink}" target="_blank" rel="noopener">${need.completionLink}</a></div>`;
      }
      
      // Add media from the need itself
      if (need.needsLinks && need.needsLinks.length > 0) {
        detailsHTML += '<div class="bin-media-links" style="margin-top: 8px;">';
        need.needsLinks.forEach(link => {
          detailsHTML += `<div><a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-size: 0.85rem;">🔗 ${link.text}</a></div>`;
        });
        detailsHTML += '</div>';
      }
      
      if (need.completedAt) {
        const completedDate = need.completedAt.seconds ? new Date(need.completedAt.seconds * 1000) : new Date(need.completedAt);
        detailsHTML += `<div class="completion-detail" style="font-size: 0.75rem; color: var(--muted);">Completed ${completedDate.toLocaleDateString()} by ${need.completedBy}</div>`;
      }
      
      return `
        <div class="bin-item">
          <div class="bin-item-header">
            <span>${need.text}</span>
            <button class="restore-btn" onclick="toggleNeedComplete('${need.taskId}', ${need.needIndex})" title="Restore">↺</button>
          </div>
          <div class="bin-item-task">From: ${need.taskTitle}</div>
          ${detailsHTML}
        </div>
      `;
    }).join("");
  }
  
  // Render fulfilled needs
  const fulfilledContainer = document.getElementById("fulfilledNeedsList");
  
  if (fulfilledNeeds.length === 0) {
    fulfilledContainer.innerHTML = "<p class='no-items'>No fulfilled needs</p>";
  } else {
    fulfilledContainer.innerHTML = fulfilledNeeds.map(need => {
      let detailsHTML = '';
      if (need.fulfillmentNote) {
        detailsHTML += `<div class="completion-detail"><strong>Note:</strong> ${need.fulfillmentNote}</div>`;
      }
      if (need.fulfillmentContactDetails) {
        detailsHTML += `<div class="completion-detail"><strong>Contact Details:</strong> ${need.fulfillmentContactDetails}</div>`;
      }
      
      // Handle new fulfillmentLinks array
      if (need.fulfillmentLinks && need.fulfillmentLinks.length > 0) {
        detailsHTML += '<div class="completion-detail"><strong>Links:</strong></div>';
        detailsHTML += '<div class="bin-media-links" style="margin-left: 16px;">';
        need.fulfillmentLinks.forEach(link => {
          detailsHTML += `<div><a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-size: 0.85rem;">🔗 ${link.text}</a></div>`;
        });
        detailsHTML += '</div>';
      } else if (need.fulfillmentLink) {
        // Backward compatibility for old single link field
        detailsHTML += `<div class="completion-detail"><strong>Link:</strong> <a href="${need.fulfillmentLink}" target="_blank" rel="noopener">${need.fulfillmentLink}</a></div>`;
      }
      
      // Handle fulfillmentFiles array
      if (need.fulfillmentFiles && need.fulfillmentFiles.length > 0) {
        detailsHTML += '<div class="completion-detail"><strong>Files:</strong></div>';
        need.fulfillmentFiles.forEach(file => {
          detailsHTML += `
            <div class="task-file-attachment" style="margin-left: 16px;">
              <div class="file-icon">${getFileIcon(file.type)}</div>
              <div class="file-info-compact">
                <div class="file-name-small">${file.name}</div>
                <div class="file-size-small">${(file.size / 1024).toFixed(2)} KB</div>
              </div>
              <a href="${file.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
            </div>
          `;
        });
      }
      
      // Add media from the need itself
      if (need.needsLinks && need.needsLinks.length > 0) {
        detailsHTML += '<div class="bin-media-links" style="margin-top: 8px;">';
        need.needsLinks.forEach(link => {
          detailsHTML += `<div><a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-size: 0.85rem;">🔗 ${link.text}</a></div>`;
        });
        detailsHTML += '</div>';
      }
      
      if (need.fulfilledAt) {
        const fulfilledDate = need.fulfilledAt.seconds ? new Date(need.fulfilledAt.seconds * 1000) : new Date(need.fulfilledAt);
        detailsHTML += `<div class="completion-detail" style="font-size: 0.75rem; color: var(--muted);">Fulfilled ${fulfilledDate.toLocaleDateString()} by ${need.fulfilledBy}</div>`;
      }
      
      return `
        <div class="bin-item">
          <div class="bin-item-header">
            <span>${need.text}</span>
          </div>
          <div class="bin-item-task">From: ${need.taskTitle}</div>
          ${detailsHTML}
        </div>
      `;
    }).join("");
  }
  
  // Update badge count
  const totalCompleted = completedMemos.length + completedNeeds.length + fulfilledNeeds.length;
  const badge = document.getElementById("completedBinBadge");
  if (totalCompleted > 0) {
    badge.textContent = totalCompleted;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

// Global filter state for completed work view
let currentCompletedWorkFilter = 'all';

// Filter completed work
function filterCompletedWork(filter) {
  currentCompletedWorkFilter = filter;
  
  // Update active button state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Re-render the view
  renderCompletedWork();
}

// Render completed work view
function renderCompletedWork() {
  const container = document.getElementById("completedWorkList");
  if (!container) return;
  
  // Collect all completed and fulfilled needs
  const completedNeeds = [];
  const fulfilledNeeds = [];
  
  tasks.forEach(task => {
    const needs = task.needs || [];
    needs.forEach((need, index) => {
      const needObj = typeof need === 'string' ? { text: need } : need;
      if (needObj.completed) {
        completedNeeds.push({
          ...needObj,
          taskId: task.id,
          taskTitle: task.title,
          needIndex: index,
          type: 'completed'
        });
      }
      if (needObj.fulfilled) {
        fulfilledNeeds.push({
          ...needObj,
          taskId: task.id,
          taskTitle: task.title,
          needIndex: index,
          type: 'fulfilled'
        });
      }
    });
  });
  
  // Combine and filter based on current filter
  let allItems = [];
  if (currentCompletedWorkFilter === 'all') {
    allItems = [...completedNeeds, ...fulfilledNeeds];
  } else if (currentCompletedWorkFilter === 'completed') {
    allItems = completedNeeds;
  } else if (currentCompletedWorkFilter === 'fulfilled') {
    allItems = fulfilledNeeds;
  }
  
  // Sort by completion date, most recent first
  allItems.sort((a, b) => {
    const dateA = a.completedAt || a.fulfilledAt;
    const dateB = b.completedAt || b.fulfilledAt;
    if (!dateA) return 1;
    if (!dateB) return -1;
    const timeA = dateA.seconds ? dateA.seconds : new Date(dateA).getTime() / 1000;
    const timeB = dateB.seconds ? dateB.seconds : new Date(dateB).getTime() / 1000;
    return timeB - timeA;
  });
  
  // Update badge count
  const badge = document.getElementById("completedWorkBadge");
  const totalCount = completedNeeds.length + fulfilledNeeds.length;
  if (totalCount > 0) {
    badge.textContent = totalCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
  
  // Render
  if (allItems.length === 0) {
    container.innerHTML = `
      <div class="completed-work-empty">
        <div class="completed-work-empty-icon">✨</div>
        <div class="completed-work-empty-text">No completed work yet</div>
        <div class="completed-work-empty-subtext">Completed needs will appear here</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = allItems.map(item => {
    const isFulfilled = item.type === 'fulfilled';
    const completionDate = item.completedAt || item.fulfilledAt;
    const completedBy = item.completedBy || item.fulfilledBy;
    const dateStr = completionDate 
      ? (completionDate.seconds 
        ? new Date(completionDate.seconds * 1000).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : new Date(completionDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }))
      : 'Unknown date';
    
    // Build details sections
    let detailsHTML = '';
    
    if (isFulfilled) {
      if (item.fulfillmentNote) {
        detailsHTML += `
          <div class="completed-work-detail fulfilled">
            <div class="completed-work-detail-label">Fulfillment Notes</div>
            <div class="completed-work-detail-content">${item.fulfillmentNote}</div>
          </div>
        `;
      }
      if (item.fulfillmentContactDetails) {
        detailsHTML += `
          <div class="completed-work-detail fulfilled">
            <div class="completed-work-detail-label">Contact Details</div>
            <div class="completed-work-detail-content">${item.fulfillmentContactDetails}</div>
          </div>
        `;
      }
      
      // Handle new fulfillmentLinks array
      if (item.fulfillmentLinks && item.fulfillmentLinks.length > 0) {
        detailsHTML += `
          <div class="completed-work-detail fulfilled">
            <div class="completed-work-detail-label">Related Links</div>
            <div class="completed-work-detail-content">
              ${item.fulfillmentLinks.map(link => 
                `<div><a href="${link.url}" target="_blank" rel="noopener">🔗 ${link.text}</a></div>`
              ).join('')}
            </div>
          </div>
        `;
      } else if (item.fulfillmentLink) {
        // Backward compatibility for old single link field
        detailsHTML += `
          <div class="completed-work-detail fulfilled">
            <div class="completed-work-detail-label">Related Link</div>
            <div class="completed-work-detail-content"><a href="${item.fulfillmentLink}" target="_blank" rel="noopener">${item.fulfillmentLink}</a></div>
          </div>
        `;
      }
      
      // Handle fulfillmentFiles array
      if (item.fulfillmentFiles && item.fulfillmentFiles.length > 0) {
        detailsHTML += `
          <div class="completed-work-detail fulfilled">
            <div class="completed-work-detail-label">Attached Files</div>
            <div class="completed-work-detail-content">
              ${item.fulfillmentFiles.map(file => `
                <div class="task-file-attachment">
                  <div class="file-icon">${getFileIcon(file.type)}</div>
                  <div class="file-info-compact">
                    <div class="file-name-small">${file.name}</div>
                    <div class="file-size-small">${(file.size / 1024).toFixed(2)} KB</div>
                  </div>
                  <a href="${file.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    } else {
      if (item.completionNote) {
        detailsHTML += `
          <div class="completed-work-detail">
            <div class="completed-work-detail-label">Completion Notes</div>
            <div class="completed-work-detail-content">${item.completionNote}</div>
          </div>
        `;
      }
      if (item.completionLink) {
        detailsHTML += `
          <div class="completed-work-detail">
            <div class="completed-work-detail-label">Related Link</div>
            <div class="completed-work-detail-content"><a href="${item.completionLink}" target="_blank" rel="noopener">${item.completionLink}</a></div>
          </div>
        `;
      }
    }
    
    // Add media links if available
    if (item.needsLinks && item.needsLinks.length > 0) {
      detailsHTML += `
        <div class="completed-work-media">
          <div class="completed-work-media-title">📎 Attachments</div>
          <div class="completed-work-media-links">
            ${item.needsLinks.map(link => `
              <a href="${link.url}" target="_blank" rel="noopener noreferrer">🔗 ${link.text}</a>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    return `
      <div class="completed-work-card ${isFulfilled ? 'fulfilled' : ''}">
        <div class="completed-work-header">
          <div class="completed-work-title">
            <h3>${item.text}</h3>
            <div class="completed-work-subtitle">From task: ${item.taskTitle}</div>
          </div>
          <div class="completed-work-type ${isFulfilled ? 'fulfilled' : ''}">
            ${isFulfilled ? '✅ Fulfilled' : '✓ Completed'}
          </div>
        </div>
        <div class="completed-work-body">
          ${detailsHTML}
        </div>
        <div class="completed-work-footer">
          <div class="completed-work-by">
            <span>By</span>
            <strong>${completedBy || 'Unknown'}</strong>
          </div>
          <div class="completed-work-date">${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function jumpTo(view, id) {
  // Switch to the correct view
  document.querySelector(`.nav-link[data-view="${view}s"]`).click();
  
  // Scroll to the element after a short delay to allow for view transition
  setTimeout(() => {
    const element = document.getElementById(`${view}-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash animation
      element.style.transition = "background-color 0.1s ease-in-out";
      element.style.backgroundColor = "rgba(37, 99, 235, 0.1)";
      setTimeout(() => {
        element.style.backgroundColor = "var(--card)";
      }, 1000);
    }
  }, 300);
}

// -----------------------------
// Render Notifications
// -----------------------------
function renderNotifications(docs) {
  const list = document.getElementById("notificationsList");
  
  // Store notifications globally for access in detail modal
  notifications = docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (!docs || docs.length === 0) {
    list.innerHTML = `<p class="no-notifications">No notifications</p>`;
    return;
  }

  list.innerHTML = docs.map(doc => {
    const n = doc.data();
    const notification = { id: doc.id, ...n };
    
    // Handle timestamp safely
    let timeAgo = "Just now";
    if (notification.createdAt && notification.createdAt.seconds) {
      timeAgo = getTimeAgo(notification.createdAt);
    }
    
    // Escape quotes in message and handle missing taskId
    const message = (notification.message || "New notification").replace(/'/g, "&#39;");
    const taskId = notification.taskId || "";
    const notificationId = notification.id || "";
    
    // Click to open detail modal
    const clickHandler = `onclick="openNotificationDetail('${notificationId}')"`;
    
    // Add special styling for deadline notifications
    let notificationClass = `notification-item ${!notification.read ? "unread" : "read"}`;
    if (notification.type === "deadline_today" || notification.type === "deadline_overdue") {
      notificationClass += " notification-urgent";
    } else if (notification.type === "deadline_warning" || notification.type === "priority_auto_escalated") {
      notificationClass += " notification-warning";
    } else if (notification.type === "message") {
      notificationClass += " notification-message";
    }
    
    // Add mark as read button only for unread with accessibility
    const markReadBtn = !notification.read ? `<button class="mark-read-btn" onclick="event.stopPropagation(); markNotificationRead('${notificationId}')" aria-label="Mark notification as read" title="Mark as read">✓</button>` : '';
    
    return `
      <div class="${notificationClass}" ${clickHandler} role="listitem" tabindex="0" onkeypress="if(event.key === 'Enter') openNotificationDetail('${notificationId}')">
        <div class="notification-content">
          <div class="notification-title">${message}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
        ${markReadBtn}
      </div>
    `;
  }).join("");
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp.seconds * 1000);
  const diffInSeconds = Math.floor((now - time) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// -----------------------------
// Deadline Notification System
// -----------------------------
async function checkDeadlineNotifications() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const task of tasks) {
    if (task.done || !task.deadline) continue;
    
    const deadlineDate = new Date(task.deadline.seconds * 1000);
    const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    
    const daysUntil = Math.ceil((deadlineDay - today) / (1000 * 60 * 60 * 24));
    
    // Initialize notificationsSent if it doesn't exist
    const notificationsSent = task.notificationsSent || {};
    
    // AUTO-ESCALATE PRIORITY BASED ON DEADLINE PROXIMITY
    const currentPriority = task.priority || "medium";
    let newPriority = currentPriority;
    
    // Low → Medium when 7 days or less remain
    if (currentPriority === "low" && daysUntil <= 7) {
      newPriority = "medium";
    }
    // Medium → High when 3 days or less remain
    else if (currentPriority === "medium" && daysUntil <= 3) {
      newPriority = "high";
    }
    // Low → High when 2 days or less remain (skip medium)
    else if (currentPriority === "low" && daysUntil <= 2) {
      newPriority = "high";
    }
    
    // Update priority if it changed
    if (newPriority !== currentPriority) {
      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, { priority: newPriority });
      
      const priorityNames = { low: "🟢 Low", medium: "🟡 Medium", high: "🔴 High" };
      const recipient = currentUser === "Nate" ? "Craig" : "Nate";
      
      await addDoc(notificationsCollection, {
        type: "priority_auto_escalated",
        taskId: task.id,
        message: `⚡ Priority auto-escalated: "${task.title}" is now ${priorityNames[newPriority]} (deadline in ${daysUntil} day${daysUntil !== 1 ? 's' : ''})`,
        createdAt: new Date(),
        read: false,
        recipient: task.owner || currentUser,
        sender: "system",
      });
      
      console.log(`⚡ Auto-escalated "${task.title}" from ${currentPriority} to ${newPriority}`);
    }
    
    // Check if deadline is tomorrow and notification not sent
    if (daysUntil === 1 && !notificationsSent.oneDayBefore) {
      await addDoc(notificationsCollection, {
        type: "deadline_warning",
        taskId: task.id,
        message: `⚠️ Deadline approaching: "${task.title}" is due tomorrow`,
        createdAt: new Date(),
        read: false,
        recipient: task.owner || currentUser,
        sender: "system",
      });
      
      // Mark that we sent this notification
      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, {
        "notificationsSent.oneDayBefore": true
      });
      
      console.log(`📅 Sent 1-day warning for: ${task.title}`);
    }
    
    // Check if deadline is today and notification not sent
    if (daysUntil === 0 && !notificationsSent.dueToday) {
      await addDoc(notificationsCollection, {
        type: "deadline_today",
        taskId: task.id,
        message: `🚨 URGENT: "${task.title}" is due TODAY!`,
        createdAt: new Date(),
        read: false,
        recipient: task.owner || currentUser,
        sender: "system",
      });
      
      // Mark that we sent this notification
      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, {
        "notificationsSent.dueToday": true
      });
      
      console.log(`🚨 Sent due-today alert for: ${task.title}`);
    }
    
    // Check if deadline is 3 days away for high priority tasks
    if (task.priority === 'high' && daysUntil === 3 && !notificationsSent.threeDayBefore) {
      await addDoc(notificationsCollection, {
        type: "deadline_warning",
        taskId: task.id,
        message: `⏰ High priority task: "${task.title}" is due in 3 days`,
        createdAt: new Date(),
        read: false,
        recipient: task.owner || currentUser,
        sender: "system",
      });
      
      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, {
        "notificationsSent.threeDayBefore": true
      });
      
      console.log(`⏰ Sent 3-day warning for high-priority: ${task.title}`);
    }
    
    // Check if task is overdue and notification not sent
    if (daysUntil < 0 && !notificationsSent.overdue) {
      await addDoc(notificationsCollection, {
        type: "deadline_overdue",
        taskId: task.id,
        message: `❗ OVERDUE: "${task.title}" was due ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''} ago`,
        createdAt: new Date(),
        read: false,
        recipient: task.owner || currentUser,
        sender: "system",
      });
      
      const taskDoc = doc(db, "tasks", task.id);
      await updateDoc(taskDoc, {
        "notificationsSent.overdue": true
      });
      
      console.log(`❗ Sent overdue alert for: ${task.title}`);
    }
  }
}

// Run deadline check when tasks update
let deadlineCheckTimeout;
function scheduleDeadlineCheck() {
  clearTimeout(deadlineCheckTimeout);
  deadlineCheckTimeout = setTimeout(() => {
    checkDeadlineNotifications().catch(err => {
      console.error("Error checking deadlines:", err);
    });
  }, 1000); // Wait 1 second after tasks update to check
}

// -----------------------------
// Fetch and listen for real-time updates
// -----------------------------
function initializeApp() {
  if (!currentUser) return;

  showLoading('Loading tasks...');
  const q = query(tasksCollection, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    // Filter tasks for current user
    // Include tasks owned by user OR tasks where user is the reviewer
    tasks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(task => 
        !task.owner || 
        task.owner === currentUser || 
        (task.reviewer && task.reviewer.toLowerCase() === currentUser.toLowerCase())
      );
    
    // Filter by status
    // Include tasks that are in-review but submitted by current user so they don't disappear
    const activeTasks = tasks.filter(t => 
      !t.status || 
      t.status === 'active' || 
      t.status === 'needs-review' ||
      (t.status === 'in-review' && t.reviewSubmission?.submittedBy === currentUser)
    );
    const reviewTasks = tasks.filter(t => t.status === 'in-review');
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.done);

    renderTasks(activeTasks);
    renderUpdates(tasks);
    renderMemos(tasks); // Memos view shows all tasks with descriptions
    renderNeeds(activeTasks);
    renderReview(tasks); // Render review panel
    renderCompleted(completedTasks);
    renderCompletedBin(); // Update completed bin
    renderCompletedWork(); // Update completed work view
    
    // Check for deadline notifications
    scheduleDeadlineCheck();
    hideLoading();
  }, (error) => {
    console.log("Error fetching tasks:", error);
    hideLoading();
  });

  // Initialize permanent files listener
  initPermanentFilesListener();
  
  // Initialize chatbot
  initializeChatBot();

  // Listen for all notifications for current user
  showLoading('Loading notifications...');
  const notificationsQuery = query(
    notificationsCollection,
    where("recipient", "==", currentUser),
    orderBy("createdAt", "desc")
  );

  onSnapshot(notificationsQuery, (snapshot) => {
    // Trigger system notifications for new notifications
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        
        // Trigger browser notification popup
        if (Notification.permission === "granted" && !data.read) {
          new Notification("TaskLedger Update", {
            body: data.message,
            icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%232563eb'/%3E%3Ctext x='50' y='50' font-size='40' text-anchor='middle' dominant-baseline='middle' fill='white'%3ETL%3C/text%3E%3C/svg%3E",
            badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%232563eb'/%3E%3C/svg%3E",
            tag: data.type,
            requireInteraction: false,
            silent: false
          });
        }
      }
    });
    
    // Update UI
    const allNotifications = snapshot.docs;
    
    // Separate read and unread
    const unreadDocs = allNotifications.filter(doc => !doc.data().read);
    const readDocs = allNotifications.filter(doc => doc.data().read);
    
    const badge = document.getElementById("notificationBadge");
    const count = unreadDocs.length;

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }

    // Render with unread first, then read
    renderNotifications([...unreadDocs, ...readDocs]);
    
    // Check for high-priority messages on first load
    checkHighPriorityMessages();
    
    hideLoading();
  }, (error) => {
    console.log("Error fetching notifications:", error);
    hideLoading();
    console.log("If you see an index error, please create the composite index in Firebase Console");
    console.log("Or check the error message for a direct link to create it");
  });

  // Listen for messages addressed to current user
  const messagesQuery = query(
    messagesCollection,
    where("recipient", "==", currentUser),
    orderBy("createdAt", "desc")
  );

  onSnapshot(messagesQuery, (snapshot) => {
    messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`${messages.length} message(s) received for ${currentUser}`);
  }, (error) => {
    console.log("Error fetching messages:", error);
    console.log("If you see an index error, please create the composite index in Firebase Console");
  });

  // Run deadline check periodically (every hour)
  setInterval(() => {
    if (tasks.length > 0) {
      checkDeadlineNotifications().catch(err => {
        console.error("Periodic deadline check error:", err);
      });
    }
  }, 60 * 60 * 1000); // Check every hour

  // Also check deadlines when page becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && tasks.length > 0) {
      checkDeadlineNotifications().catch(err => {
        console.error("Visibility deadline check error:", err);
      });
    }
  });
}

// ========================================
// FILE MANAGEMENT FUNCTIONS
// ========================================

// Sanitize filename to prevent CORS issues
function sanitizeFilename(filename) {
  // Replace spaces with underscores and remove special characters
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/__+/g, '_');
}

// Upload file to Storage and return download URL
async function uploadFileToStorage(file, path) {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);
  
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url: downloadURL, path: path, name: file.name, size: file.size, type: file.type });
      }
    );
  });
}

// Delete file from Storage
async function deleteFileFromStorage(filePath) {
  try {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    console.log('File deleted successfully:', filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw - file might already be deleted
  }
}

// Handle task file upload
async function uploadTaskFile(taskId, file) {
  showLoading('Uploading file...');
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const path = `tasks/${taskId}/${Date.now()}_${sanitizedName}`;
    const fileData = await uploadFileToStorage(file, path);
    
    // Save file reference to task
    const taskDoc = doc(db, "tasks", taskId);
    await updateDoc(taskDoc, {
      attachedFile: fileData
    });
    
    hideLoading();
    return fileData;
  } catch (error) {
    console.error('Error uploading task file:', error);
    hideLoading();
    alert('Failed to upload file. Please try again.');
    throw error;
  }
}

// Handle memo file upload
async function uploadMemoFile(taskId, file) {
  showLoading('Uploading file...');
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const path = `memos/${taskId}/${Date.now()}_${sanitizedName}`;
    const fileData = await uploadFileToStorage(file, path);
    
    const taskDoc = doc(db, "tasks", taskId);
    await updateDoc(taskDoc, {
      memoFile: fileData
    });
    
    hideLoading();
    return fileData;
  } catch (error) {
    console.error('Error uploading memo file:', error);
    hideLoading();
    alert('Failed to upload file. Please try again.');
    throw error;
  }
}

// Handle needs file upload
async function uploadNeedsFile(taskId, needIndex, file) {
  showLoading('Uploading file...');
  try {
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    
    const sanitizedName = sanitizeFilename(file.name);
    const path = `needs/${taskId}/${needIndex}/${Date.now()}_${sanitizedName}`;
    const fileData = await uploadFileToStorage(file, path);
    
    // Update the specific need with file data
    const needs = [...(task.needs || [])];
    if (!needs[needIndex]) throw new Error('Need not found');
    
    needs[needIndex] = {
      ...needs[needIndex],
      attachedFile: fileData
    };
    
    const taskDoc = doc(db, "tasks", taskId);
    await updateDoc(taskDoc, { needs });
    
    hideLoading();
    return fileData;
  } catch (error) {
    console.error('Error uploading needs file:', error);
    hideLoading();
    alert('Failed to upload file. Please try again.');
    throw error;
  }
}

// Delete task files on completion
async function deleteTaskFiles(task) {
  const filesToDelete = [];
  
  // Task attached file
  if (task.attachedFile?.path) {
    filesToDelete.push(deleteFileFromStorage(task.attachedFile.path));
  }
  
  // Memo file
  if (task.memoFile?.path) {
    filesToDelete.push(deleteFileFromStorage(task.memoFile.path));
  }
  
  // Needs files
  if (task.needs && Array.isArray(task.needs)) {
    task.needs.forEach(need => {
      if (need.attachedFile?.path) {
        filesToDelete.push(deleteFileFromStorage(need.attachedFile.path));
      }
    });
  }
  
  await Promise.all(filesToDelete);
}

// Delete memo file on completion
async function deleteMemoFile(task) {
  if (task.memoFile?.path) {
    await deleteFileFromStorage(task.memoFile.path);
  }
}

// Delete need file on completion
async function deleteNeedFile(need) {
  if (need.attachedFile?.path) {
    await deleteFileFromStorage(need.attachedFile.path);
  }
}

// ========================================
// REVIEW SYSTEM
// ========================================

let currentReviewTaskId = null;
let currentReviewAction = null;

function openReviewFeedbackModal(taskId, action) {
  const task = tasks.find(t => t.id === taskId);
  currentReviewTaskId = taskId;
  currentReviewAction = action;
  
  const modal = document.getElementById("reviewFeedbackModal");
  const title = document.getElementById("reviewFeedbackTitle");
  const taskTitle = document.getElementById("reviewFeedbackTaskTitle");
  const btn = document.getElementById("reviewActionBtn");
  
  if (action === 'approve') {
    title.textContent = "Approve Task Completion";
    btn.textContent = "Approve & Complete";
    btn.style.background = "#10b981";
  } else {
    title.textContent = "Request Changes";
    btn.textContent = "Flag for Review";
    btn.style.background = "#ef4444";
  }
  
  taskTitle.textContent = `Task: ${task.title}`;
  document.getElementById("reviewFeedbackNotes").value = "";
  modal.style.display = "flex";
}

function closeReviewFeedbackModal() {
  document.getElementById("reviewFeedbackModal").style.display = "none";
  document.getElementById("reviewFeedbackNotes").value = "";
  currentReviewTaskId = null;
  currentReviewAction = null;
}

async function submitReviewAction() {
  if (!currentReviewTaskId || !currentReviewAction) return;
  
  const feedback = document.getElementById("reviewFeedbackNotes").value.trim();
  
  if (currentReviewAction === 'approve') {
    await verifyTaskComplete(currentReviewTaskId, feedback);
  } else {
    await flagForReview(currentReviewTaskId, feedback);
  }
  
  closeReviewFeedbackModal();
}

async function verifyTaskComplete(taskId, feedback) {
  showLoading('Approving task...');
  const task = tasks.find(t => t.id === taskId);
  const taskDoc = doc(db, "tasks", taskId);
  
  // Delete all task files when completing
  try {
    await deleteTaskFiles(task);
  } catch (error) {
    console.error('Error deleting task files:', error);
  }
  
  // Auto-complete all memos and needs for this task
  const updateData = {
    status: 'completed',
    done: true,
    reviewedBy: currentUser,
    reviewedAt: new Date(),
    reviewFeedback: feedback || 'Approved'
  };
  
  // Mark memo as complete if it exists
  if (task.description && task.description.trim()) {
    updateData.memoCompleted = true;
    updateData.memoCompletedAt = new Date();
  }
  
  // Mark all needs as complete
  if (task.needs && task.needs.length > 0) {
    updateData.needs = task.needs.map(need => ({
      ...need,
      completed: true,
      completedAt: new Date()
    }));
  }
  
  // Update task to completed status
  await updateDoc(taskDoc, updateData);
  
  // Add update to task history
  const updates = task.updates || [];
  updates.push({
    type: 'approved',
    text: `✅ Approved by ${currentUser}${feedback ? `: ${feedback}` : ''}`,
    timestamp: new Date(),
    by: currentUser
  });
  await updateDoc(taskDoc, { updates });
  
  // Create notification for task owner
  const recipient = task.createdBy || (currentUser === "Nate" ? "Craig" : "Nate");
  await addDoc(notificationsCollection, {
    type: "task_approved",
    taskId: taskId,
    message: `${currentUser} approved your task: "${task.title}"`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
  
  hideLoading();
  alert('Task approved and marked complete! ✅');
}

async function flagForReview(taskId, feedback) {
  showLoading('Flagging for review...');
  const task = tasks.find(t => t.id === taskId);
  const taskDoc = doc(db, "tasks", taskId);
  
  if (!feedback) {
    hideLoading();
    alert('Please provide feedback about what needs to be changed.');
    return;
  }
  
  // Move task to needs-review status with review feedback
  // Set reviewer to task owner so it appears in their review dashboard
  const taskOwner = task.createdBy || (currentUser === "Nate" ? "Craig" : "Nate");
  await updateDoc(taskDoc, {
    status: 'needs-review',
    done: false,
    reviewedBy: currentUser,
    reviewedAt: new Date(),
    reviewFeedback: feedback,
    reviewer: taskOwner,
    flaggedForChanges: true
  });
  
  // Add update to task history
  const updates = task.updates || [];
  updates.push({
    type: 'flagged',
    text: `🚩 Flagged by ${currentUser}: ${feedback}`,
    timestamp: new Date(),
    by: currentUser
  });
  await updateDoc(taskDoc, { updates });
  
  // Create notification for task owner
  const recipient = task.createdBy || (currentUser === "Nate" ? "Craig" : "Nate");
  await addDoc(notificationsCollection, {
    type: "task_flagged",
    taskId: taskId,
    message: `${currentUser} requested changes on "${task.title}": ${feedback}`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });
  
  hideLoading();
  alert('Task flagged for review and sent back to task owner. 🚩');
}

function renderReview(tasksToRender) {
  const container = document.getElementById("reviewList");
  if (!container) return;
  
  // Only show tasks where current user is the assigned reviewer
  // This includes both 'in-review' (awaiting review) and 'needs-review' (flagged for changes)
  // Use case-insensitive comparison to ensure reliability
  const reviewTasks = tasksToRender.filter(t => 
    (t.status === 'in-review' || t.status === 'needs-review') && 
    t.reviewer && t.reviewer.toLowerCase() === currentUser.toLowerCase()
  );
  
  // Update review badge
  const badge = document.getElementById("reviewBadge");
  if (badge) {
    if (reviewTasks.length > 0) {
      badge.textContent = reviewTasks.length;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
  
  if (reviewTasks.length === 0) {
    container.innerHTML = "<p class='no-reviews'>No tasks pending review.</p>";
    return;
  }
  
  container.innerHTML = reviewTasks.map(task => {
    const submission = task.reviewSubmission || {};
    const submittedDate = submission.submittedAt?.seconds 
      ? new Date(submission.submittedAt.seconds * 1000).toLocaleString()
      : 'Unknown date';
    
    // Check if this task was flagged for review
    const isFlagged = task.status === 'needs-review';
    const statusLabel = isFlagged ? 'Needs Changes' : 'Pending Review';
    const statusClass = isFlagged ? 'needs-changes-status' : 'review-status';
    
    let feedbackHTML = '';
    if (isFlagged && task.reviewFeedback) {
      feedbackHTML = `
        <div class="review-feedback-section">
          <h4>🚩 Reviewer Feedback:</h4>
          <p class="feedback-text">${task.reviewFeedback}</p>
          <p class="feedback-meta">From ${task.reviewedBy} on ${task.reviewedAt?.seconds ? new Date(task.reviewedAt.seconds * 1000).toLocaleString() : 'Unknown date'}</p>
        </div>
      `;
    }
    
    // Show original task attachment if present
    let taskFileHTML = '';
    if (task.attachedFile) {
      taskFileHTML = `<div class="review-files"><h4>📎 Original Task File:</h4>
        <div class="task-file-attachment">
          <div class="file-icon">${getFileIcon(task.attachedFile.type)}</div>
          <div class="file-info-compact">
            <div class="file-name-small">${task.attachedFile.name}</div>
            <div class="file-size-small">${(task.attachedFile.size / 1024).toFixed(2)} KB</div>
          </div>
          <a href="${task.attachedFile.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
        </div>
      </div>`;
    }
    
    // Show review submission files if present
    let filesHTML = '';
    if (submission.files && submission.files.length > 0) {
      filesHTML = '<div class="review-files"><h4>📎 Additional Review Files:</h4>' +
        submission.files.map(file => `
          <div class="task-file-attachment">
            <div class="file-icon">${getFileIcon(file.type)}</div>
            <div class="file-info-compact">
              <div class="file-name-small">${file.name}</div>
              <div class="file-size-small">${(file.size / 1024).toFixed(2)} KB</div>
            </div>
            <a href="${file.url}" target="_blank" class="file-download-small" title="Download">⬇️</a>
          </div>
        `).join('') + '</div>';
    }
    
    let imageHTML = '';
    if (submission.imageUrl) {
      imageHTML = `<div class="review-image"><h4>📸 Image:</h4><img src="${submission.imageUrl}" alt="Completion image" style="max-width: 100%; border-radius: 8px; margin-top: 8px;" /></div>`;
    }
    
    let linksHTML = '';
    if (submission.links && submission.links.length > 0) {
      linksHTML = '<div class="review-links"><h4>🔗 Links:</h4>' +
        submission.links.map(link => `
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="review-link">🔗 ${link.text}</a>
        `).join('') + '</div>';
    }
    
    return `
      <div class="review-card ${isFlagged ? 'flagged' : ''}">
        <div class="review-header">
          <h3>${task.title}</h3>
          <span class="${statusClass}">${statusLabel}</span>
        </div>
        <div class="review-meta">
          <span>Submitted by ${submission.submittedBy || 'Unknown'}</span>
          <span>${submittedDate}</span>
        </div>
        ${feedbackHTML}
        <div class="review-notes">
          <h4>📝 Completion Summary:</h4>
          <p>${submission.notes || 'No notes provided'}</p>
        </div>
        ${taskFileHTML}
        ${filesHTML}
        ${imageHTML}
        ${linksHTML}
        <div class="review-actions">
          <button class="approve-btn" onclick="openReviewFeedbackModal('${task.id}', 'approve')">
            ✅ Verify as Complete
          </button>
          <button class="reject-btn" onclick="openReviewFeedbackModal('${task.id}', 'reject')">
            🚩 Flag for Review
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================
// PERMANENT FILE STORAGE
// ========================================

const filesCollection = collection(db, "permanentFiles");
let permanentFiles = [];

// Initialize permanent files listener
function initPermanentFilesListener() {
  const q = query(filesCollection, orderBy("uploadedAt", "desc"));
  onSnapshot(q, (snapshot) => {
    permanentFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderPermanentFiles();
  });
}

function renderPermanentFiles() {
  const container = document.getElementById("filesList");
  if (!container) return;
  
  if (permanentFiles.length === 0) {
    container.innerHTML = "<p class='no-files'>No resources yet. Click 'Add Resource' to add files or links.</p>";
    return;
  }
  
  container.innerHTML = permanentFiles.map(file => {
    const uploadDate = file.uploadedAt?.seconds 
      ? new Date(file.uploadedAt.seconds * 1000).toLocaleDateString() 
      : 'Unknown date';
    
    const isLink = file.resourceType === 'link';
    const icon = isLink ? '🔗' : getFileIcon(file.type);
    const fileSize = !isLink && file.size ? (file.size / 1024).toFixed(2) + ' KB' : '';
    
    return `
      <div class="file-card">
        <div class="file-icon">${icon}</div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-label">${file.label || 'No description'}</div>
          ${file.taskAssociation ? `<div class="file-task-tag">📎 ${file.taskAssociation}</div>` : ''}
          <div class="file-meta">
            ${fileSize ? `<span>${fileSize}</span> • ` : ''}
            <span>${uploadDate}</span> • 
            <span>by ${file.uploadedBy}</span>
          </div>
        </div>
        <div class="file-actions">
          <a href="${file.url}" target="_blank" class="file-download-btn" title="${isLink ? 'Open Link' : 'Download'}">${isLink ? '↗️' : '⬇️'}</a>
          <button class="file-delete-btn" onclick="deletePermanentFile('${file.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function getFileIcon(fileType) {
  if (!fileType) return '📄';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType.startsWith('video/')) return '🎥';
  if (fileType.startsWith('audio/')) return '🎵';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('word') || fileType.includes('document')) return '📘';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
  if (fileType.includes('zip') || fileType.includes('rar')) return '🗜️';
  return '📄';
}

// Resource Modal Functions
let currentResourceType = 'file'; // Track whether we're adding file or link

function openFileUploadModal() {
  document.getElementById("fileUploadModal").style.display = "flex";
  document.getElementById("resourceLabel").value = "";
  document.getElementById("resourceTaskAssociation").value = "";
  document.getElementById("permanentFileInput").value = "";
  document.getElementById("permanentLinkUrl").value = "";
  document.getElementById("fileUploadProgress").style.display = "none";
  // Reset to file tab
  switchResourceTab('file');
}

function closeFileUploadModal() {
  document.getElementById("fileUploadModal").style.display = "none";
}

function switchResourceTab(type) {
  currentResourceType = type;
  const fileTab = document.getElementById("fileTab");
  const linkTab = document.getElementById("linkTab");
  const fileSection = document.getElementById("fileResourceSection");
  const linkSection = document.getElementById("linkResourceSection");
  
  if (type === 'file') {
    fileTab.classList.add('active');
    linkTab.classList.remove('active');
    fileSection.style.display = 'block';
    linkSection.style.display = 'none';
  } else {
    linkTab.classList.add('active');
    fileTab.classList.remove('active');
    linkSection.style.display = 'block';
    fileSection.style.display = 'none';
  }
}

async function uploadPermanentFile() {
  if (currentResourceType === 'link') {
    await savePermanentLink();
    return;
  }
  
  const fileInput = document.getElementById("permanentFileInput");
  const label = document.getElementById("resourceLabel").value.trim();
  const taskAssociation = document.getElementById("resourceTaskAssociation").value.trim();
  
  if (!fileInput.files[0]) {
    alert('Please select a file to upload');
    return;
  }
  
  const file = fileInput.files[0];
  const progressDiv = document.getElementById("fileUploadProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  
  progressDiv.style.display = "block";
  
  try {
    const sanitizedName = sanitizeFilename(file.name);
    const path = `permanentFiles/${currentUser}/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        progressFill.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '%';
      },
      (error) => {
        console.error('Upload error:', error);
        alert('Failed to upload file. Please try again.');
        progressDiv.style.display = "none";
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Save file metadata to Firestore
        await addDoc(filesCollection, {
          name: file.name,
          label: label || file.name,
          taskAssociation: taskAssociation,
          url: downloadURL,
          path: path,
          size: file.size,
          type: file.type,
          resourceType: 'file', // Mark as file resource
          uploadedBy: currentUser,
          uploadedAt: new Date()
        });
        
        closeFileUploadModal();
        progressDiv.style.display = "none";
      }
    );
  } catch (error) {
    console.error('Error uploading permanent file:', error);
    alert('Failed to upload file. Please try again.');
    progressDiv.style.display = "none";
  }
}

async function savePermanentLink() {
  const linkUrl = document.getElementById("permanentLinkUrl").value.trim();
  const label = document.getElementById("resourceLabel").value.trim();
  const taskAssociation = document.getElementById("resourceTaskAssociation").value.trim();
  
  if (!linkUrl) {
    alert('Please enter a URL');
    return;
  }
  
  // Validate URL format
  try {
    new URL(linkUrl);
  } catch (e) {
    alert('Please enter a valid URL (e.g., https://example.com)');
    return;
  }
  
  showLoading('Saving link...');
  
  try {
    // Save link metadata to Firestore
    await addDoc(filesCollection, {
      name: label || linkUrl,
      label: label || linkUrl,
      taskAssociation: taskAssociation,
      url: linkUrl,
      resourceType: 'link', // Mark as link resource
      uploadedBy: currentUser,
      uploadedAt: new Date()
    });
    
    hideLoading();
    closeFileUploadModal();
  } catch (error) {
    console.error('Error saving permanent link:', error);
    alert('Failed to save link. Please try again.');
    hideLoading();
  }
}

async function deletePermanentFile(fileId) {
  if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
    return;
  }
  
  showLoading('Deleting resource...');
  
  try {
    const file = permanentFiles.find(f => f.id === fileId);
    if (!file) throw new Error('Resource not found');
    
    // Delete from Storage only if it's a file (not a link)
    if (file.resourceType !== 'link' && file.path) {
      await deleteFileFromStorage(file.path);
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, "permanentFiles", fileId));
    
    hideLoading();
  } catch (error) {
    console.error('Error deleting permanent resource:', error);
    alert('Failed to delete resource. Please try again.');
    hideLoading();
  }
}

// -----------------------------
// AI Chatbot Functions
// -----------------------------

// Get Gemini API Key from config
const GEMINI_API_KEY = config.GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');

// Toggle chat modal
function toggleChatBot() {
  const modal = document.getElementById('chatBotModal');
  const isOpen = modal.classList.contains('open');
  
  if (isOpen) {
    modal.classList.remove('open');
  } else {
    modal.classList.add('open');
    // Load chat history when opening
    loadChatHistory();
  }
}

// Handle Enter key in chat input
function handleChatKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

// Gather context about current workspace state
function gatherContext() {
  const activeTasks = tasks.filter(t => !t.done);
  const activeNeeds = [];
  const activeMemos = [];
  
  tasks.forEach(task => {
    if (task.description && !task.memoCompleted) {
      activeMemos.push({
        task: task.title,
        memo: task.description
      });
    }
    
    const needs = task.needs || [];
    needs.forEach(need => {
      const needObj = typeof need === 'string' ? { text: need } : need;
      if (!needObj.completed && !needObj.fulfilled) {
        activeNeeds.push({
          task: task.title,
          need: needObj.text
        });
      }
    });
  });
  
  return {
    currentUser,
    totalTasks: tasks.length,
    activeTasks: activeTasks.length,
    completedTasks: tasks.filter(t => t.done).length,
    activeNeeds: activeNeeds.length,
    activeMemos: activeMemos.length,
    recentTasks: activeTasks.slice(0, 5).map(t => ({
      title: t.title,
      priority: t.priority,
      createdBy: t.createdBy
    })),
    recentNeeds: activeNeeds.slice(0, 5),
    knowledgeBaseEntries: knowledgeBase.length
  };
}

// Build system prompt with context
function buildSystemPrompt() {
  const context = gatherContext();
  
  return `You are an AI assistant for TaskLedger, a collaborative task management app used by Craig and Nate.

CURRENT CONTEXT:
- Current user: ${context.currentUser}
- Active tasks: ${context.activeTasks}
- Active needs: ${context.activeNeeds}
- Active memos: ${context.activeMemos}

TASKLEDGER FEATURES:
1. Tasks: Create tasks, set priorities (high/medium/low), mark as done, submit for review
2. Memos: Add detailed notes/descriptions to tasks with links and files
3. Needs: Track required items, contacts, or resources for tasks - can be completed or fulfilled
4. Review System: Tasks can be submitted for review by the other user
5. Updates Feed: Share progress updates with notes, links, and files
6. Resources: Permanent file and link storage for important documents
7. Completed Bin: Archive for completed memos and needs

HOW TO FULFILL NEEDS:
- Click the "✅ Fulfill Need" button on any need card
- Provide fulfillment information: notes, contact details, links
- Fulfilled needs move to the "Fulfilled Needs" section in Completed Items

KNOWLEDGE BASE:
You have access to a knowledge base with ${context.knowledgeBaseEntries} entries containing critical information like login credentials, platform details, and important contacts.

When answering questions:
1. Be concise and helpful
2. If asked about login details or credentials, search the knowledge base
3. Provide step-by-step instructions for TaskLedger features
4. Reference the current context when relevant
5. If you don't have specific information, be honest about it`;
}

// Send message to Gemini API
async function callGeminiAPI(userMessage) {
  if (!GEMINI_API_KEY) {
    return "⚠️ Gemini API key not found. Please add GEMINI_API_KEY to your environment variables or localStorage.";
  }
  
  try {
    const systemPrompt = buildSystemPrompt();
    
    // Search knowledge base for relevant information
    const relevantKnowledge = await searchKnowledgeBase(userMessage);
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      knowledgeContext = '\n\nRELEVANT KNOWLEDGE BASE ENTRIES:\n' + 
        relevantKnowledge.map(k => `- ${k.title}: ${k.content}`).join('\n');
    }
    
    // Build conversation history for context
    const recentHistory = chatHistory.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...recentHistory,
            {
              role: 'user',
              parts: [{ text: systemPrompt + knowledgeContext + '\n\nUser question: ' + userMessage }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return `Sorry, I encountered an error: ${error.message}. Please try again.`;
  }
}

// Search knowledge base
async function searchKnowledgeBase(query) {
  const queryLower = query.toLowerCase();
  return knowledgeBase.filter(item => {
    const titleMatch = item.title?.toLowerCase().includes(queryLower);
    const contentMatch = item.content?.toLowerCase().includes(queryLower);
    const tagsMatch = item.tags?.some(tag => queryLower.includes(tag.toLowerCase()));
    return titleMatch || contentMatch || tagsMatch;
  }).slice(0, 3); // Return top 3 matches
}

// Add message to chat UI
function addMessageToUI(content, role) {
  const messagesContainer = document.getElementById('chatBotMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.innerHTML = `
    <div class="message-bubble">${content}</div>
    <div class="message-timestamp">${timestamp}</div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
  const messagesContainer = document.getElementById('chatBotMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message assistant';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <div class="message-bubble typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

// Send chat message
async function sendChatMessage() {
  const input = document.getElementById('chatBotInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const userMessage = input.value.trim();
  
  if (!userMessage) return;
  
  // Disable input
  input.disabled = true;
  sendBtn.disabled = true;
  
  // Add user message to UI
  addMessageToUI(userMessage, 'user');
  input.value = '';
  
  // Add to chat history
  chatHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date()
  });
  
  // Show typing indicator
  showTypingIndicator();
  
  // Get AI response
  const aiResponse = await callGeminiAPI(userMessage);
  
  // Remove typing indicator
  removeTypingIndicator();
  
  // Add AI response to UI
  addMessageToUI(aiResponse, 'assistant');
  
  // Add to chat history
  chatHistory.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date()
  });
  
  // Save to Firestore
  await saveChatMessage(userMessage, aiResponse);
  
  // Re-enable input
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

// Save chat message to Firestore
async function saveChatMessage(userMessage, aiResponse) {
  try {
    await addDoc(chatCollection, {
      user: currentUser,
      userMessage,
      aiResponse,
      timestamp: new Date(),
      context: gatherContext()
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
  }
}

// Load chat history from Firestore
async function loadChatHistory() {
  try {
    const q = query(
      chatCollection,
      where('user', '==', currentUser),
      orderBy('timestamp', 'desc'),
      // limit to last 20 messages
    );
    
    const snapshot = await getDocs(q);
    chatHistory = [];
    
    // Clear UI except welcome message
    const messagesContainer = document.getElementById('chatBotMessages');
    const welcomeMessage = messagesContainer.querySelector('.chat-message.assistant');
    messagesContainer.innerHTML = '';
    if (welcomeMessage) {
      messagesContainer.appendChild(welcomeMessage);
    }
    
    // Load recent messages (reverse order to show oldest first)
    snapshot.docs.reverse().slice(-10).forEach(doc => {
      const data = doc.data();
      chatHistory.push(
        { role: 'user', content: data.userMessage, timestamp: data.timestamp },
        { role: 'assistant', content: data.aiResponse, timestamp: data.timestamp }
      );
    });
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Load knowledge base
async function loadKnowledgeBase() {
  try {
    const snapshot = await getDocs(knowledgeCollection);
    knowledgeBase = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`Loaded ${knowledgeBase.length} knowledge base entries`);
  } catch (error) {
    console.error('Error loading knowledge base:', error);
  }
}

// Extract and save critical information when app closes
async function extractAndSaveKnowledge() {
  showLoading('Processing information...');
  
  try {
    const criticalInfo = [];
    
    // Extract login/credential information from tasks, memos, and updates
    tasks.forEach(task => {
      // Check description for keywords
      const keywords = ['login', 'password', 'credential', 'username', 'email', 'phone', 'contact'];
      const description = task.description?.toLowerCase() || '';
      const title = task.title?.toLowerCase() || '';
      
      if (keywords.some(keyword => description.includes(keyword) || title.includes(keyword))) {
        criticalInfo.push({
          type: 'credential',
          source: 'task',
          title: task.title,
          content: task.description || task.title,
          taskId: task.id,
          createdBy: task.createdBy,
          tags: keywords.filter(k => description.includes(k) || title.includes(k))
        });
      }
      
      // Check updates for critical info
      if (task.updates) {
        task.updates.forEach(update => {
          const updateText = update.text?.toLowerCase() || '';
          if (keywords.some(keyword => updateText.includes(keyword))) {
            criticalInfo.push({
              type: 'update',
              source: 'task-update',
              title: `Update: ${task.title}`,
              content: update.text,
              taskId: task.id,
              createdBy: update.author,
              tags: keywords.filter(k => updateText.includes(k))
            });
          }
        });
      }
    });
    
    // Save to knowledge base (avoid duplicates)
    for (const info of criticalInfo) {
      // Check if similar entry exists
      const exists = knowledgeBase.some(kb => 
        kb.title === info.title && kb.content === info.content
      );
      
      if (!exists) {
        await addDoc(knowledgeCollection, {
          ...info,
          extractedAt: new Date(),
          extractedBy: currentUser
        });
      }
    }
    
    console.log(`Extracted ${criticalInfo.length} knowledge entries`);
  } catch (error) {
    console.error('Error extracting knowledge:', error);
  } finally {
    hideLoading();
  }
}

// Set up beforeunload handler
window.addEventListener('beforeunload', (event) => {
  // Fire and forget - don't block closing
  extractAndSaveKnowledge();
});

// Initialize chatbot
async function initializeChatBot() {
  await loadKnowledgeBase();
  
  // Check for API key in localStorage if not in env
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found. Set VITE_GEMINI_API_KEY or add to localStorage as GEMINI_API_KEY');
  }
}

// Call initialization after app loads
if (currentUser) {
  initializeChatBot();
}
