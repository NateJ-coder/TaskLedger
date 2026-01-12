import { db } from "./firebase-config.js";
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
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
window.clearAllNotifications = clearAllNotifications;
window.toggleMemoComplete = toggleMemoComplete;
window.toggleNeedComplete = toggleNeedComplete;
window.toggleCompletedBin = toggleCompletedBin;
window.openNeedCompletionModal = openNeedCompletionModal;
window.closeNeedCompletionModal = closeNeedCompletionModal;
window.saveNeedCompletion = saveNeedCompletion;

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
const tasksCollection = collection(db, "tasks");
const notificationsCollection = collection(db, "notifications");
const messagesCollection = collection(db, "messages");

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

  // Determine recipient (the other user)
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";

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

  if (!task.done) {
    // If marking as complete, show the modal
    hideLoading();
    openCompletionModal(id);
  } else {
    // If un-checking, mark as incomplete immediately
    await updateDoc(taskDoc, { done: false, completionNotes: "" });
    hideLoading();
  }
}

// -----------------------------
// Completion Modal Logic
// -----------------------------
function openCompletionModal(id) {
  taskToCompleteId = id;
  document.getElementById("completionModal").style.display = "flex";
}

function closeCompletionModal() {
  document.getElementById("completionModal").style.display = "none";
  document.getElementById("completionNotes").value = "";
  taskToCompleteId = null;
  // Re-check the checkbox since the user cancelled
  renderTasks(tasks.filter(t => !t.done));
}

async function saveCompletionDetails() {
  if (!taskToCompleteId) return;

  showLoading('Completing task...');
  const task = tasks.find(t => t.id === taskToCompleteId);
  const notes = document.getElementById("completionNotes").value.trim();
  const taskDoc = doc(db, "tasks", taskToCompleteId);

  await updateDoc(taskDoc, {
    done: true,
    completionNotes: notes,
  });
  
  // Create notification for completion
  const recipient = currentUser === "Nate" ? "Craig" : "Nate";
  await addDoc(notificationsCollection, {
    type: "completion",
    taskId: taskToCompleteId,
    message: `${currentUser} completed task: ${task.title}`,
    createdAt: new Date(),
    read: false,
    recipient: recipient,
    sender: currentUser,
  });

  closeCompletionModal();
  hideLoading();
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
  document.getElementById("memoModal").style.display = "flex";
}

function closeMemoModal() {
  document.getElementById("memoModal").style.display = "none";
  document.getElementById("memoText").value = "";
  taskToEditMemoId = null;
}

async function saveMemo() {
  if (!taskToEditMemoId) return;

  showLoading('Saving memo...');
  const task = tasks.find(t => t.id === taskToEditMemoId);
  const memoText = document.getElementById("memoText").value.trim();
  const taskDoc = doc(db, "tasks", taskToEditMemoId);

  await updateDoc(taskDoc, {
    description: memoText,
  });

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
  document.getElementById("needsModal").style.display = "flex";
}

function closeNeedsModal() {
  document.getElementById("needsModal").style.display = "none";
  document.getElementById("needsText").value = "";
  taskToEditNeedsId = null;
}

async function saveNeeds() {
  if (!taskToEditNeedsId) return;

  showLoading('Saving needs...');
  const needsText = document.getElementById("needsText").value.trim();
  
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
}

async function sendMessage() {
  const messageText = document.getElementById("messageText").value.trim();
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
      createdAt: new Date(),
      read: false,
    });
    
    // Create notification for recipient with messageId reference
    await addDoc(notificationsCollection, {
      type: "message",
      messageId: messageDoc.id,
      message: `New message from ${currentUser}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
      fullMessage: messageText,
      createdAt: new Date(),
      read: false,
      recipient: recipient,
      sender: currentUser,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message. Please try again.");
    return;
  }
  
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

    div.innerHTML = `
      <div class="task-header">
        <div>
          <strong>${task.title}</strong>
          <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
          ${deadlineHTML}
        </div>
        <input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone('${task.id}')">
      </div>
      ${updateHistoryHTML}
      ${attachmentsHTML}
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
      div.innerHTML = `
        <div class="memo-header">
          <div class="memo-header-left">
            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoComplete('${task.id}')" class="memo-checkbox">
            <strong class="${isCompleted ? 'crossed-off' : ''}">${task.title}</strong>
          </div>
          <div class="jump-link" onclick="jumpTo('task', '${task.id}')">✅ View Task</div>
        </div>
        <div class="memo-body ${isCompleted ? 'crossed-off' : ''}" style="display: block;">${task.description}</div>
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
        // Only show non-completed needs
        if (!needObj.completed) {
          allNeeds.push({
            ...needObj,
            taskId: task.id,
            taskTitle: task.title,
            needIndex: index
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
    
    div.innerHTML = `
      <div class="need-header">
        <div class="task-link" onclick="jumpTo('task', '${need.taskId}')">From task: ${need.taskTitle}</div>
        <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
      </div>
      <div class="need-content">
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleNeedComplete('${need.taskId}', ${need.needIndex})" class="need-checkbox">
        <div class="need-text ${isCompleted ? 'crossed-off' : ''}">${need.text}</div>
      </div>
      <button class="priority-change-btn" onclick="changeNeedPriority('${need.taskId}', ${need.needIndex})">🚩 Change Need Priority</button>
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
    memosContainer.innerHTML = completedMemos.map(task => `
      <div class="bin-item">
        <div class="bin-item-header">
          <strong>${task.title}</strong>
          <button class="restore-btn" onclick="toggleMemoComplete('${task.id}')" title="Restore">↺</button>
        </div>
        <div class="bin-item-body">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</div>
      </div>
    `).join("");
  }
  
  // Render completed needs
  const needsContainer = document.getElementById("completedNeedsList");
  const completedNeeds = [];
  
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
  
  // Update badge count
  const totalCompleted = completedMemos.length + completedNeeds.length;
  const badge = document.getElementById("completedBinBadge");
  if (totalCompleted > 0) {
    badge.textContent = totalCompleted;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
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
    tasks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(task => !task.owner || task.owner === currentUser);
    
    const activeTasks = tasks.filter(t => !t.done);
    const completedTasks = tasks.filter(t => t.done);

    renderTasks(activeTasks);
    renderUpdates(tasks);
    renderMemos(tasks); // Memos view shows all tasks with descriptions
    renderNeeds(activeTasks);
    renderCompleted(completedTasks);
    renderCompletedBin(); // Update completed bin
    
    // Check for deadline notifications
    scheduleDeadlineCheck();
    hideLoading();
  }, (error) => {
    console.log("Error fetching tasks:", error);
    hideLoading();
  });

  // Listen for all notifications for current user
  showLoading('Loading notifications...');
  const notificationsQuery = query(
    notificationsCollection,
    where("recipient", "==", currentUser),
    orderBy("createdAt", "desc")
  );

  onSnapshot(notificationsQuery, (snapshot) => {
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

