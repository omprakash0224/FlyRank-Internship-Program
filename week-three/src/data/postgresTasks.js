// src/data/postgresTasks.js
// Postgres implementation of the tasks repository.
// Implements the same async interface consumed by src/routes/tasks.js.
'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Return all tasks, ordered by insertion (id ascending).
 * @returns {Promise<Array<{id,title,done}>>}
 */
async function getAll() {
  const { rows } = await pool.query('SELECT id, title, done FROM tasks ORDER BY id');
  return rows;
}

/**
 * Return a single task or undefined if not found.
 * @param {number} id
 * @returns {Promise<{id,title,done}|undefined>}
 */
async function getById(id) {
  const { rows } = await pool.query(
    'SELECT id, title, done FROM tasks WHERE id = $1',
    [id]
  );
  return rows[0]; // undefined when not found
}

/**
 * Insert a new task and return the created row.
 * @param {string} title
 * @returns {Promise<{id,title,done}>}
 */
async function create(title) {
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, FALSE) RETURNING id, title, done',
    [title]
  );
  return rows[0];
}

/**
 * Update title and/or done for an existing task.
 * Returns the updated row, or undefined if the id does not exist.
 * @param {number} id
 * @param {{title?: string, done?: boolean}} fields
 * @returns {Promise<{id,title,done}|undefined>}
 */
async function update(id, { title, done }) {
  // Build the SET clause dynamically so we only touch supplied fields.
  const setClauses = [];
  const values     = [];

  if (title !== undefined) {
    values.push(title);
    setClauses.push(`title = $${values.length}`);
  }
  if (done !== undefined) {
    values.push(done);
    setClauses.push(`done = $${values.length}`);
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${values.length}
     RETURNING id, title, done`,
    values
  );
  return rows[0]; // undefined when not found
}

/**
 * Delete a task by id.
 * Returns true if a row was deleted, false otherwise.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { getAll, getById, create, update, remove };
