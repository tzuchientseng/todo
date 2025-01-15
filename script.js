// DOM elements
const todoContainer = document.getElementById('todo-container');
const mainTitle = document.getElementById('main-title');
const mainContent = document.getElementById('main-content');
const noteButton = document.getElementById('note');
const saveButton = document.getElementById('save-tasks');
const addTaskButton = document.getElementById('add-task');
const clearInProgressButton = document.getElementById('clear-in-progress');
let noteContainer = null;
let noteEditor = null;

document.addEventListener('DOMContentLoaded', function() {
    // Focus on "Add Task" button
    addTaskButton.focus();

    // Add event listener for Enter key
    document.addEventListener('keydown', enterKeyListener);

    // Add event listener for Tab key
    document.addEventListener('keydown', tabKeyListener);

    // Add event listener for Ctrl+S
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault(); // Prevent the browser's save dialog
            saveTasks();
        }
    });

    initializePage();
});

function initializePage() {
    // Event listeners
    saveButton.addEventListener('click', saveTasks);
    addTaskButton.addEventListener('click', addTask);
    clearInProgressButton.addEventListener('click', clearInProgress);
    noteButton.addEventListener('click', toggleNote);

    fetchTasks();
    initializeSortable();
}

function showTodoView() {
    todoContainer.style.display = 'block';
    mainTitle.textContent = 'To-Do List';
    if (noteContainer) noteContainer.style.display = 'none';
    noteButton.textContent = 'Notebook';
}

function fetchTasks() {
    fetch('/tasks', {
        method: 'GET'
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error('Network response was not ok: ' + response.status + ' ' + text);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.note_data !== undefined && data.todo_data !== undefined) {
            renderTasks(data.todo_data, 'todo-list');
            updateNoteContent(data.note_data);

            // Load In Progress tasks from localStorage
            const inProgressTasks = JSON.parse(localStorage.getItem('inProgressTasks')) || [];
            renderTasks(inProgressTasks, 'in-progress-list');
        } else {
            showErrorMessage('Error', 'Invalid data structure received from server');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorMessage('Error', 'Error fetching tasks and note content');
    });
}

function renderTasks(tasks, listId) {
    const listElement = document.getElementById(listId);
    if (!listElement) {
        console.error(`Cannot find element with ID '${listId}'`);
        return;
    }
    listElement.innerHTML = '';
    tasks.forEach(taskData => {
        const newTask = createTaskElement(taskData, listId === 'in-progress-list');
        listElement.appendChild(newTask);
    });
}

function createTaskElement(taskData, isInProgress) {
    const newTask = document.createElement('li');
    newTask.className = 'list-group-item d-flex justify-content-between align-items-center';

    // const taskText = `Goal: ${taskData.goal}, Purpose: ${taskData.purpose}, Todo: ${taskData.todo}, Timing: ${taskData.timing}`;
    const taskText = `${taskData.goal} ${taskData.purpose} [ ${taskData.todo} ] ${taskData.timing}`;
    newTask.textContent = taskText;

    newTask.dataset.taskData = JSON.stringify(taskData);

    newTask.addEventListener('dblclick', () => editTask(newTask));

    const button = document.createElement('button');
    button.className = isInProgress ? 'btn btn-sm btn-outline-danger' : 'btn btn-sm btn-outline-success';
    button.textContent = isInProgress ? 'Complete' : 'In Progress';
    button.addEventListener('click', () => {
        if (isInProgress) {
            removeFromInProgress(newTask);
        } else {
            moveToInProgress(newTask);
        }
    });
    newTask.appendChild(button);

    return newTask;
}

function moveToInProgress(task) {
    const inProgressList = document.getElementById('in-progress-list');
    inProgressList.prepend(task);
    const button = task.querySelector('button');
    button.className = 'btn btn-sm btn-outline-danger';
    button.textContent = 'Complete';
    button.onclick = () => removeFromInProgress(task);

    updateInProgressTasksInLocalStorage();
}

function removeFromInProgress(task) {
    task.remove();
    updateInProgressTasksInLocalStorage();
}

function updateInProgressTasksInLocalStorage() {
    const inProgressTasks = Array.from(document.getElementById('in-progress-list').children)
        .map(li => JSON.parse(li.dataset.taskData));
    localStorage.setItem('inProgressTasks', JSON.stringify(inProgressTasks));
}

function saveTasks() {
    const todoTasks = Array.from(document.getElementById('todo-list').children).map(li => JSON.parse(li.dataset.taskData));
    const inProgressTasks = Array.from(document.getElementById('in-progress-list').children).map(li => JSON.parse(li.dataset.taskData));
    localStorage.setItem('inProgressTasks', JSON.stringify(inProgressTasks));
    const noteText = noteEditor ? noteEditor.getValue() : '';
    const data = {
        note_data: noteText,
        todo_data: todoTasks
    };

    fetch('/save_tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error('Network response was not ok: ' + response.status + ' ' + text);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showSuccessMessage('Save Successful', 'Your tasks and notes have been successfully saved');
        } else {
            showErrorMessage('Save Failed', 'Unable to save tasks and notes: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorMessage('Error', 'An error occurred while saving tasks and notes');
    });
}

function addTask() {
    Swal.fire({
        title: 'Add Task',
        input: 'text',
        // inputPlaceholder: 'Enter Goal, Purpose, Todo, Timing, separated by commas',
        inputPlaceholder: 'Goal, Purpose, Todo, Timing',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Add',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter task content';
            }
            const values = value.split(',');
            if (values.length !== 4) {
                return 'Please ensure you entered four items separated by commas';
            }
        }
    }).then((result) => {
        if (result.value) {
            const [goal, purpose, todo, timing] = result.value.split(',');
            const taskData = { goal: goal.trim(), purpose: purpose.trim(), todo: todo.trim(), timing: timing.trim()};
            const todoList = document.getElementById('todo-list');
            const newTask = createTaskElement(taskData, false);
            todoList.prepend(newTask);
        }
    });
}

function editTask(task) {
    const taskData = JSON.parse(task.dataset.taskData);
    const initialValue = `${taskData.goal}, ${taskData.purpose}, ${taskData.todo}, ${taskData.timing}`;
    
    Swal.fire({
        title: 'Edit Task',
        input: 'text',
        // inputPlaceholder: 'Enter Goal, Purpose, Todo, Timing, separated by commas',
        inputPlaceholder: 'Goal, Purpose, Todo, Timing',
        inputValue: initialValue,
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Save',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter task content';
            }
            const values = value.split(',');
            if (values.length !== 4) {
                return 'Please ensure you entered four items separated by commas';
            }
        }
    }).then((result) => {
        if (result.value) {
            const [goal, purpose, todo, timing] = result.value.split(',');
            const newTaskData = { goal: goal.trim(), purpose: purpose.trim(), todo: todo.trim(), timing: timing.trim()};
            task.dataset.taskData = JSON.stringify(newTaskData);
            task.childNodes[0].textContent = `${newTaskData.goal} ${newTaskData.purpose} [ ${newTaskData.todo} ] ${newTaskData.timing}`;
        }
    });
}

function clearInProgress() {
    document.getElementById('in-progress-list').innerHTML = '';
    localStorage.removeItem('inProgressTasks');
}

function initializeSortable() {
    new Sortable(document.getElementById('todo-list'), {
        group: 'shared',
        animation: 150,
        ghostClass: 'blue-background-class',
        onEnd: function (evt) {
            if (evt.to.id === 'in-progress-list') {
                // Update button status
                const button = evt.item.querySelector('button');
                button.className = 'btn btn-sm btn-outline-danger';
                button.textContent = 'Complete';
                button.onclick = () => removeFromInProgress(evt.item);
                
                // Update task order in local storage
                updateInProgressTasksInLocalStorage();
            }
        }
    });

    new Sortable(document.getElementById('in-progress-list'), {
        group: 'shared',
        animation: 150,
        ghostClass: 'blue-background-class',
        onEnd: function (evt) {
            // Update task order in local storage
            updateInProgressTasksInLocalStorage();

            if (evt.to.id === 'todo-list') {
                // Update button status
                const button = evt.item.querySelector('button');
                button.className = 'btn btn-sm btn-outline-success';
                button.textContent = 'In Progress';
                button.onclick = () => moveToInProgress(evt.item);

                // Update task order in local storage
                updateInProgressTasksInLocalStorage();
            }
        }
    });
}

function enterKeyListener(event) {
    if (event.key === 'Enter' && (!noteEditor || !noteEditor.hasFocus())) {
        addTaskButton.click();
    }
}

function tabKeyListener(event) {
    if (event.key === 'Tab' && (!noteEditor || !noteEditor.hasFocus() && !isVimModeActive())) {
        event.preventDefault(); // Prevent default tab behavior
        toggleNote();
    }
}

function isVimModeActive() {
    return noteEditor && noteEditor.getOption('keyMap') === 'vim' && noteEditor.state.vim && noteEditor.state.vim.insertMode;
}

function toggleNote() {
    if (todoContainer.style.display !== 'none') {
        // Switch to Notebook and remove the listener for the Enter key
        document.removeEventListener('keydown', enterKeyListener);
        todoContainer.style.display = 'none';
        mainTitle.textContent = 'Notebook';
        if (!noteContainer) {
            createNoteContainer();
        } else {
            noteContainer.style.display = 'block';
        }
        noteButton.textContent = 'To-Do List';
    } else {
        // Switch back to the To-Do List and re-add the listener for the Enter key
        document.addEventListener('keydown', enterKeyListener);
        showTodoView();
    }
    // Ensure tabKeyListener is always active
    document.addEventListener('keydown', tabKeyListener);
}

function createNoteContainer() {
    noteContainer = document.createElement('div');
    noteContainer.id = 'note-container';
    noteContainer.className = 'container mt-3';
    const noteCard = document.createElement('div');
    noteCard.className = 'card flex-grow-1';
    const noteHeader = document.createElement('div');
    noteHeader.className = 'card-header bg-secondary text-white';
    noteHeader.textContent = 'Notebook';
    const noteBody = document.createElement('div');
    noteBody.className = 'card-body';
    const editorContainer = document.createElement('div');
    editorContainer.id = 'editor';
    noteBody.appendChild(editorContainer);
    noteCard.appendChild(noteHeader);
    noteCard.appendChild(noteBody);
    noteContainer.appendChild(noteCard);
    mainContent.appendChild(noteContainer);

    // Initialize CodeMirror with Vim mode and custom settings
    noteEditor = CodeMirror(editorContainer, {
        lineNumbers: true,
        theme: 'monokai',
        mode: 'markdown',
        keyMap: 'vim',
        extraKeys: {
            "Ctrl-S": function(cm) { saveTasks(); },
            "Ctrl-N": function(cm) { cm.setOption('highlightSelectionMatches', false); },
            "Ctrl-C": function(cm) { // Add Ctrl-C for copying text
                const selectedText = cm.getSelection();
                if (selectedText) {
                    navigator.clipboard.writeText(selectedText)
                        .then(() => console.log('Text successfully copied to clipboard'))
                        .catch(err => console.error('Unable to copy to clipboard:', err));
                }
            }
        }
    });

    // Custom Vim key mappings
    CodeMirror.Vim.map('jk', '<Esc>', 'insert');
    CodeMirror.Vim.map('t', 'ggvG$', 'normal');  // nnoremap t ggvG$
    CodeMirror.Vim.map('L', '$', 'normal');      // nnoremap L $
    CodeMirror.Vim.map('H', '0', 'normal');      // nnoremap H 0

    // Start in insert mode
    CodeMirror.Vim.handleKey(noteEditor, 'i');
}

function updateNoteContent(noteText) {
    if (!noteContainer) {
        createNoteContainer();
    }
    if (noteEditor) {
        noteEditor.setValue(noteText || '');
    }
    noteContainer.style.display = 'none';
}

function clearTasks() {
    document.getElementById('todo-list').innerHTML = '';
    document.getElementById('in-progress-list').innerHTML = '';
    if (noteEditor) {
        noteEditor.setValue('');
    }
}

function showSuccessMessage(title, text) {
    Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        confirmButtonText: 'OK',
        confirmButtonColor: '#ff9800'
    });
}

function showErrorMessage(title, text) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        confirmButtonText: 'OK',
        confirmButtonColor: '#ff9800'
    });
}
