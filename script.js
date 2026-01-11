// -----------------------------
// Temporary in-memory storage
// Replace this later with Firebase
// -----------------------------
let tasks = [];

// -----------------------------
function addTask() {
  const title = taskTitle.value.trim();
  const notes = taskNotes.value.trim();
  const needs = taskNeeds.value
    .split("\n")
    .map(n => n.trim())
    .filter(Boolean);

  if (!title) return;

  tasks.push({
    id: Date.now(),
    title,
    notes,
    needs,
    done: false
  });

  taskTitle.value = "";
  taskNotes.value = "";
  taskNeeds.value = "";

  render();
}

// -----------------------------
function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  task.done = !task.done;
  render();
}

// -----------------------------
function toggleSection(id, section) {
  const el = document.getElementById(`${section}-${id}`);
  const isOpen = el.style.display === "block";

  el.style.display = isOpen ? "none" : "block";
  el.style.opacity = isOpen ? 0 : 1;
}

// -----------------------------
function render() {
  const container = document.getElementById("taskList");
  container.innerHTML = "";

  tasks.forEach(task => {
    const div = document.createElement("div");
    div.className = `task ${task.done ? "done" : ""}`;

    div.innerHTML = `
      <div class="task-header">
        <strong>${task.title}</strong>
        <input type="checkbox" ${task.done ? "checked" : ""} 
               onchange="toggleDone(${task.id})">
      </div>

      <div class="toggle" onclick="toggleSection(${task.id}, 'notes')">
        📄 Notes
      </div>
      <div class="notes" id="notes-${task.id}">
        ${task.notes || "<em>No notes</em>"}
      </div>

      <div class="toggle" onclick="toggleSection(${task.id}, 'needs')">
        📌 Things I need from you
      </div>
      <ul class="needs" id="needs-${task.id}">
        ${task.needs.map(n => `<li>${n}</li>`).join("")}
      </ul>
    `;

    container.appendChild(div);
  });
}

render();
