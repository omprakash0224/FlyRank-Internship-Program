# W3 · A1 — Connecting your CRUD to the database

Here's a Week 2 – Part 2 assignment that naturally continues from the first one. Instead of using an in-memory array, you will replace it with a real database while keeping exactly the same API. This reinforces the idea that persistence is an implementation detail behind the API, not a change to the API itself.

## 💡 New words

New words are marked in **bold** the first time they appear. Every bold word is explained in the Glossary at the bottom.

## Goal

Take the CRUD API you built in Assignment 1 and replace the in-memory task list with a real SQLite database. Your API endpoints should continue to behave exactly the same, but now your data survives when the server restarts.

## Purpose

Last assignment, your tasks disappeared every time you restarted the server. That wasn't a bug, it was the limitation of storing data in memory.

Real applications store their data in databases. Instead of keeping a list of tasks inside your code, your server will now save them in SQLite, a lightweight database stored in a single file on your computer.

The exciting part is that almost none of your API changes. Clients still send the same requests to the same endpoints. Only the storage layer changes.

This is one of the biggest ideas in backend development:

> APIs describe what your application does. Databases describe where your application stores its data.

## The big idea in 60 seconds

So far your architecture looked like this:

```text
Client -> API -> Array in memory
```

Now it becomes:

```text
Client -> API -> SQL Database
```

The client doesn't know the difference.

- GET `/tasks` still returns tasks.
- POST `/tasks` still creates tasks.
- PUT still updates.
- DELETE still deletes.

The only difference is that restarting your server no longer deletes everything.

## Tools — pick ONE lane

### 🟨 JavaScript lane

- **Database:** SQLite
- **Library:** `better-sqlite3` (recommended)
- **Database file:** `tasks.db`

### 🐍 Python lane

- **Database:** SQLite
- **Library:** SQLModel or `sqlite3`
- **Database file:** `tasks.db`

SQLite requires no installation or server.

The first time your application runs, it will automatically create the database file.

# The task — six stages

## Stage 0 — Create your database (~30 min)

Instead of creating an array of tasks, create a SQLite database called:

```text
tasks.db
```

Create a table named:

```text
tasks
```

with these columns:

| Column | Type |
|---|---|
| id | integer primary key |
| title | text |
| done | boolean |

When your application starts:

- create the table if it doesn't already exist
- insert three example tasks only if the table is empty

### Checkpoint

Restart your application several times.

The example tasks should only appear once.

### Commit

`Stage 0: create SQLite database`

---

## Stage 1 — Read from the database (~45 min)

Replace the code that reads from your in-memory array.

`GET /tasks` should now execute a SQL query that returns every task.

`GET /tasks/{id}` should return one task from the database.

Unknown ids still return:

```text
404
```

```json
{
  "error": "Task not found"
}
```

Nothing about your API should change.

### Checkpoint

`GET /tasks`

returns the database contents.

### Commit

`Stage 1: database read endpoints`

---

## Stage 2 — Create new tasks (~45 min)

`POST /tasks` should now insert a new row into the database instead of pushing into an array.

The same validation rules still apply.

### Missing title

```text
400
```

### Successful request

```text
201
```

### Checkpoint

Create several tasks.

Restart the server.

Run `GET /tasks` again.

The tasks should still exist.

This is the first time your data survives a restart.

### Commit

`Stage 2: insert into database`

---

## Stage 3 — Update and delete (~45 min)

Replace your update and delete logic with SQL.

PUT should update a row.

DELETE should remove a row.

The API behaviour should remain identical.

### Checkpoint

Create a task.

Update it.

Delete it.

Confirm every operation using `GET /tasks`.

### Commit

`Stage 3: update and delete with SQL`

---

## Stage 4 — Learn your first SQL (~45 min)

Open the database using any SQLite viewer (DB Browser for SQLite is recommended).

Run these queries manually:

### List every task

```sql
SELECT * FROM tasks;
```

### Show only completed tasks

```sql
SELECT * FROM tasks WHERE done = 1;
```

### Count all tasks

```sql
SELECT COUNT(*) FROM tasks;
```

### Mark every task as completed

```sql
UPDATE tasks SET done = 1;
```

### Delete all completed tasks

```sql
DELETE FROM tasks WHERE done = 1;
```

Notice how the API immediately reflects your database changes.

### Checkpoint

Modify the database manually and verify the changes through your API.

### Commit

`Stage 4: explored SQLite`

---

## Stage 5 — Publish your database project (~30 min)

Update your README.

Add:

- why SQLite was chosen
- where the database file is stored
- how to start the project
- a screenshot of your database viewer
- one example SQL query you executed

### Checkpoint

Someone cloning your repository can run the project and automatically create the database.

### Commit

`Stage 5: database documentation`

---

# ★ Optional extras

Choose any that sound interesting.

### Search using SQL

`GET /tasks?search=milk` using SQL's `LIKE` operator.

### Filter completed tasks

`GET /tasks?done=true` using a SQL `WHERE` clause.

### Sort alphabetically

Return tasks ordered by title.

### Return statistics

`GET /stats` using SQL's `COUNT()` instead of counting in JavaScript/Python.

### Add timestamps

Store:

- `created_at`
- `updated_at`

for every task.

---

# Requirements

Done means every box is ticked.

- The API still exposes the same CRUD endpoints as Assignment 1.
- Tasks are stored in SQLite instead of memory.
- Data survives server restarts.
- The database is automatically created if missing.
- The tasks table is automatically created if missing.
- Three example tasks are inserted only on the first run.
- CRUD operations use SQL queries.
- Unknown ids return 404.
- Invalid requests return 400.
- Public GitHub repository updated with README and database screenshot.

---

# Glossary

## CRUD

CRUD stands for **Create, Read, Update, Delete**. These are the four basic operations commonly performed on data.

## API

API stands for **Application Programming Interface**. It defines how different software components communicate with each other.

## Persistence

Persistence means data continues to exist after the application process stops or restarts.

## In-memory

In-memory data is stored temporarily in the application's RAM. It is usually lost when the application stops.

## Database

A database is a structured system used to store, organize, retrieve, and manage data.

## SQLite

SQLite is a lightweight relational database engine that stores the entire database in a single file.

## SQL

SQL stands for **Structured Query Language**. It is used to create, read, update, and delete data in relational databases.

## Database table

A database table stores related data in rows and columns.

## Primary key

A primary key is a column whose value uniquely identifies each row in a table.

## Query

A query is an instruction sent to a database to retrieve or modify data.

## SQL query

An SQL query is a command written using SQL syntax to interact with a relational database.

## Endpoint

An endpoint is a specific URL or route through which an API provides a particular operation or resource.

## Client

A client is a program or application that sends requests to a server or API.

## Server

A server is a program or system that receives requests, processes them, and sends responses.

## Storage layer

The storage layer is the part of an application responsible for saving and retrieving data.

## Database viewer

A database viewer is a tool that lets you visually inspect and interact with database files and tables.

## Validation

Validation is the process of checking whether incoming data meets the required rules before processing it.

## HTTP status code

An HTTP status code is a number returned by a server to indicate the result of an HTTP request.

## 400 Bad Request

HTTP status code 400 indicates that the request sent by the client is invalid or malformed.

## 404 Not Found

HTTP status code 404 indicates that the requested resource could not be found.

## 201 Created

HTTP status code 201 indicates that a new resource was successfully created.

## GET

The HTTP GET method is used to retrieve data from a server.

## POST

The HTTP POST method is used to create or submit new data to a server.

## PUT

The HTTP PUT method is commonly used to update an existing resource.

## DELETE

The HTTP DELETE method is used to remove a resource.

## SQL `SELECT`

`SELECT` is an SQL command used to retrieve data from a database.

## SQL `WHERE`

`WHERE` filters database records based on a specified condition.

## SQL `COUNT()`

`COUNT()` is an SQL aggregate function used to count rows or values.

## SQL `UPDATE`

`UPDATE` is an SQL command used to modify existing records.

## SQL `DELETE`

`DELETE` is an SQL command used to remove records from a database.

## SQL `LIKE`

`LIKE` is an SQL operator used for pattern matching in text values.

## `LIKE` operator

The `LIKE` operator allows you to search for text that matches a particular pattern.

## SQLite viewer

A SQLite viewer is software used to open, inspect, and query SQLite database files.

## DB Browser for SQLite

DB Browser for SQLite is a graphical tool for creating, viewing, editing, and querying SQLite databases.

## Repository

A repository is a project location used to store and manage source code and related files, commonly through Git.

## README

A README is a documentation file that explains a project, including its purpose, setup instructions, usage, and other important information.

## GitHub

GitHub is a platform for hosting Git repositories and collaborating on software projects.

## Commit

A commit is a saved snapshot of changes in a Git repository.

## SQLModel

SQLModel is a Python library that combines features of SQL databases with Python type annotations and data models.

## `sqlite3`

`sqlite3` is a Python standard-library module that allows Python programs to work with SQLite databases.

## `better-sqlite3`

`better-sqlite3` is a Node.js library that provides access to SQLite databases.

## Boolean

A Boolean value represents one of two states, usually `true` or `false`.

## Row

A row is a single record in a database table.

## Column

A column represents a specific attribute or field in a database table.

## Relational database

A relational database organizes data into tables that can be related to each other.

## SQL database

An SQL database is a database that can be managed and queried using SQL.

## `created_at`

`created_at` is commonly used as a timestamp field that records when a record was created.

## `updated_at`

`updated_at` is commonly used as a timestamp field that records when a record was last updated.

## Timestamp

A timestamp is a value that records a specific date and time.

## `tasks.db`

`tasks.db` is the SQLite database file used by this assignment to persist task data.

## `tasks`

`tasks` is the database table used to store task records.

## `id`

`id` is the identifier column used to uniquely identify each task.

## `title`

`title` is the text field containing the name or description of a task.

## `done`

`done` is the Boolean field indicating whether a task has been completed.

## `GET /tasks`

This API endpoint retrieves the collection of tasks.

## `GET /tasks/{id}`

This API endpoint retrieves a specific task using its unique ID.

## `POST /tasks`

This API endpoint creates a new task.

## `PUT /tasks/{id}`

This API endpoint updates an existing task using its unique ID.

## `DELETE /tasks/{id}`

This API endpoint deletes an existing task using its unique ID.

## `GET /tasks?search=milk`

This API request searches for tasks containing the specified search text, such as `milk`.

## `GET /tasks?done=true`

This API request filters tasks based on their completion status.

## `GET /stats`

This API endpoint returns statistics about the tasks.

## `SELECT * FROM tasks;`

This SQL query retrieves every column and every row from the `tasks` table.

## `SELECT * FROM tasks WHERE done = 1;`

This SQL query retrieves tasks whose `done` value is `1`, representing completed tasks.

## `SELECT COUNT(*) FROM tasks;`

This SQL query counts the total number of rows in the `tasks` table.

## `UPDATE tasks SET done = 1;`

This SQL query changes the `done` value of every task to `1`.

## `DELETE FROM tasks WHERE done = 1;`

This SQL query deletes every task whose `done` value is `1`.
