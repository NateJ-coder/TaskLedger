import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
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

// -----------------------------
// Global state
// -----------------------------
let tasks = [];
let taskToCompleteId = null;
let taskToUpdateId = null;
const tasksCollection = collection(db, "tasks");

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
    });
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
}

// -----------------------------
async function addTask() {
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const notes = document.getElementById("taskNotes").value.trim();
  const needsText = document.getElementById("taskNeeds").value.trim();
  const needs = needsText ? needsText.split('\n').map(n => n.trim()).filter(n => n) : [];

  await addDoc(tasksCollection, {
    title,
    description,
    notes,
    needs,
    done: false,
    createdAt: new Date(),
    completionNotes: "",
    updates: [],
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

  const notes = document.getElementById("completionNotes").value.trim();
  const taskDoc = doc(db, "tasks", taskToCompleteId);

  await updateDoc(taskDoc, {
    done: true,
    completionNotes: notes,
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
  closeUpdateModal();
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
  tasksToRender.forEach((task) => {
    const div = document.createElement("div");
    div.className = `task ${task.done ? "done" : ""}`;
    div.id = `task-${task.id}`;

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
        <strong>${task.title}</strong>
        <input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone('${task.id}')">
      </div>
      <div class="task-actions">
        <button onclick="openUpdateModal('${task.id}')">+ Add Update</button>
        ${task.description ? `<button onclick="jumpTo('memo', '${task.id}')">📝 View Memo</button>` : ""}
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
  tasksToRender
    .filter(task => {
      if (task.done) return false;
      const needs = Array.isArray(task.needs) ? task.needs : (task.needs ? [task.needs] : []);
      return needs.length > 0;
    })
    .forEach((task) => {
      const div = document.createElement("div");
      div.className = "needs-card";
      const needs = Array.isArray(task.needs) ? task.needs : (task.needs ? [task.needs] : []);
      div.innerHTML = `
        <div class="task-link" onclick="jumpTo('task', '${task.id}')">From task: ${task.title}</div>
        <ul>${needs.map((n) => `<li>${n}</li>`).join("")}</ul>
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
});

