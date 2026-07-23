# Coding Workshop - Frontend Code

## Overview

React + Material UI single-page application for the Project Management Platform.
Organized by feature rather than by file type, so everything needed to understand
or change one area of the product (Projects, Resources, Budgets, Auth) lives
together instead of being spread across parallel `pages/`, `components/` and
`services/` trees.

## Prerequisites

- React 19 - JavaScript library for building user interfaces
- React Router 7 - Client-side routing, including route-level code splitting
- Material UI - Component library and theming (light/dark mode)
- React Responsive - Breakpoint-driven responsive behavior (see `layouts/AppLayout.jsx`)
- TanStack Query - Server-state caching (used by feature pages from Milestone 7 onward)
- Vitest + React Testing Library - Component/unit tests

## Structure

```
coding-workshop-participant/
├── frontend/                # React frontend
│   ├── public/                 # Public assets
│   ├── src/                    # Source code
│   │   ├── app/                  # Root composition: App.jsx, router, ProtectedRoute, ErrorBoundary
│   │   ├── components/           # Reusable, feature-agnostic UI (EmptyState, PageHeader, RoleGuard, ToastProvider)
│   │   ├── features/             # One folder per business feature
│   │   │   ├── auth/                # AuthContext/useAuth, login/register pages, auth API client
│   │   │   ├── dashboard/           # Health dashboard page
│   │   │   ├── projects/            # Projects/deliverables/dependencies page + API client
│   │   │   ├── resources/           # Team allocation/workload page + API client
│   │   │   └── budgets/             # Budget planning/spend page + API client
│   │   ├── layouts/              # AppLayout (sidebar+topbar), AuthLayout (centered card)
│   │   ├── lib/                  # apiClient (fetch + auto token refresh), tokenStore, roles, queryClient
│   │   ├── theme/                # MUI theme + light/dark ThemeModeProvider
│   │   └── test/                 # Vitest setup
│   ├── .env.sample             # React environment variables
│   ├── eslint.config.js        # ESLint JS tool configuration
│   ├── index.html               # Landing page
│   ├── package.json            # App metadata with dependencies
│   ├── README.md               # Frontend guide (YOU ARE HERE)
│   └── vite.config.js          # Vite build tool + Vitest configuration
├── ...
```

Each feature's `api.js` is a thin wrapper around `lib/apiClient.js`, which talks to
the backend through the same `/api/{service-name}/*` convention used by both the
local dev proxy (`bin/proxy-server.js`) and CloudFront in AWS - see
`infra/cloudfront.tf`. The client attaches the stored access token automatically
and transparently refreshes it once on a 401 before giving up, so a 30-minute
access token doesn't force a re-login on every page.

## Testing

```sh
npm test          # run once (used in CI)
npm run test:watch  # watch mode during development
```

## Usage

### Local Development

To run your application locally:

```sh
./bin/start-dev.sh
```

To view your application, open the browser and navigate to `http://localhost:3000`.

### Cloud Deployment

To deploy your frontend to AWS:

```sh
./bin/deploy-frontend.sh
```

To view your application, open the browser and navigate to CloudFront URL.

## Clean Up

To remove all deployed resources (including frontend):

```sh
./bin/cleanup-environment.sh
```

**Warning**: This removes all infra resources. Cannot be undone.
