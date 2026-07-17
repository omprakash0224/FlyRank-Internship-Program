# Week Three: Postgres & Docker Integration

This week's project takes our existing Assignment 2 (A2) Express application and upgrades it from using an ephemeral in-memory array to a real, persistent PostgreSQL database running in Docker.

## The Architecture Payoff

One of the main goals of this week was to prove that our "storage layer" was properly abstracted. To switch from an in-memory array to PostgreSQL, **only one line of code changed in our router**: the `require` statement importing the repository. 

Our service logic and external API contract (routes, JSON shapes, status codes) remained completely untouched.

## Getting Started

To run the full stack (Node.js app + PostgreSQL database), simply use Docker Compose:

```bash
# Build the images and start the containers in the background
docker compose up --build -d
```

The application will be available at `http://localhost:3000`. You can view the API documentation at `http://localhost:3000/docs`.

## Proving Persistence

A critical requirement is that data must survive a container restart. This is achieved using a Docker named volume (`pgdata` in `docker-compose.yml`). 

Here is how persistence was proven:

1. **Start the stack:**
   ```bash
   docker compose up --build -d
   ```

2. **Create a new task:**
   ```bash
   curl -X POST http://localhost:3000/tasks \
     -H "Content-Type: application/json" \
     -d '{"title":"Survive a restart"}'
   ```
   *output:* `{"id":1,"title":"Survive a restart","done":false}`

3. **Restart the containers:**
   ```bash
   docker compose restart
   ```
   *Alternatively, you can tear it down and bring it back up:*
   ```bash
   docker compose down
   docker compose up -d
   ```

4. **Verify the data is still there:**
   ```bash
   curl http://localhost:3000/tasks
   ```
   *output:* `[{"id":1,"title":"Survive a restart","done":false}]`

Because the row is still returned after the database container was recreated or restarted, we have successfully proven that our data is persistent!
