# Blue Arc OS

A web-based operating system interface built with Next.js, React, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS 4
- **State:** React Context (useContext / useState)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with context providers
│   ├── page.tsx            # Home page — DesktopShell
│   ├── globals.css         # Tailwind entry point
│   └── app/[appId]/page.tsx # Dynamic per-app route
├── components/
│   ├── desktop/            # Desktop icons and area
│   ├── shell/              # DesktopShell, Sidebar, StartMenu
│   ├── topbar/             # TopBar, Clock, SystemTray
│   └── window/             # Window, WindowManager, WindowTitleBar
├── context/                # React context providers
│   ├── AppRegistryContext.tsx   # App catalog
│   └── WindowContext.tsx        # Window state management
├── data/                   # Mock data (apps, desktop icons)
├── lib/                    # Utility functions
└── types/                  # TypeScript interfaces
```

## Milestone 1 — App Shell

Status: **Complete**

The first milestone delivers a desktop-like shell with a sidebar, top bar,
window management (open / close / focus / drag), a start menu, desktop icons,
and routing scaffolding for future apps. All data is currently mock data with
no backend dependency.
