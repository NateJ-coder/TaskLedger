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

// -----------------------------
// Global state
// -----------------------------
let tasks = [];
let notifications = [];
let taskToCompleteId = null;
let taskToUpdateId = null;
const tasksCollection = collection(db, "tasks");
const notificationsCollection = collection(db, "notifications");

// -----------------------------
// Navigation
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
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
    }, { passive: true });
  });
  
  // Add passive listeners to text inputs to suppress warnings
  document.querySelectorAll('input, textarea').forEach(element => {
    element.addEventListener('wheel', (e) => {}, { passive: true });
    element.addEventListener('touchstart', (e) => {}, { passive: true });
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
}

// -----------------------------
async function addTask() {
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const notes = document.getElementById("taskNotes").value.trim();
  const needsText = document.getElementById("taskNeeds").value.trim();
  const priority = document.getElementById("taskPriority").value;
  
  // Convert needs to objects with text and priority
  const needs = needsText 
    ? needsText.split('\n').map(n => n.trim()).filter(n => n).map(text => ({
        text,
        priority: 'medium',
        createdAt: new Date()
      }))
    : [];

  const newTask = await addDoc(tasksCollection, {
    title,
    description,
    notes,
    needs,
    priority,
    done: false,
    createdAt: new Date(),
    completionNotes: "",
    updates: [],
  });

  // Create notification for new task
  await addDoc(notificationsCollection, {
    type: "task",
    taskId: newTask.id,
    message: `New task added: ${title}`,
    createdAt: new Date(),
    read: false,
  });

  closeAddTaskModal();
}

// -----------------------------
async function toggleDone(id) {
  const task = tasks.find((t) => t.id === id);
  const taskDoc = doc(db, "tasks", id);

  if (!task.done) {
    // If marking as complete, show the modal
    openCompletionModal(id);
  } else {
    // If un-checking, mark as incomplete immediately
    await updateDoc(taskDoc, { done: false, completionNotes: "" });
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

  const task = tasks.find(t => t.id === taskToCompleteId);
  const notes = document.getElementById("completionNotes").value.trim();
  const taskDoc = doc(db, "tasks", taskToCompleteId);

  await updateDoc(taskDoc, {
    done: true,
    completionNotes: notes,
  });
  
  // Create notification for completion
  await addDoc(notificationsCollection, {
    type: "completion",
    taskId: taskToCompleteId,
    message: `Task completed: ${task.title}`,
    createdAt: new Date(),
    read: false,
  });

  closeCompletionModal();
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
  await addDoc(notificationsCollection, {
    type: "update",
    taskId: taskToUpdateId,
    message: `Update posted on "${task.title}"`,
    createdAt: new Date(),
    read: false,
  });
  
  closeUpdateModal();
}

// -----------------------------
// Priority Change Functions
// -----------------------------
async function changeTaskPriority(taskId) {
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
  else return;
  
  if (selectedPriority === currentPriority) return;
  
  const taskDoc = doc(db, "tasks", taskId);
  await updateDoc(taskDoc, { priority: selectedPriority });
  
  await addDoc(notificationsCollection, {
    type: "priority_change",
    taskId: taskId,
    message: `Task priority changed: "${task.title}" is now ${priorityNames[selectedPriority]}`,
    createdAt: new Date(),
    read: false,
  });
}

async function changeNeedPriority(taskId, needIndex) {
  const task = tasks.find(t => t.id === taskId);
  const needs = task.needs || [];
  
  if (!needs[needIndex]) return;
  
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
  else return;
  
  if (selectedPriority === currentPriority) return;
  
  needs[needIndex].priority = selectedPriority;
  
  const taskDoc = doc(db, "tasks", taskId);
  await updateDoc(taskDoc, { needs });
  
  await addDoc(notificationsCollection, {
    type: "need_priority_change",
    taskId: taskId,
    message: `Need priority changed in "${task.title}" to ${priorityNames[selectedPriority]}`,
    createdAt: new Date(),
    read: false,
  });
}

// -----------------------------
// Notifications Panel
// -----------------------------
async function toggleNotificationsPanel() {
  const panel = document.getElementById("notificationsPanel");
  const isOpen = panel.classList.toggle("open");

  if (isOpen) {
    // Mark all unread notifications as read
    const allNotificationsQuery = query(notificationsCollection);
    const snapshot = await getDocs(allNotificationsQuery);
    
    const updatePromises = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.read === false) {
        updatePromises.push(
          updateDoc(doc(db, "notifications", docSnap.id), { read: true })
        );
      }
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  }
}

async function navigateToTask(taskId, notificationId) {
  // Mark notification as read
  if (notificationId) {
    const notificationDoc = doc(db, "notifications", notificationId);
    await updateDoc(notificationDoc, { read: true });
  }
  
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
// Rendering Functions
// -----------------------------
function renderTasks(tasksToRender) {
  const container = document.getElementById("taskList");
  container.innerHTML = "";
  
  // Sort tasks by priority (high > medium > low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedTasks = [...tasksToRender].sort((a, b) => {
    const priorityA = priorityOrder[a.priority || "medium"];
    const priorityB = priorityOrder[b.priority || "medium"];
    return priorityA - priorityB;
  });
  
  sortedTasks.forEach((task) => {
    const div = document.createElement("div");
    div.className = `task ${task.done ? "done" : ""}`;
    div.id = `task-${task.id}`;

    const priority = task.priority || "medium";
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    const priorityLabel = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";

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

    div.innerHTML = `
      <div class="task-header">
        <div>
          <strong>${task.title}</strong>
          <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
        </div>
        <input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone('${task.id}')">
      </div>
      <div class="task-actions">
        <button onclick="openUpdateModal('${task.id}')">+ Add Update</button>
        ${task.description ? `<button onclick="jumpTo('memo', '${task.id}')">📝 View Memo</button>` : ""}
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

function renderMemos(tasksToRender) {
  const container = document.getElementById("memoList");
  container.innerHTML = "";
  tasksToRender
    .filter(task => task.description)
    .forEach((task) => {
      const div = document.createElement("div");
      div.className = "memo";
      div.id = `memo-${task.id}`;
      div.innerHTML = `
        <div class="memo-header">
          <strong>${task.title}</strong>
          <div class="jump-link" onclick="jumpTo('task', '${task.id}')">✅ View Task</div>
        </div>
        <div class="memo-body" style="display: block;">${task.description}</div>
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
        allNeeds.push({
          ...needObj,
          taskId: task.id,
          taskTitle: task.title,
          needIndex: index
        });
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
    div.className = "needs-card";
    const priority = need.priority || 'medium';
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    const priorityLabel = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
    
    div.innerHTML = `
      <div class="need-header">
        <div class="task-link" onclick="jumpTo('task', '${need.taskId}')">From task: ${need.taskTitle}</div>
        <span class="priority-badge ${priority}">${priorityEmoji} ${priorityLabel}</span>
      </div>
      <div class="need-text">${need.text}</div>
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

  if (!docs || docs.length === 0) {
    list.innerHTML = `<p class="no-notifications">No new notifications</p>`;
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
    
    const clickHandler = taskId ? `onclick="navigateToTask('${taskId}', '${notificationId}')"` : '';
    
    return `
      <div class="notification-item ${!notification.read ? "unread" : ""}" ${clickHandler}>
        <div class="notification-title">${message}</div>
        <div class="notification-time">${timeAgo}</div>
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
// Fetch and listen for real-time updates
// -----------------------------
const q = query(tasksCollection, orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
  tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const activeTasks = tasks.filter(t => !t.done);
  const completedTasks = tasks.filter(t => t.done);

  renderTasks(activeTasks);
  renderUpdates(tasks);
  renderMemos(tasks); // Memos view shows all tasks with descriptions
  renderNeeds(activeTasks);
  renderCompleted(completedTasks);
}, (error) => {
  console.log("Error fetching tasks:", error);
});

// Listen for all notifications (we'll filter unread in the render function)
const notificationsQuery = query(
  notificationsCollection,
  orderBy("createdAt", "desc")
);

onSnapshot(notificationsQuery, (snapshot) => {
  const allNotifications = snapshot.docs;
  const unreadDocs = allNotifications.filter(doc => !doc.data().read);
  
  const badge = document.getElementById("notificationBadge");
  const count = unreadDocs.length;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }

  renderNotifications(unreadDocs);
}, (error) => {
  console.log("Error fetching notifications:", error);
});

