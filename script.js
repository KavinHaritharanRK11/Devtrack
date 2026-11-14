// DevTrack 2.0 — Smart Study Command Center

const STORAGE_KEY = "tasks";
const META_KEY = "devtrack_meta_v2";

let tasks = [];
let currentFilter = "all";
let currentCategory = "all";
let timerInterval = null;
let timerRemaining = 25 * 60;

const FOCUS_SECONDS = 25 * 60;

function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn("DevTrack could not read saved data:", error);
    return fallback;
  }
}

function getMeta() {
  const meta = safeRead(META_KEY, {});
  return meta && typeof meta === "object" ? meta : {};
}

let meta = getMeta();

if (!Number.isFinite(meta.xp)) meta.xp = 0;
if (!Array.isArray(meta.activityDates)) meta.activityDates = [];
if (!Number.isFinite(meta.focusSessions)) meta.focusSessions = 0;

function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch (error) {
    console.error("Could not save progress:", error);
    return false;
  }
}

function loadTasks() {
  const saved = safeRead(STORAGE_KEY, []);

  if (!Array.isArray(saved)) return [];

  return saved
    .filter(t => t && typeof t === "object" && typeof t.text === "string")
    .map((t, i) => ({
      ...t,
      id: t.id || `task-${Date.now()}-${i}-${Math.random().toString(16).slice(2, 7)}`,
      text: t.text,
      date: typeof t.date === "string" ? t.date : "",
      category: typeof t.category === "string" ? t.category.trim() : "",
      completed: t.completed === true,
      createdAt: t.createdAt || new Date().toISOString()
    }));
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    alert("DevTrack could not save your tasks. Check your browser storage.");
    return false;
  }
}

function dateKey(date = new Date()) {
  const d = new Date(date);

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function shiftDate(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function recordActivity() {
  const today = dateKey();

  if (!meta.activityDates.includes(today)) {
    meta.activityDates.push(today);
  }

  meta.activityDates = meta.activityDates.slice(-180);
  saveMeta();
}

function displayToday() {
  const now = new Date();

  document.getElementById("today").textContent =
    now.toLocaleDateString("en-IN", {
      weekday:"short",
      day:"numeric",
      month:"short",
      year:"numeric"
    });

  const hour = now.getHours();

  document.querySelector(".welcome-row h1").innerHTML =
    `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}<span class="accent">.</span>`;

  document.getElementById("greeting").textContent =
    "YOUR SMART STUDY DASHBOARD";
}

function getCategories() {
  return [...new Set(
    tasks.map(t => t.category).filter(Boolean)
  )].sort((a,b) => a.localeCompare(b));
}

function updateCategoryOptions() {
  const categories = getCategories();
  const datalist = document.getElementById("categorySuggestions");
  const select = document.getElementById("categoryFilter");

  datalist.replaceChildren();

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    datalist.appendChild(option);
  });

  const previous = currentCategory;

  select.replaceChildren();

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "All subjects";
  select.appendChild(all);

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (categories.includes(previous)) {
    select.value = previous;
  } else {
    currentCategory = "all";
    select.value = "all";
  }
}

function levelInfo(xp) {
  const level = Math.floor(Math.max(0, xp) / 100) + 1;

  return {
    level,
    into: Math.max(0, xp) % 100,
    remaining: 100 - (Math.max(0, xp) % 100)
  };
}

function renderXP() {
  const info = levelInfo(meta.xp);

  document.getElementById("totalXP").textContent = meta.xp;
  document.getElementById("sidebarLevel").textContent = info.level;
  document.getElementById("levelLabel").textContent = `Level ${info.level}`;
  document.getElementById("levelCaption").textContent = `Level ${info.level} learner`;
  document.getElementById("xpProgress").style.width = `${info.into}%`;
  document.getElementById("xpLabel").textContent =
    `${info.into} / 100 XP to next level`;
}

function completedThisWeek() {
  const cutoff = shiftDate(new Date(), -6);
  cutoff.setHours(0,0,0,0);

  return tasks.filter(t =>
    t.completed &&
    t.completedAt &&
    new Date(t.completedAt) >= cutoff
  ).length;
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;

  document.getElementById("pendingTasks").textContent = pending;
  document.getElementById("completedTasks").textContent = completed;

  const weekly = completedThisWeek();
  const weeklyPercent = total ? Math.round((weekly / total) * 100) : 0;

  document.getElementById("weeklyProgress").textContent =
    `${Math.min(100, weeklyPercent)}%`;

  document.getElementById("weeklyCaption").textContent =
    `${weekly} completed in the last 7 days`;

  document.getElementById("taskCount").textContent =
    `${total} ${total === 1 ? "task" : "tasks"}`;

  renderXP();
}

function taskPriority(a,b) {
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;

  if (a.date && b.date && a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }

  return new Date(a.createdAt) - new Date(b.createdAt);
}

function renderRecommendation() {
  const target = tasks
    .filter(t => !t.completed)
    .sort(taskPriority)[0];

  const host = document.getElementById("recommendation");
  host.replaceChildren();

  const icon = document.createElement("div");
  icon.className = "recommend-icon";
  icon.textContent = target ? "✦" : "✓";

  const body = document.createElement("div");

  const tag = document.createElement("span");
  tag.className = "recommend-tag";
  tag.textContent = target ? "RECOMMENDED NEXT" : "NICE WORK";

  const title = document.createElement("h3");
  title.textContent = target ? target.text : "You're all caught up";

  const desc = document.createElement("p");

  if (target) {
    const due = target.date
      ? (target.date < dateKey() ? "Overdue · " : "Due · ") +
        new Date(`${target.date}T00:00:00`).toLocaleDateString(
          "en-IN",
          {day:"numeric",month:"short"}
        )
      : "No deadline set";

    desc.textContent =
      `${target.category || "General"} · ${due}. Start with a small step and build momentum.`;
  } else {
    desc.textContent =
      "Add a task whenever you're ready. There's no need to do everything at once.";
  }

  body.append(tag,title,desc);
  host.append(icon,body);

  const start = document.getElementById("startRecommended");

  start.disabled = !target;
  start.textContent = target
    ? "Start a focus session →"
    : "You're up to date";

  start.dataset.taskId = target ? target.id : "";
}

function getStreak() {
  const dates = new Set(meta.activityDates);
  let count = 0;

  let cursor = new Date();
  cursor.setHours(0,0,0,0);

  if (!dates.has(dateKey(cursor))) {
    cursor = shiftDate(cursor,-1);
  }

  while (dates.has(dateKey(cursor)) && count < 365) {
    count++;
    cursor = shiftDate(cursor,-1);
  }

  return count;
}

function renderWeek() {
  const host = document.getElementById("weekDays");
  host.replaceChildren();

  const today = new Date();
  const start = shiftDate(today,-6);
  const labels = ["S","M","T","W","T","F","S"];

  for (let i=0; i<7; i++) {
    const d = shiftDate(start,i);
    const key = dateKey(d);

    const cell = document.createElement("div");
    cell.className = "day-cell";

    const label = document.createElement("span");
    label.textContent = labels[d.getDay()];

    const dot = document.createElement("div");
    dot.className = "day-dot";

    if (meta.activityDates.includes(key)) {
      dot.classList.add("active");
      dot.textContent = "✓";
    } else {
      dot.textContent = "·";
    }

    if (key === dateKey()) {
      dot.classList.add("today");
    }

    cell.append(label,dot);
    host.appendChild(cell);
  }

  const streak = getStreak();

  document.getElementById("streakCount").textContent =
    `${streak} ${streak === 1 ? "day" : "days"}`;
}

function renderAnalytics() {
  const host = document.getElementById("categoryAnalytics");
  host.replaceChildren();

  const categories = getCategories();

  if (!categories.length) {
    const p = document.createElement("p");
    p.className = "empty-analytics";
    p.textContent = "Add tasks to see your subject breakdown.";
    host.appendChild(p);
    return;
  }

  categories
    .sort((a,b) =>
      tasks.filter(t => t.category === b).length -
      tasks.filter(t => t.category === a).length
    )
    .slice(0,6)
    .forEach(category => {
      const items = tasks.filter(t => t.category === category);
      const done = items.filter(t => t.completed).length;
      const pending = items.length - done;

      const row = document.createElement("div");
      row.className = "category-row";

      const name = document.createElement("span");
      name.className = "category-name";
      name.textContent = category;

      const track = document.createElement("div");
      track.className = "category-track";

      const complete = document.createElement("div");
      complete.className = "completed-segment";
      complete.style.width = `${done/items.length*100}%`;

      const wait = document.createElement("div");
      wait.className = "pending-segment";
      wait.style.width = `${pending/items.length*100}%`;

      const count = document.createElement("span");
      count.className = "category-count";
      count.textContent = `${done}/${items.length}`;

      track.append(complete,wait);
      row.append(name,track,count);
      host.appendChild(row);
    });
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item";

  const info = document.createElement("div");
  info.className = "task-info";

  const name = document.createElement("div");
  name.className = "task-name";
  name.textContent = task.text;

  if (task.completed) {
    name.classList.add("completed");
  }

  const metaLine = document.createElement("div");
  metaLine.className = "task-meta";
  metaLine.textContent =
    `${task.category || "Uncategorized"} · ${task.date || "No deadline"}`;

  if (task.date && task.date < dateKey() && !task.completed) {
    metaLine.classList.add("overdue");
    metaLine.textContent += " · OVERDUE";
  }

  info.append(name,metaLine);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const complete = document.createElement("button");
  complete.className = "complete-btn";
  complete.textContent = task.completed ? "Undo" : "Complete";
  complete.addEventListener("click", () => toggleTask(task.id));

  const edit = document.createElement("button");
  edit.className = "edit-btn";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => editTask(task.id));

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "Delete";
  del.addEventListener("click", () => deleteTask(task.id));

  actions.append(complete,edit,del);
  li.append(info,actions);

  return li;
}

function renderTasks() {
  updateCategoryOptions();

  const list = document.getElementById("taskList");
  list.replaceChildren();

  const query = document.getElementById("searchInput")
    .value.toLowerCase().trim();

  const visible = tasks.filter(t => {
    if (currentFilter === "pending" && t.completed) return false;
    if (currentFilter === "completed" && !t.completed) return false;
    if (currentCategory !== "all" && t.category !== currentCategory) return false;

    return t.text.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query);
  });

  visible.forEach(t => list.appendChild(createTaskElement(t)));

  if (!visible.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = tasks.length
      ? "No matching tasks found."
      : "No tasks yet. Add your first task above.";

    list.appendChild(empty);
  }

  renderStats();
  renderRecommendation();
  renderWeek();
  renderAnalytics();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (!task.completed) {
    task.completed = true;
    task.completedAt = new Date().toISOString();

    if (!task.xpAwarded) {
      meta.xp += 20;
      task.xpAwarded = true;
    }

    recordActivity();
    saveMeta();
  } else {
    task.completed = false;
    delete task.completedAt;
  }

  if (saveTasks()) renderTasks();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const text = prompt("Edit task name:",task.text);
  if (text === null || !text.trim()) return;

  const category = prompt("Edit subject / category:",task.category);
  if (category === null) return;

  const date = prompt("Due date (YYYY-MM-DD), or leave blank:",task.date);
  if (date === null) return;

  task.text = text.trim().slice(0,150);
  task.category = category.trim().slice(0,50);
  task.date = date.trim();

  if (saveTasks()) renderTasks();
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);

  if (!task || !confirm(`Delete "${task.text}"?`)) return;

  const previous = tasks;
  tasks = tasks.filter(t => t.id !== id);

  if (!saveTasks()) tasks = previous;

  renderTasks();
}

function addTask(event) {
  event.preventDefault();

  const text = document.getElementById("taskInput").value.trim();
  const date = document.getElementById("taskDate").value;
  const category = document.getElementById("taskCategory").value.trim();

  if (!text || !category) {
    alert("Please enter a task name and subject / category.");
    return;
  }

  tasks.push({
    id:`task-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,
    text,
    date,
    category,
    completed:false,
    createdAt:new Date().toISOString()
  });

  if (!saveTasks()) {
    tasks.pop();
    return;
  }

  document.getElementById("taskForm").reset();
  renderTasks();
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;

      document.querySelectorAll(".filter-btn").forEach(b => {
        b.classList.toggle("active",b === button);
      });

      renderTasks();
    });
  });

  document.getElementById("categoryFilter").addEventListener("change",e => {
    currentCategory = e.target.value;
    renderTasks();
  });

  document.getElementById("searchInput").addEventListener("input",renderTasks);
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}

function renderTimer() {
  document.getElementById("timerDisplay").textContent =
    formatTime(timerRemaining);

  document.getElementById("timerProgress").style.width =
    `${((FOCUS_SECONDS-timerRemaining)/FOCUS_SECONDS)*100}%`;
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  if (timerInterval) {
    stopTimer();
    document.getElementById("timerStart").textContent = "Resume focus";
    document.getElementById("timerStatus").textContent =
      "Paused. Resume whenever you're ready.";
    return;
  }

  if (timerRemaining <= 0) {
    timerRemaining = FOCUS_SECONDS;
  }

  document.getElementById("timerStart").textContent = "Pause";
  document.getElementById("timerStatus").textContent =
    "Focus session in progress. You can pause at any time.";

  timerInterval = setInterval(() => {
    timerRemaining--;
    renderTimer();

    if (timerRemaining <= 0) {
      stopTimer();

      meta.xp += 10;
      meta.focusSessions += 1;

      recordActivity();
      saveMeta();
      renderXP();

      document.getElementById("timerStart").textContent = "Start another";
      document.getElementById("timerStatus").textContent =
        "Session complete — +10 XP. Take a comfortable break!";

      alert("Focus session complete! You earned 10 XP. Nice work.");
    }
  },1000);
}

function resetTimer() {
  stopTimer();
  timerRemaining = FOCUS_SECONDS;

  renderTimer();

  document.getElementById("timerStart").textContent = "Start focus";
  document.getElementById("timerStatus").textContent =
    "25-minute focus session · take a break afterwards";
}

function init() {
  tasks = loadTasks();

  displayToday();
  setupFilters();

  document.getElementById("taskForm")
    .addEventListener("submit",addTask);

  document.getElementById("startRecommended")
    .addEventListener("click",() => {
      document.getElementById("focus-section")
        .scrollIntoView({behavior:"smooth",block:"center"});

      if (!timerInterval) startTimer();
    });

  document.getElementById("timerStart")
    .addEventListener("click",startTimer);

  document.getElementById("timerReset")
    .addEventListener("click",resetTimer);

  renderTimer();
  renderTasks();
}

init();