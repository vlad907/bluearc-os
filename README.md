# Blue Arc OS

A CRM and field-service operating system built with Next.js, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS 4
- **Database:** PostgreSQL via Prisma 7
- **State:** React Context

## Getting Started

```bash
npm install
npm run db:dev:up
cp .env.example .env
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Then open `/settings`, create a workspace, and the app will select it for the
current browser session.

Optional demo data:

```bash
npm run db:seed
```

Local database reset:

```bash
npm run db:dev:reset
```

## Project Structure

```
src/
├── app/                    # Next.js pages and API route handlers
├── components/             # Dashboard and layout components
├── context/                # Theme and workspace context providers
├── data/                   # Navigation and remaining fixture data
├── lib/                    # Utility functions
└── types/                  # TypeScript interfaces
```

## Database Notes

- Do not use SQLite or `file:./dev.db`.
- `docker-compose.yml` provides a local PostgreSQL database.
- Supabase can be used by replacing `DATABASE_URL` in `.env`.
