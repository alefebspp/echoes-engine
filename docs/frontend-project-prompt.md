# Echoes Engine Front-End Project Prompt

Use this document as the prompt for creating a new front-end application for Echoes Engine.

---

## Prompt

You are building the front-end for **Echoes Engine**, a backend platform that acts as a personal digital memory system. The backend continuously collects, organizes, and analyzes a user's digital activities, starting with browser visit events and evolving toward semantic search, embeddings, knowledge graphs, behavioral analytics, and personalized insights.

Create a polished MVP web application that helps a user answer one question:

> "What has my digital life been doing lately?"

The app should connect to the existing NestJS API documented below and expose authentication, registration, dashboard analytics, profile/user management, and a small event-ingestion test panel.

---

## Product Direction

### Subject

Echoes Engine is a **personal memory observatory** for digital activity.

### Audience

Build for technical early adopters, quantified-self users, and developers who want to inspect how their browsing and digital habits accumulate into patterns over time.

### Single Job

The front-end should make raw captured activity feel legible: events become timelines, rhythms, categories, domains, and signals the user can act on.

### Product Tone

Use precise, calm, observatory-like language. Avoid vague SaaS claims.

Good examples:

- "Review activity"
- "Inspect recent signals"
- "Captured today"
- "Most visited domains"
- "Activity by hour"
- "Send test event"

Avoid:

- "Unlock your potential"
- "Supercharge productivity"
- "AI-powered everything"
- "Submit"

---

## Recommended Stack

Use a modern React stack:

- **Framework:** React + TypeScript + Vite
- **Routing:** React Router
- **Server state:** TanStack Query
- **Forms:** React Hook Form
- **Validation:** Zod
- **Charts:** Recharts, Tremor, Nivo, or a lightweight custom SVG approach
- **Styling:** Tailwind CSS or CSS Modules
- **Testing:** Vitest + React Testing Library
- **E2E:** Playwright if the project scope includes browser-level tests

Keep the front-end independent from the backend repository. Configure the API base URL with an environment variable:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

---

## API Contract

All backend routes are prefixed with:

```txt
/api/v1
```

Default local backend URL:

```txt
http://localhost:3000
```

The front-end should call:

```txt
http://localhost:3000/api/v1
```

### Authentication

Protected routes require:

```http
Authorization: Bearer <token>
```

The token is returned by `POST /auth/login`. Store it client-side for the MVP. Prefer an auth store abstraction so the storage mechanism can change later.

### Endpoints

| Method | Path | Auth | Front-End Usage |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Optional API status indicator |
| `POST` | `/auth/login` | No | Login screen |
| `POST` | `/users` | No | Registration screen |
| `GET` | `/dashboard?days=30` | Bearer JWT | Main dashboard |
| `POST` | `/events` | Bearer JWT | Test event ingestion panel |
| `GET` | `/users` | Bearer JWT | User management screen |
| `GET` | `/users/:id` | Bearer JWT | Profile/details screen |
| `PATCH` | `/users/:id` | Bearer JWT | Edit profile/user |
| `DELETE` | `/users/:id` | Bearer JWT | Delete user |

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Success response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Register User

```http
POST /api/v1/users
Content-Type: application/json
```

```json
{
  "name": "Jane",
  "surname": "Doe",
  "email": "jane@example.com",
  "password": "strong-password"
}
```

Constraints:

- `name`: required, non-empty, max 100 characters
- `surname`: required, non-empty, max 100 characters
- `email`: required, valid email, unique
- `password`: required, 8-72 characters

### Dashboard

```http
GET /api/v1/dashboard?days=30
Authorization: Bearer <token>
```

The `days` query is optional and must be an integer from `7` to `90`. Default is `30`.

Expected response shape:

```ts
type DashboardStats = {
  timezone: string;
  periodDays: number;
  summary: Record<string, unknown>;
  eventsByDay: Array<{ date: string; count: number }>;
  categoryBreakdown: Array<{ tag: string; count: number; percentage: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  topBrowsers: Array<{ browser: string; count: number }>;
  eventsBySource: Array<{ sourceCode: string; sourceName: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
};
```

Render this as the main authenticated experience.

### Submit Test Event

```http
POST /api/v1/events
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-26T12:00:00.000Z",
  "source": "browser_extension",
  "metadata": {
    "url": "https://example.com",
    "title": "Example Domain",
    "browser": "chrome"
  }
}
```

Success response:

```json
{
  "id": "0a2dec5a-6914-4657-9c06-03c1fd26e1f1",
  "status": "accepted"
}
```

Use this as a developer-friendly panel called **Send test event**, not as the primary product flow.

### Users

User objects exclude passwords:

```ts
type User = {
  id: string;
  name: string;
  surname: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};
```

For the MVP, treat the protected user list and delete actions as an internal management area because the backend does not yet expose roles or permissions.

---

## Application Structure

Create these primary screens:

### Public Screens

- **Landing:** Explain Echoes Engine as a digital memory observatory and offer clear actions to sign in or create an account.
- **Register:** Create a user with name, surname, email, and password.
- **Login:** Authenticate and store the JWT.

### Authenticated Screens

- **Dashboard:** Main analytics surface using `GET /dashboard`.
- **Timeline Preview:** A dashboard section that visualizes `eventsByDay` as a temporal rhythm, even if the backend does not yet expose individual events.
- **Domains:** Highlight `topDomains` and category concentration.
- **Activity Rhythm:** Show `activityByHour` as a 24-hour map.
- **Sources:** Show `eventsBySource` and `topBrowsers`.
- **Send Test Event:** Small authenticated utility panel for sending a `WEB_VISIT` event.
- **Profile:** Show and edit the current user's name, surname, email, and optionally password.
- **Users:** Protected internal list of users with detail and delete actions.

### Routing

Suggested route map:

```txt
/                       landing
/login                  login
/register               register
/app                    authenticated shell
/app/dashboard          dashboard overview
/app/activity           activity rhythm and domains
/app/events/test        send test event
/app/profile            profile editor
/app/users              internal user list
/app/users/:id          internal user details
```

Unauthenticated users who visit `/app/*` should be redirected to `/login`.

Authenticated users who visit `/login` or `/register` should be redirected to `/app/dashboard`.

---

## Front-End Source Tree

Use a feature-oriented structure:

```txt
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  shared/
    api/
      httpClient.ts
      apiErrors.ts
    auth/
      authStore.ts
      RequireAuth.tsx
    components/
      Button.tsx
      Card.tsx
      EmptyState.tsx
      FieldError.tsx
      Input.tsx
      PageHeader.tsx
      StatCard.tsx
    config/
      env.ts
    utils/
      formatDate.ts
      formatNumber.ts
  features/
    auth/
      api.ts
      LoginPage.tsx
      RegisterPage.tsx
      schemas.ts
    dashboard/
      api.ts
      DashboardPage.tsx
      DashboardPeriodSelect.tsx
      EventsByDayChart.tsx
      ActivityByHourChart.tsx
      CategoryBreakdown.tsx
      TopDomains.tsx
      SourcesPanel.tsx
      types.ts
    events/
      api.ts
      SendTestEventPage.tsx
      schemas.ts
    users/
      api.ts
      ProfilePage.tsx
      UsersPage.tsx
      UserDetailsPage.tsx
      schemas.ts
      types.ts
  styles/
    tokens.css
    globals.css
```

Keep API functions close to each feature. Put only cross-cutting HTTP behavior in `shared/api`.

---

## State And Data Rules

- Keep the JWT in one auth abstraction. Do not scatter `localStorage` calls across components.
- Attach `Authorization` automatically in the HTTP client when a token exists.
- On `401`, clear the token and redirect the user to `/login`.
- Use TanStack Query for dashboard and user data.
- Invalidate dashboard queries after sending a test event.
- Keep form state local to each form.
- Represent loading, empty, error, and success states explicitly.
- Do not assume `summary` fields beyond what the backend guarantees unless the implementation confirms the exact shape.

---

## Validation And Error Handling

The backend uses strict validation:

- Unknown properties are rejected.
- Request values are transformed when possible.
- Invalid DTOs return `400`.

Front-end forms should validate before sending:

- Login: valid email, non-empty password
- Register: required name/surname, valid email, password length 8-72
- Dashboard period: only 7, 14, 30, 60, or 90 days
- Test event: valid URL, non-empty title, optional browser
- User update: at least one changed field

Error copy should be direct:

- "Use a valid email address."
- "Password must be at least 8 characters."
- "The API rejected this event. Check the URL and title."
- "Your session expired. Sign in again."

---

## Visual Design Direction

Design the UI as a **memory observatory**, not a generic admin dashboard.

### Design Thesis

The hero and dashboard should feel like looking into a quiet instrument panel that records traces over time. The signature visual element should be a **signal ribbon**: a horizontal temporal band that turns daily activity into pulses, gaps, and density changes.

Use the signal ribbon in:

- The landing hero as a product metaphor
- The dashboard header as the selected period overview
- Empty states as a quiet baseline waiting for captured activity

### Palette

Use these tokens or close equivalents:

| Token | Hex | Purpose |
| --- | --- | --- |
| `midnight-ink` | `#171A2F` | Primary app background |
| `deep-violet` | `#2E255F` | Panels and depth |
| `memory-blue` | `#7BA7FF` | Primary interactive accent |
| `signal-cyan` | `#73FBD3` | Data highlights and focus rings |
| `soft-lilac` | `#D8D7FF` | Primary text on dark surfaces |
| `trace-amber` | `#F6C177` | Warnings and special event markers |

The risk: use dark violet and blue as the base instead of the common black/green terminal aesthetic. Let the data feel nocturnal and reflective, like an observatory log.

### Typography

Use type deliberately:

- **Display:** Space Grotesk, Sora, or Instrument Sans for confident headings.
- **Body:** Inter, Source Sans 3, or IBM Plex Sans for readable interface text.
- **Data/Utility:** IBM Plex Mono or JetBrains Mono for timestamps, IDs, endpoint labels, and small metrics.

Avoid oversized generic SaaS headings. Prefer compact, precise headlines:

- "Your digital day, resolved into signals"
- "Recent memory trace"
- "Where attention collected"

### Layout

Use a composed dashboard layout:

```txt
┌─────────────────────────────────────────────────────────────┐
│ Sidebar       │ Header: period, timezone, API status         │
│               ├─────────────────────────────────────────────┤
│ Dashboard     │ Signal ribbon across selected period         │
│ Activity      ├───────────────┬───────────────┬─────────────┤
│ Test Event    │ Summary cards │ Top domains   │ Categories  │
│ Profile       ├───────────────┴───────────────┬─────────────┤
│ Users         │ Events by day chart            │ Hour map    │
└─────────────────────────────────────────────────────────────┘
```

On mobile, collapse the sidebar into a top navigation and stack cards in priority order:

1. Period selector
2. Signal ribbon
3. Summary
4. Events by day
5. Top domains
6. Activity by hour
7. Sources and browsers

### Motion

Use motion sparingly:

- Animate the signal ribbon once on page load.
- Use short hover transitions for chart points and cards.
- Respect `prefers-reduced-motion`.
- Do not animate every card independently.

---

## UX Requirements

### Landing

The landing page should communicate:

- Echoes Engine captures digital activity.
- The backend currently supports browser visit events.
- The dashboard turns activity into trends, domains, categories, sources, and hourly rhythms.
- The product is an evolving learning project with future semantic search and knowledge graph ambitions.

Primary CTA: **Create account**

Secondary CTA: **Sign in**

### Dashboard

The dashboard must include:

- Period selector: 7, 14, 30, 60, 90 days
- Timezone display
- Summary cards based on available `summary` keys
- Events by day chart
- Category breakdown
- Top domains
- Top browsers
- Events by source
- Activity by hour chart
- Empty states for all chart sections
- Retry action on failed dashboard load

### Send Test Event

Include fields:

- URL
- Page title
- Browser, optional
- Timestamp, default to now

On success, show:

> "Event accepted. Dashboard data will refresh shortly."

Then invalidate or refetch dashboard data.

### Profile And Users

Profile editing should support name, surname, email, and password changes through `PATCH /users/:id`.

Because the API does not yet expose a "current user" endpoint, choose one of these approaches:

- If the JWT contains a user ID, decode it only for convenience and fetch `/users/:id`.
- If the JWT does not contain a usable ID, show profile as a future integration gap and keep user management behind `/app/users`.

Document this decision in the front-end README.

---

## Accessibility Requirements

- Every form field must have a visible label.
- Keyboard focus must be clearly visible with `signal-cyan`.
- Charts must include text summaries or accessible labels.
- Buttons must have loading and disabled states.
- Errors must be announced near the relevant field.
- Use semantic landmarks: `header`, `main`, `nav`, `section`.
- Respect `prefers-reduced-motion`.
- Maintain readable contrast on all dark surfaces.

---

## Testing Plan

Add focused tests for:

- Auth token storage and `Authorization` header behavior
- Redirects for protected routes
- Login form validation
- Register form validation
- Dashboard loading, error, empty, and success states
- Dashboard period query changes
- Test event submission and dashboard invalidation
- User update form validation

If adding Playwright:

- Register or log in
- Reach dashboard
- Change dashboard period
- Send a test event
- Verify dashboard refetch or success message

---

## Deliverables

The completed front-end project should include:

- A documented setup flow
- Environment variable example
- Typed API client
- Authenticated routing
- Public login/register flow
- Main dashboard using real backend data
- Event ingestion test panel
- Profile/user management screens
- Responsive layout
- Accessible components
- Loading, empty, and error states
- Unit tests for core behavior

---

## Implementation Notes

- Keep the first version honest about the backend's current capabilities.
- Do not invent AI search, graph views, or recommendation screens until matching endpoints exist.
- It is fine to visually hint at future semantic memory, but future features should be labeled as roadmap content, not active UI.
- Prefer clear product copy over marketing language.
- Keep the design distinctive through the signal ribbon, dark-violet observatory palette, and data-focused typography.
