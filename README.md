# LABsistem

**LABsistem** is a responsive web application for organizing university laboratories. It brings room scheduling, reservation requests, equipment records, and issue reporting into one shared workspace for students, professors, technicians, and administrators.

**Live demo:** [Open LABsistem](https://labsistem-app.onrender.com)

This application was originally developed as a university team project. The repository preserves the shared implementation history and sprint documentation while presenting the finished system as a deployable full-stack application.

## Features

- role-based dashboards for students, professors, technicians, and administrators;
- laboratory, cabinet, equipment, and fault management;
- reservation requests, approvals, scheduling, and history;
- shared calendar with availability and status filtering;
- JWT authentication, email verification, password recovery, and notifications;
- responsive layouts, light and dark themes, and role-based demo workspaces.

## Tech Stack

- React and Vite
- ASP.NET Core Web API and Entity Framework Core
- PostgreSQL and Neon
- Docker and Nginx
- xUnit and Playwright
- GitHub Actions and Render
- Resend for transactional email

## Demo

The live application provides one-click demo access for the main user roles. Each role opens a prepared workspace with sample laboratories, equipment, reservations, and requests. Demo data is returned to its initial state periodically.

## Run Locally

Requirements: .NET 10 SDK, Node.js 20 or newer, and PostgreSQL.

```bash
git clone https://github.com/hhadzicc/labsistem.git
cd labsistem
```

Create a local PostgreSQL database named `labsistem` with the username and password `labsistem`, or override `ConnectionStrings__Default` with your own connection string.

Start the backend:

```bash
dotnet run --project Projekat/LabSistem.backend/LABsistem.Presentation/LABsistem.Presentation.csproj
```

In another terminal, start the frontend:

```bash
cd Projekat/LABsistem.Frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Database migrations and local demo users are applied automatically in the development environment.

## Tests

```bash
dotnet test Projekat/LABsistem.Tests/LABsistem.Tests.csproj
```

## Documentation

Project requirements, sprint records, architecture notes, and user documentation are available in the [project documentation](docs/README.md).
