# Auth Login & Protect

> The details of the assignment are also provided in the PDF file attached to this assignment.

## Goal

Build a secure API that handles user authentication (Sign Up, Log In, and Log Out) and protects specific routes. You will use Supabase Auth to manage user accounts, issue secure JSON Web Tokens (JWTs), and verify those tokens to protect "admin-only" or "user-only" API endpoints. You will test and document this flow in Swagger UI and publish your code to GitHub.

## Purpose

In previous assignments, your API was wide open; anyone who knew the URL could read, create, or delete data. In the real world, APIs must be secured. A social network only lets you edit your posts, a shop only lets logged-in users view their cart, and FlyRank only lets authenticated users view SEO audits.

This assignment introduces you to modern web security. Instead of writing cryptography or password-hashing algorithms from scratch (which is highly discouraged in production), you will use Supabase as your Identity Provider (IdP).

By the end of this assignment, you will understand how a client logs in, receives a secure pass (a token), and presents that pass to your server to access protected doors.

## The big idea in 60 seconds

Secure authentication relies on a trust triangle: the Client, your Backend Server, and the Identity Provider (Supabase).

1. **Sign Up / Log In:** The client sends credentials (email and password) directly to Supabase.
2. **The Token:** Supabase validates the credentials and returns a JWT (Access Token).
3. **The Request:** The client sends a request to your backend server, attaching the JWT inside an Authorization Header.
4. **Verification:** Your backend server decodes and verifies the JWT. If the token is valid, your server opens the protected door and sends the response.

## API Route Structure

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| POST | `/auth/signup` | Create a new user account | None |
| POST | `/auth/login` | Authenticate user and return JWT | None |
| POST | `/auth/logout` | Terminate the user session | `Authorization: Bearer <token>` |
| GET | `/protected/profile` | Read private user profile data | `Authorization: Bearer <token>` |
| GET | `/public/info` | Read public, unprotected data | None |

## Tools — pick ONE lane

Both lanes build exactly the same secure API. Pick the language you want to stick with; don't switch mid-assignment.

### JavaScript lane

- Node.js
- Next.js
- `@supabase/supabase-js`
- `swagger-ui`
- Git/GitHub

### Python lane

- Python 3.10+
- FastAPI
- `supabase` PyPI package
- Built-in Swagger UI at `/docs`
- Git/GitHub

# The task — six stages (+ one bonus)

Work stage by stage, in order. Commit to Git after every stage (for ≥6 commits).

---

# Stage 0 — Setup Supabase & Server (~45 min)

> The scene: before you can guard a castle, you need to build the guard tower.

Create a free account at Supabase and spin up a new project (name it whatever you like, e.g., `Auth-Practice`).

Find your Project URL and Anon Key in your Supabase Dashboard under **Project Settings → API**.

Initialize your project locally.

Create a `.env` file to securely store these variables:

```env
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_anon_key
PORT=3000
```

Install your dependencies (Next.js + Supabase SDK + Dotenv library).

Initialize the Supabase client in your code using those environment variables.

Make sure your server starts on the appropriate port.

### Checkpoint

Run your server. It should log:

```text
Server running and connected to Supabase
```

without throwing errors.

### Commit

`Stage 0: setup server and supabase client`

---

# Stage 1 — Open Auth: Sign Up & Log In (~1 h)

> The front gates are open. Let users register their keys.

## 1. Create `POST /auth/signup`

Expects a JSON body containing email and password.

Use the Supabase SDK's `signUp` method:

```javascript
supabase.auth.signUp()
```

### Input validation

If email or password is missing, return status `400` ("Bad Request") with a JSON error.

### On success

Return status `201` ("Created") with the user object returned by Supabase.

## 2. Create `POST /auth/login`

Use the Supabase SDK's `signInWithPassword` method:

```javascript
supabase.auth.signInWithPassword()
```

### Input validation

If fields are empty, return `400`.

If Supabase returns an auth error (e.g., wrong password), return status `401` ("Unauthorized") with:

```json
{
  "error": "Invalid login credentials"
}
```

### On success

Return status `200` ("OK") along with the Access Token (JWT) and Refresh Token provided by Supabase.

### Checkpoint

Use `curl` to register a new account, then log in with it:

```bash
curl -i -X POST http://localhost:3000/auth/signup \
-H "Content-Type: application/json" \
-d '{"email":"test@example.com", "password":"password123"}'
```

Confirm it returns `201`. Then log in and verify you receive an `"access_token"` string back.

### Commit

`Stage 1: signup and login routes working`

---

# Stage 2 — The Public & Protected Gates (~1 h)

> Creating a secure sanctuary inside your API.

## 1. Add a public endpoint

### `GET /public/info`

It requires no authentication and returns:

```json
{
  "message": "Welcome stranger! This info is public."
}
```

with status `200`.

## 2. Add a protected endpoint

### `GET /protected/profile`

To access this, the client must send their Access Token in the request headers under:

```text
Authorization: Bearer <token_here>
```

Inside this route, extract the token from the header.

If the header is missing, incorrectly formatted, or has no token, immediately return status `401` ("Unauthorized") with:

```json
{
  "error": "Access token required"
}
```

### Checkpoint

```bash
curl -i http://localhost:3000/public/info
```

Returns `200`.

```bash
curl -i http://localhost:3000/protected/profile
```

Returns `401`.

### Commit

`Stage 2: public route and unverified protected route`

---

# Stage 3 — The Guard: Token Verification (~1 h)

> The guard at the door inspects the visitor's pass.

Now you will make `GET /protected/profile` actually verify that token with Supabase.

Extract the token from the header on `GET /protected/profile`.

Call the Supabase SDK's user retrieval method:

```javascript
supabase.auth.getUser(token)
```

to verify the token's validity.

If Supabase determines the token is expired, tampered with, or invalid, return status `401` with:

```json
{
  "error": "Invalid or expired token"
}
```

If the token is verified successfully, return status `200` along with the user's secure metadata, such as ID, Email, and when the account was created.

### Checkpoint

Log in via `POST /auth/login` and copy the `"access_token"` value.

Run:

```bash
curl -i http://localhost:3000/protected/profile \
-H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN_HERE>"
```

It should return status `200` and your user details.

Changing one character of the token and running it again should return `401`.

### Commit

`Stage 3: profile route token verification`

---

# Stage 4 — Middleware Protection & Logout (~1.5 h)

> Scaling your security and leaving the premises.

## 1. Middleware Guard

Writing token-checking logic inside every single protected endpoint gets messy.

Extract your token-checking logic into a reusable **Middleware** function (Express) or **Dependency** (FastAPI).

Apply this middleware/dependency to `GET /protected/profile` so the route logic itself only runs after the middleware verifies the user.

## 2. Create `POST /auth/logout`

This is a protected route and uses your new middleware.

Call the Supabase SDK sign-out method:

```javascript
supabase.auth.signOut(token)
```

Return status `204` ("No Content") upon successful logout.

### Checkpoint

Create a second protected route, like `GET /protected/dashboard`, using your new middleware.

Confirm it automatically rejects invalid tokens and permits valid ones.

### Commit

`Stage 4: auth middleware and logout endpoint`

---

# Stage 5 — See it: Swagger UI (~1–1.5 h)

> Visualizing the secure doors.

Swagger UI needs to be told that your API has locked doors.

### Python lane

FastAPI automatically generates your Swagger UI at:

```text
http://localhost:8000/docs
```

To make the "Authorize" padlock button appear, configure FastAPI's HTTPBearer security scheme and apply it to your protected routes.

### JavaScript lane

In your `openapi.json` file, define a `securitySchemes` block of type `http` and scheme `bearer`.

Protect the `/protected/` endpoints by linking them to this security scheme.

Serve it via `swagger-ui-express` at `/docs`.

Once configured, click the **Authorize** lock button in Swagger, paste your JWT, and use **Try it out** on `/protected/profile` directly from your browser.

### Checkpoint

`/docs` shows a lock icon next to your protected routes.

You can authorize with a token and successfully test the profile endpoint.

Take a screenshot of Swagger UI showing your routes for your README.

### Commit

`Stage 5: Swagger UI documentation with bearer auth`

---

# Stage 6 — Publish to GitHub (~1 h)

> Never share your secrets.

Create a public GitHub repository.

## CRITICAL

Ensure your `.env` file is listed in your `.gitignore`.

**NEVER commit your Supabase keys or secrets to GitHub.**

Push your repository to GitHub.

Write a professional README detailing:

- What this project is.
- How to set up local environment variables.
- How to run it.
- An API reference table outlining the endpoints and whether they require auth.
- Your Swagger UI screenshot.

### Checkpoint

A peer can clone your repository, plug in their own `.env` values, and run your authenticated API in under 5 minutes.

### Commit

`Stage 6: publish to GitHub and write README`

---

# ★ Stage 7 — Bonus: The AI Rematch (Optional ~1 h)

Now that you've secured an API by hand, prompt an AI assistant to build the exact same setup.

Write a prompt from memory specifying:

- Frameworks
- Supabase auth integration
- Routes
- Status codes (`401` vs `400` vs `201`)
- Token verification via middleware
- Swagger UI

Generate the code, run it in a separate folder, and test your Stage 3 and 4 checkpoints against it.

Write an **"AI vs Me"** section in your README analyzing:

- How it handled token extraction. Did it handle the `"Bearer "` prefix parsing correctly?
- Security flaws it might have introduced. Did it safely handle invalid tokens?
- What your prompt missed and what the AI assumed.

---

# Requirements Checklist

- [ ] Server starts on localhost with a single documented terminal command.
- [ ] `.env` file is properly used and `.gitignore` prevents it from being pushed to GitHub.
- [ ] `POST /auth/signup` and `POST /auth/login` communicate successfully with Supabase Auth.
- [ ] `GET /protected/profile` extracts and verifies the bearer token from the HTTP Authorization header.
- [ ] Proper status codes used:
  - `201` on signup
  - `200` on successful login/read
  - `204` on logout
  - `400` on missing inputs
  - `401` on missing, incorrect, or expired tokens
- [ ] Auth check extracted into reusable middleware/dependencies.
- [ ] Swagger UI configured at `/docs` with Bearer Token Authorization fully functional.
- [ ] Public GitHub repo with ≥6 clean commits and a comprehensive README.

---

# Glossary

## Identity Provider (IdP)

An external service (like Supabase, Auth0, or Firebase) that manages user accounts, passwords, and security tokens so your server doesn't have to.

## JSON Web Token (JWT)

A compact, URL-safe secure string used to transfer claims (like "this is User ID 123") between two parties. It is cryptographically signed so it cannot be tampered with.

## Bearer Token

A security token given to the client. The server grants access to anyone who "bears" (presents) this token, usually in the format:

`Authorization: Bearer <token>`

## Authorization Header

A standard HTTP header used by clients to send credentials/tokens to a server.

Example:

`Authorization: Bearer eyJhbGciOi...`

## Authentication (AuthN)

The process of verifying who a user is, such as matching an email and password.

## Authorization (AuthZ)

The process of verifying what a user is allowed to do, such as checking if an authenticated user has permission to view a page.

## Middleware

A function in web frameworks that intercepts incoming requests before they reach your main route handler. It is excellent for checking if a user is logged in.

## Environment Variables

Configuration settings stored outside of your source code, typically in a `.env` file, used to keep private API credentials and database keys safe.

## Refresh Token

A special long-lived token used to obtain a new Access Token (JWT) once the current one expires, without forcing the user to log in again.

## Access Token

A short-lived token, commonly a JWT, that a client presents to a server to prove that it has an authenticated session.

## Client

A program or application that sends requests to a server or API.

## Backend Server

The server-side application that receives requests, processes business logic, verifies authentication, and sends responses.

## Credentials

Information used to prove a user's identity, commonly an email address and password.

## Cryptography

The practice of protecting information through mathematical techniques so that only authorized parties can access or verify it.

## Password Hashing

The process of converting a password into a one-way cryptographic representation before storing it, so the original password is not stored directly.

## Secure Metadata

Non-sensitive information associated with an authenticated user, such as a user ID, email address, or account creation time.

## Route

A URL pattern and HTTP method that identifies a specific operation in an API.

## Protected Route

An API route that requires successful authentication before it can be accessed.

## Public Route

An API route that can be accessed without authentication.

## API

Application Programming Interface. A defined interface through which software systems communicate.

## API Endpoint

A specific API URL that performs a particular operation or provides a particular resource.

## JSON

JavaScript Object Notation. A lightweight text format commonly used for exchanging structured data between clients and servers.

## Request Body

The data sent by a client inside an HTTP request, commonly formatted as JSON.

## HTTP Header

Metadata sent along with an HTTP request or response. Headers can contain authentication credentials, content types, and other information.

## HTTP Authorization Header

The HTTP header used to transmit authentication credentials, commonly using the Bearer Token format.

## Token Verification

The process of checking whether a token is authentic, valid, unexpired, and has not been tampered with.

## Token Expiration

The point in time after which a token is no longer valid.

## Tampered Token

A token whose contents or signature have been changed in an unauthorized way.

## Invalid Token

A token that cannot be trusted or accepted by the authentication system.

## Authentication Error

An error that occurs when authentication fails, such as when a user provides an incorrect password.

## Sign Up

The process of creating a new user account.

## Log In

The process of authenticating an existing user.

## Log Out

The process of ending a user's authenticated session.

## Access Control

The process of deciding whether an authenticated user is allowed to access a resource or perform an operation.

## Supabase Auth

The authentication service provided by Supabase for managing users, sessions, passwords, and authentication tokens.

## Supabase SDK

A software development kit that allows an application to interact with Supabase services programmatically.

## `signUp()`

A Supabase Auth SDK method used to register a new user.

## `signInWithPassword()`

A Supabase Auth SDK method used to authenticate a user using an email and password.

## `getUser(token)`

A Supabase Auth SDK method used to retrieve and verify a user using an authentication token.

## `signOut(token)`

A Supabase Auth SDK method used to sign out or terminate an authenticated session.

## Express

A popular Node.js web framework used to build APIs and web servers.

## FastAPI

A modern Python web framework used to build APIs with automatic documentation and validation features.

## Dependency

In FastAPI, a reusable component that can provide data or enforce logic before a route handler runs.

## HTTPBearer

A FastAPI security scheme used to extract Bearer Tokens from the HTTP Authorization header.

## Swagger UI

A browser-based interface that lets developers view and interactively test API endpoints documented using OpenAPI.

## OpenAPI

A standard specification for describing REST APIs, including endpoints, request parameters, responses, and security requirements.

## `openapi.json`

A JSON document describing an API according to the OpenAPI specification.

## Security Scheme

An OpenAPI definition describing how an API authenticates requests.

## Bearer Authentication

An authentication method where the client sends a token using the HTTP Authorization header.

## `swagger-ui-express`

A Node.js package used to serve Swagger UI for an Express application.

## `curl`

A command-line tool used to send HTTP requests and test APIs.

## `.env`

A configuration file commonly used to store environment variables locally.

## `.gitignore`

A Git configuration file that specifies files and folders Git should ignore and not commit.

## Git

A distributed version control system used to track changes in source code.

## GitHub

A platform for hosting Git repositories and collaborating on software projects.

## Git Repository

A project directory managed by Git that tracks source code and its history.

## Git Commit

A saved snapshot of changes in a Git repository.

## README

A documentation file that explains what a project does, how to install and run it, and how to use it.

## Local Environment

The development environment running on your own computer.

## Supabase Project URL

The unique URL used by an application to connect to a specific Supabase project.

## Anon Key

A Supabase public anonymous API key intended for use in client-side applications and protected by Supabase Row Level Security policies.

## Secret

A sensitive credential, key, or token that should not be publicly exposed.

## API Reference

Documentation describing available API endpoints, HTTP methods, request formats, authentication requirements, and responses.

## Status Code

A three-digit HTTP response code indicating the result of a request.

## `200 OK`

Indicates that a request completed successfully.

## `201 Created`

Indicates that a new resource was successfully created.

## `204 No Content`

Indicates that a request completed successfully and the response contains no body.

## `400 Bad Request`

Indicates that the client sent an invalid or malformed request.

## `401 Unauthorized`

Indicates that authentication is missing, invalid, expired, or otherwise unacceptable.

## `Authorization: Bearer <token>`

The standard HTTP Authorization header format used to send a Bearer Token to an API.

## Token Extraction

The process of reading a token from an incoming HTTP request, typically from the Authorization header.

## Bearer Prefix

The word `Bearer` placed before an access token in the Authorization header.

## Security Flaw

A weakness in software that could allow unauthorized access, data exposure, or other security problems.

## Security Analysis

The process of examining an application for vulnerabilities, weaknesses, and unsafe implementation choices.
