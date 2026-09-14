# Setup & Deployment Guide

This guide provides instructions for setting up Legacy Gateway locally, connecting to PostgreSQL (including Supabase), running database migrations, and deploying to production.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 10.0.0 or higher
- **PostgreSQL**: A running PostgreSQL instance (Local Postgres, Postgres.app, Supabase, Neon, or Docker)

---

## 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-repo/legacy_gateway.git
cd legacy_gateway
npm install
```

---

## 3. Database Setup Options

Legacy Gateway requires a PostgreSQL database for session management, encrypted cookie storage, and transpilation caching.

### Option A: Supabase (Recommended Cloud Setup)

1. Sign up for a free account at [Supabase](https://supabase.com).
2. Create a new project.
3. Go to **Project Settings** -> **Database** -> **Connection String** -> **Connection Pooler**.
4. Select **Session** mode (Port `5432`).
5. Copy the connection string:
   ```text
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
6. Paste the connection string into your `.env` file as `DATABASE_URL`.

> **Important**: If your database password contains special characters (such as `@`, `&`, `#`), URL-encode them:
> - `@` becomes `%40`
> - `&` becomes `%26`
> - `#` becomes `%23`

### Option B: Local Postgres.app (Mac)

1. Download and install [Postgres.app](https://postgresapp.com/).
2. Open Postgres.app and click **Initialize**.
3. Create a database in your terminal:
   ```bash
   createdb legacy_gateway
   ```
4. Set your `.env` `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://localhost:5432/legacy_gateway"
   ```

### Option C: Docker Container

Run a local PostgreSQL container using Docker:

```bash
docker run --name legacy-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=legacy_gateway \
  -p 5432:5432 -d postgres:16-alpine
```

Set your `.env` `DATABASE_URL`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legacy_gateway"
```

---

## 4. Environment Variables Configuration

Create a `.env` file in the root directory:

```env
# Required: PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Required in production: Master key for AES-256-GCM cookie jar encryption
LG_SECRET="your-32-character-secret-key-here"

# Recommended: Shared access key to secure your gateway instance
LG_GATE_KEY="your-access-password"

# Optional: Hosted Chromium token for Snapshot Mode (Browserless.io)
BROWSERLESS_TOKEN="your-browserless-api-key"
```

---

## 5. Database Schema Migration

Apply database migrations to push schema definitions (`sessions`, `cookies`, `cache`):

```bash
npx drizzle-kit push
```

---

## 6. Running Locally

Start the Next.js development server:

```bash
npm run dev
```

The application will be accessible at: `http://localhost:3000`

---

## 7. Production Deployment (Vercel)

1. Push your repository to GitHub or GitLab.
2. Import the project into Vercel.
3. Configure the environment variables (`DATABASE_URL`, `LG_SECRET`, `LG_GATE_KEY`).
4. Run `npx drizzle-kit push` against your production database instance.
5. Deploy.

> **Legacy Hardware Reachability**: Physical iOS 9 devices require HTTP or custom domain configurations whose SSL root chains exist in the 2016 iOS 9 root certificate store.
