/********************************************/
/* 1) Hard-coded Login + Backend API Functions for Fetching/Saving Tasks */
/********************************************/
const API_BASE_URL = "https://sunnytseng.com/api";
let TOKEN = null;

const PASSWORD_HASH =
  "2348f998744212575d85959674f9607ab26f67708a917157472832386337c904";

// Debounce function to reduce frequent API requests
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function disableEnterListener() {
  document.removeEventListener("keydown", enterKeyListener);
}

function enableEnterListener() {
  document.addEventListener("keydown", enterKeyListener);
}

// Login and obtain Token
async function login_and_get_token() {
  const loginData = { username: "sunny", password: "open" };
  let response = await fetch(`${API_BASE_URL}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginData),
  });
  let data = await response.json();
  TOKEN = data.access;
}

// Fetch task data from backend
async function fetchTasksFromAPI() {
  if (!TOKEN) await login_and_get_token();
  let response = await fetch(`${API_BASE_URL}/get-toDoNotes/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (response.status === 401) {
    await login_and_get_token();
    response = await fetch(`${API_BASE_URL}/get-toDoNotes/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  }
  return response.json();
}

// Save frontend task/note data to backend
async function saveTasksToAPI(data) {
  if (!TOKEN) await login_and_get_token();
  let response = await fetch(`${API_BASE_URL}/save-toDoNotes/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (response.status === 401) {
    await login_and_get_token();
    response = await fetch(`${API_BASE_URL}/save-toDoNotes/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
  return response.json();
}

/********************************************/
/* 2) Frontend Interface and Event Logic (Integrated with API) */
/********************************************/
const todoContainer = document.getElementById("todo-container");
const mainTitle = document.getElementById("main-title");
const mainContent = document.getElementById("main-content");
const noteButton = document.getElementById("note");
const saveButton = document.getElementById("save-tasks");
const addTaskButton = document.getElementById("add-task");
const clearInProgressButton = document.getElementById("clear-in-progress");
let noteContainer = null;
let noteEditor = null;

const debouncedSaveTasks = debounce(saveTasks, 500);

document.addEventListener("DOMContentLoaded", async function() {
  if (sessionStorage.getItem("logged_in") === "true") {
    document.body.classList.remove("hidden-content");
    initializePage();
    return;
  }

  Swal.fire({
    title: "Login",
    input: "password",
    inputPlaceholder: "Please enter password",
    showCancelButton: false,
    confirmButtonText: "Confirm",
    confirmButtonColor: "#ff9800",
    allowOutsideClick: false,
    preConfirm: async (password) => {
      if (!password) {
        Swal.showValidationMessage("Incorrect password, please try again!");
        return false;
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hashHex !== PASSWORD_HASH) {
        Swal.showValidationMessage("Incorrect password, please try again!");
        return false;
      }
      sessionStorage.setItem("logged_in", "true");
      return true;
    },
  }).then((result) => {
    if (result.isConfirmed) {
      document.body.classList.remove("hidden-content");
      initializePage();
    }
  });

  addTaskButton.focus();
  document.addEventListener("keydown", enterKeyListener);
  document.addEventListener("keydown", tabKeyListener);

  document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "s") {
      event.preventDefault();
      saveTasks();
    }
  });
});

function initializePage() {
  saveButton.addEventListener("click", saveTasks);
  addTaskButton.addEventListener("click", addTask);
  clearInProgressButton.addEventListener("click", clearInProgress);
  noteButton.addEventListener("click", toggleNote);
  fetchTasks();
  initializeSortable();
}

function showTodoView() {
  todoContainer.style.display = "block";
  mainTitle.textContent = "To-Do List";
  if (noteContainer) noteContainer.style.display = "none";
  noteButton.textContent = "Notebook";
}

// Fetch tasks
function fetchTasks() {
  fetchTasksFromAPI()
    .then((data) => {
      if (
        data &&
        typeof data === "object" &&
        data.note_data !== undefined &&
        data.todo_data !== undefined &&
        data.in_progress_data !== undefined
      ) {
        renderTasks(data.todo_data, "todo-list");
        renderTasks(data.in_progress_data, "in-progress-list");
        updateNoteContent(data.note_data);
      } else {
        console.error("Invalid data structure:", data);
        showErrorMessage(
          "Error",
          "Received invalid data structure from server",
        );
        renderTasks([], "todo-list");
        renderTasks([], "in-progress-list");
        updateNoteContent("");
      }
    })
    .catch((error) => {
      console.error("Error fetching tasks:", error);
      showErrorMessage(
        "Error",
        "Unable to fetch tasks and notes: " + error.message,
      );
      renderTasks([], "todo-list");
      renderTasks([], "in-progress-list");
      updateNoteContent("");
    });
}

// Render tasks to specified UL
function renderTasks(tasks, listId) {
  const listElement = document.getElementById(listId);
  if (!listElement) {
    console.error(`Element with ID '${listId}' not found`);
    return;
  }
  listElement.innerHTML = "";
  tasks.forEach((taskData) => {
    if (
      taskData.goal !== undefined &&
      taskData.purpose !== undefined &&
      taskData.todo !== undefined &&
      taskData.timing !== undefined
    ) {
      const newTask = createTaskElement(
        taskData,
        listId === "in-progress-list",
      );
      listElement.appendChild(newTask);
    } else {
      console.warn("Invalid task data:", taskData);
    }
  });
}

// Create single task <li>
function createTaskElement(taskData, isInProgress) {
  const newTask = document.createElement("li");
  newTask.className =
    "list-group-item d-flex justify-content-between align-items-center";
  const taskText = `${taskData.goal} ${taskData.purpose} [ ${taskData.todo} ] ${taskData.timing}`;
  newTask.textContent = taskText;

  newTask.dataset.taskData = JSON.stringify(taskData);
  newTask.addEventListener("dblclick", () => editTask(newTask));

  const button = document.createElement("button");
  button.className = isInProgress
    ? "btn btn-sm btn-outline-danger"
    : "btn btn-sm btn-outline-success";
  button.textContent = isInProgress ? "Complete" : "In Progress";
  button.addEventListener("click", () => {
    if (isInProgress) {
      removeFromInProgress(newTask);
    } else {
      moveToInProgress(newTask);
    }
  });
  newTask.appendChild(button);

  return newTask;
}

// Move to In Progress section
function moveToInProgress(task) {
  const inProgressList = document.getElementById("in-progress-list");
  inProgressList.prepend(task);
  const button = task.querySelector("button");
  button.className = "btn btn-sm btn-outline-danger";
  button.textContent = "Complete";
  button.onclick = () => removeFromInProgress(task);
  debouncedSaveTasks();
}

// Remove from In Progress
function removeFromInProgress(task) {
  task.remove();
  debouncedSaveTasks();
}

// Trigger save
function saveTasks() {
  const todoList = document.getElementById("todo-list");
  const inProgressList = document.getElementById("in-progress-list");

  const todoTasks = Array.from(todoList.children).map((li) =>
    JSON.parse(li.dataset.taskData),
  );
  const inProgressTasks = Array.from(inProgressList.children).map((li) =>
    JSON.parse(li.dataset.taskData),
  );
  const noteText = noteEditor ? noteEditor.getValue().trim() : "";

  // --- SIMPLE AUTHENTICATION / VALIDATION ---
  // If all fields are empty, refuse access (do not send API request)
  if (
    todoTasks.length === 0 &&
    inProgressTasks.length === 0 &&
    noteText === ""
  ) {
    showErrorMessage(
      "Access Denied",
      "The current dataset is empty. The system has blocked the save request to protect existing data.",
    );
    return;
  }
  // ------------------------------------------

  const data = {
    note_data: noteText,
    todo_data: todoTasks,
    in_progress_data: inProgressTasks,
  };

  const saveBtn = document.getElementById("save-tasks");
  const originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner"></span>';

  saveTasksToAPI(data)
    .then((res) => {
      if (!res.success) {
        showErrorMessage(
          "Save Failed",
          "Unable to save: " + (res.message || "Unknown error"),
        );
      }
    })
    .catch((e) => {
      showErrorMessage("Error", "Unknown error occurred: " + e.message);
    })
    .finally(() => {
      saveBtn.innerHTML = originalHTML;
    });
}

// Add a new task (pop-up SweetAlert2 input)
function addTask() {
  disableEnterListener();

  Swal.fire({
    title: "Add Task",
    input: "text",
    inputPlaceholder: "Goal, Purpose, Task, Timing",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    confirmButtonText: "Add",
    inputValidator: (value) => {
      if (!value) {
        return "Please enter task content";
      }
      const values = value.split(",");
      if (values.length !== 4) {
        return "Please ensure four items are entered, separated by commas";
      }
    },
  }).then((result) => {
    enableEnterListener();

    if (result.value) {
      const [goal, purpose, todo, timing] = result.value.split(",");
      const taskData = {
        goal: goal.trim(),
        purpose: purpose.trim(),
        todo: todo.trim(),
        timing: timing.trim(),
      };
      const todoList = document.getElementById("todo-list");
      const newTask = createTaskElement(taskData, false);
      todoList.prepend(newTask);
      debouncedSaveTasks();
    }
  });
}

// Edit a single task
function editTask(task) {
  disableEnterListener();

  const taskData = JSON.parse(task.dataset.taskData);
  const initialValue = `${taskData.goal}, ${taskData.purpose}, ${taskData.todo}, ${taskData.timing}`;

  Swal.fire({
    title: "Edit Task",
    input: "text",
    inputPlaceholder: "Goal, Purpose, Task, Timing",
    inputValue: initialValue,
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    confirmButtonText: "Save",
    inputValidator: (value) => {
      if (!value) {
        return "Please enter task content";
      }
      const values = value.split(",");
      if (values.length !== 4) {
        return "Please ensure four items are entered, separated by commas";
      }
    },
  }).then((result) => {
    enableEnterListener();

    if (result.value) {
      const [goal, purpose, todo, timing] = result.value.split(",");
      const newTaskData = {
        goal: goal.trim(),
        purpose: purpose.trim(),
        todo: todo.trim(),
        timing: timing.trim(),
      };
      task.dataset.taskData = JSON.stringify(newTaskData);
      task.childNodes[0].textContent = `${newTaskData.goal} ${newTaskData.purpose} [ ${newTaskData.todo} ] ${newTaskData.timing}`;
      debouncedSaveTasks();
    }
  });
}

// Clear In Progress tasks
function clearInProgress() {
  Swal.fire({
    title: "Type CONFIRM to clear all In Progress tasks",
    input: "text",
    inputPlaceholder: "Enter CONFIRM",
    showCancelButton: true,
    confirmButtonText: "Clear",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    preConfirm: (value) => {
      if (value !== "CONFIRM") {
        Swal.showValidationMessage("You must type CONFIRM to proceed.");
        return false;
      }
      return true;
    },
  }).then((result) => {
    if (result.isConfirmed) {
      document.getElementById("in-progress-list").innerHTML = "";
      debouncedSaveTasks();

      Swal.fire({
        icon: "success",
        title: "Cleared",
        text: "All In Progress tasks have been removed.",
        showConfirmButton: false,
        timer: 1200,
      });
    }
  });
}

// Initialize drag-and-drop sorting
function initializeSortable() {
  if (window.matchMedia("(min-width: 768px)").matches) {
    new Sortable(document.getElementById("todo-list"), {
      group: "shared",
      animation: 150,
      ghostClass: "blue-background-class",
      onEnd: function(evt) {
        if (evt.to.id === "in-progress-list") {
          const button = evt.item.querySelector("button");
          button.className = "btn btn-sm btn-outline-danger";
          button.textContent = "Complete";
          button.onclick = () => removeFromInProgress(evt.item);
        }
        debouncedSaveTasks();
      },
    });

    new Sortable(document.getElementById("in-progress-list"), {
      group: "shared",
      animation: 150,
      ghostClass: "blue-background-class",
      onEnd: function(evt) {
        if (evt.to.id === "todo-list") {
          const button = evt.item.querySelector("button");
          button.className = "btn btn-sm btn-outline-success";
          button.textContent = "In Progress";
          button.onclick = () => moveToInProgress(evt.item);
        }
        debouncedSaveTasks();
      },
    });
  }
}

// Trigger add task pop-up on Enter key
function enterKeyListener(event) {
  if (event.isComposing) return;
  const active = document.activeElement;
  const isTyping =
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable);
  if (
    event.key === "Enter" &&
    !isTyping &&
    (!noteEditor || !noteEditor.hasFocus())
  ) {
    addTaskButton.click();
  }
}

// Switch to Notebook on Tab key
function tabKeyListener(event) {
  if (
    event.key === "Tab" &&
    (!noteEditor || (!noteEditor.hasFocus() && !isVimModeActive()))
  ) {
    event.preventDefault();
    toggleNote();
  }
}

function isVimModeActive() {
  return (
    noteEditor &&
    noteEditor.getOption("keyMap") === "vim" &&
    noteEditor.state.vim &&
    noteEditor.state.vim.insertMode
  );
}

// Toggle between List and Notebook
function toggleNote() {
  if (todoContainer.style.display !== "none") {
    document.removeEventListener("keydown", enterKeyListener);
    todoContainer.style.display = "none";
    mainTitle.textContent = "Notebook";
    if (!noteContainer) {
      createNoteContainer();
    } else {
      noteContainer.style.display = "block";
    }
    noteButton.textContent = "To-Do List";
  } else {
    document.addEventListener("keydown", enterKeyListener);
    showTodoView();
  }
  document.addEventListener("keydown", tabKeyListener);
}

// Create note container
function createNoteContainer() {
  noteContainer = document.createElement("div");
  noteContainer.id = "note-container";
  noteContainer.className = "container-fluid p-0";
  mainContent.appendChild(noteContainer);

  const header = document.createElement("h6");
  header.className = "text-center text-white mt-2";
  header.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/9/9f/Vimlogo.svg" alt="Vim Logo" style="height: 1.2em; vertical-align: middle; margin-right: 0.4em;"><span style="vertical-align: middle;">Notebook</span>`;
  noteContainer.appendChild(header);

  const showLineNumbers = window.matchMedia("(min-width: 768px)").matches;
  const editorContainer = document.createElement("div");
  editorContainer.id = "editor";
  noteContainer.appendChild(editorContainer);

  noteEditor = CodeMirror(editorContainer, {
    lineNumbers: showLineNumbers,
    theme: "monokai",
    mode: { name: "markdown", highlightFormatting: true },
    keyMap: "vim",
    styleActiveLine: true,
    foldGutter: true,
    gutters: showLineNumbers
      ? ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
      : ["CodeMirror-foldgutter"],
    lineNumberFormatter: (line) => {
      if (!noteEditor) return line;
      const cursorLine = noteEditor.getCursor().line + 1;
      return line === cursorLine
        ? String(line)
        : String(Math.abs(cursorLine - line));
    },
    extraKeys: {
      "Ctrl-Q": (cm) => cm.foldCode(cm.getCursor()),
      "Ctrl-C": (cm) => {
        const selected = cm.getSelection();
        if (selected) navigator.clipboard.writeText(selected);
      },
    },
  });

  noteEditor.on("cursorActivity", () => {
    const cursor = noteEditor.getCursor();
    noteEditor.scrollIntoView({ line: cursor.line, ch: cursor.ch }, 0);
    setTimeout(() => noteEditor.refresh(), 10);
  });

  // Vim Config
  CodeMirror.Vim.defineAction("foldCurrent", (cm) =>
    cm.foldCode(cm.getCursor()),
  );
  CodeMirror.Vim.defineAction("unfoldCurrent", (cm) =>
    cm.foldCode(cm.getCursor(), null, "unfold"),
  );
  CodeMirror.Vim.mapCommand("zc", "action", "foldCurrent", {});
  CodeMirror.Vim.mapCommand("zo", "action", "unfoldCurrent", {});
  CodeMirror.Vim.map("jk", "<Esc>", "insert");
  CodeMirror.Vim.map("L", "$", "normal");
  CodeMirror.Vim.map("H", "0", "normal");

  setTimeout(() => CodeMirror.Vim.handleKey(noteEditor, "i"), 500);
}

function updateNoteContent(noteText) {
  if (!noteContainer) createNoteContainer();
  if (noteEditor) noteEditor.setValue(noteText || "");
  noteContainer.style.display = "none";
}

function showErrorMessage(title, text) {
  Swal.fire({
    icon: "error",
    title: title,
    text: text,
    confirmButtonText: "OK",
    confirmButtonColor: "#ff9800",
  });
}
