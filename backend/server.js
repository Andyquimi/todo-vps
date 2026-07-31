const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://34.170.224.30'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Sirve el frontend estático (SPA) desde la misma app Node
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Healthcheck (útil para el pipeline y para monitoreo) ---
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// --- LISTAR (con filtro opcional ?q=texto) ---
app.get('/api/tasks', async (req, res) => {
  try {
    const { q } = req.query;
    let result;
    if (q && q.trim() !== '') {
      result = await pool.query(
        'SELECT * FROM tasks WHERE title ILIKE $1 ORDER BY created_at DESC',
        [`%${q}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
});

// --- INSERTAR ---
app.post('/api/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ error: 'El título no puede superar los 200 caracteres' });
    }
    const result = await pool.query(
      'INSERT INTO tasks (title, completed) VALUES ($1, false) RETURNING *',
      [title.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

// --- ACTUALIZAR (título y/o estado completado) ---
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    if (title !== undefined && title.trim().length > 200) {
      return res.status(400).json({ error: 'El título no puede superar los 200 caracteres' });
    }

    const current = existing.rows[0];
    const newTitle = title !== undefined ? title : current.title;
    const newCompleted = completed !== undefined ? completed : current.completed;

    const result = await pool.query(
      'UPDATE tasks SET title = $1, completed = $2 WHERE id = $3 RETURNING *',
      [newTitle, newCompleted, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la tarea' });
  }
});

// --- ELIMINAR ---
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    res.json({ message: 'Tarea eliminada', task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

app.listen(PORT, () => {
  console.log(`API de tareas corriendo en el puerto ${PORT}`);
});
