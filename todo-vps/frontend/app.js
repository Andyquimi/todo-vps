const API_URL = '/api/tasks';

const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const filterInput = document.getElementById('filter-input');
const list = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const statusMsg = document.getElementById('status-msg');

let tasks = [];

function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.style.color = isError ? '#dc2626' : '#6b7280';
  setTimeout(() => { statusMsg.textContent = ''; }, 2500);
}

async function fetchTasks(query = '') {
  try {
    const url = query ? `${API_URL}?q=${encodeURIComponent(query)}` : API_URL;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al obtener tareas');
    tasks = await res.json();
    render();
  } catch (err) {
    showStatus('No se pudo conectar con el servidor', true);
  }
}

function render() {
  list.innerHTML = '';
  emptyState.hidden = tasks.length !== 0;

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleCompleted(task.id, checkbox.checked));

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.title = 'Editar';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => editTask(task.id, task.title));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.title = 'Eliminar';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    li.append(checkbox, title, editBtn, delBtn);
    list.appendChild(li);
  });
}

async function createTask(title) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error();
    await fetchTasks(filterInput.value);
    showStatus('Tarea creada');
  } catch {
    showStatus('No se pudo crear la tarea', true);
  }
}

async function toggleCompleted(id, completed) {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error();
    await fetchTasks(filterInput.value);
  } catch {
    showStatus('No se pudo actualizar la tarea', true);
  }
}

async function editTask(id, currentTitle) {
  const newTitle = prompt('Editar tarea:', currentTitle);
  if (newTitle === null || !newTitle.trim() || newTitle === currentTitle) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) throw new Error();
    await fetchTasks(filterInput.value);
    showStatus('Tarea actualizada');
  } catch {
    showStatus('No se pudo editar la tarea', true);
  }
}

async function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    await fetchTasks(filterInput.value);
    showStatus('Tarea eliminada');
  } catch {
    showStatus('No se pudo eliminar la tarea', true);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  createTask(value);
  input.value = '';
});

// Filtro en tiempo real: pide al backend con debounce corto
let debounceTimer;
filterInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchTasks(filterInput.value), 200);
});

fetchTasks();
