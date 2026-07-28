# Echoes Engine — API Endpoints

Reference for all HTTP endpoints exposed by the NestJS backend. All routes are prefixed with `/api/v1` (see `src/main.ts`).

**Default base URL:** `http://localhost:3000` (override with `PORT` env var)

---

## Overview

| Method   | Path              | Auth                 | Description                          |
| -------- | ----------------- | -------------------- | ------------------------------------ |
| `GET`    | `/health`         | No                   | Health check                         |
| `POST`   | `/auth/login`     | No                   | Authenticate and get JWT             |
| `POST`   | `/auth/logout`    | No                   | Clear auth cookie                    |
| `POST`   | `/events`         | JWT (Bearer/cookie)  | Submit a browsing event              |
| `GET`    | `/dashboard`      | JWT (Bearer/cookie)  | Dashboard stats for current user     |
| `POST`   | `/users`          | No                   | Register a new user                  |
| `GET`    | `/users`          | JWT (Bearer/cookie)  | List all users                       |
| `GET`    | `/users/me`       | JWT (Bearer/cookie)  | Get current authenticated user       |
| `GET`    | `/users/:id`      | JWT (Bearer/cookie)  | Get user by ID                       |
| `PATCH`  | `/users/:id`      | JWT (Bearer/cookie)  | Update user by ID                    |
| `DELETE` | `/users/:id`      | JWT (Bearer/cookie)  | Delete user by ID                    |

---

## Authentication

Protected endpoints accept the JWT in **either** of these ways:

**Option 1 — Bearer header** (extension / API clients):

```http
Authorization: Bearer <token>
```

**Option 2 — HttpOnly cookie** (web app with `credentials: 'include'`):

```http
Cookie: access_token=<token>
```

The cookie is set automatically by `POST /auth/login`. It is cleared by `POST /auth/logout`.

| Cookie attribute | Value                                      |
| ---------------- | ------------------------------------------ |
| Name             | `access_token`                             |
| `HttpOnly`       | `true`                                     |
| `SameSite`       | `Lax`                                      |
| `Path`           | `/`                                        |
| `Max-Age`        | `604800` (7 days, aligned with JWT expiry) |
| `Secure`         | `true` in production only                  |

JWT and cookie expiry are both **7 days**. For web clients using cookies, send `credentials: 'include'` on login, logout, and all authenticated requests. In production, set `CORS_ORIGIN` to the frontend origin (CORS is configured with `credentials: true`).

If the client stores the bearer token from the login response body, it must discard it on logout — clearing the cookie does not invalidate an already-issued bearer token.

---

## Health

### `GET /api/v1/health`

Simple liveness check.

| Parameter | Location | Required | Description |
| --------- | -------- | -------- | ----------- |
| —         | —        | —        | No parameters |

**Response:** `200` — plain text `"Hello World!"`

---

## Auth

### `POST /api/v1/auth/login`

Authenticate with email and password. Rate-limited to **5 requests per 60 seconds**.

On success, returns the JWT in the response body **and** sets an `access_token` HttpOnly cookie (see [Authentication](#authentication)).

| Parameter  | Location | Required | Type     | Constraints        | Description      |
| ---------- | -------- | -------- | -------- | ------------------ | ---------------- |
| `email`    | Body     | Yes      | `string` | Valid email format | User email       |
| `password` | Body     | Yes      | `string` | Non-empty string   | User password    |

**Response:** `201`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response headers:**

```http
Set-Cookie: access_token=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800
```

In production, the `Secure` attribute is also set.

**Errors:** `401` — `{ "error": "Invalid credentials" }`

---

### `POST /api/v1/auth/logout`

Clears the `access_token` auth cookie. Does not require authentication.

Web clients should call this with `credentials: 'include'`. Clients that store the bearer token from login should also discard it locally.

| Parameter | Location | Required | Description |
| --------- | -------- | -------- | ----------- |
| —         | —        | —        | No parameters |

**Response:** `201`

```json
{
  "ok": true
}
```

**Response headers:**

```http
Set-Cookie: access_token=; Path=/; HttpOnly; SameSite=Lax; ...
```

---

## Events

### `POST /api/v1/events`

Submit an event for the authenticated user. Supported types: `WEB_VISIT`, `APP_VISIT`.

| Parameter           | Location | Required | Type                  | Constraints                          | Description                              |
| ------------------- | -------- | -------- | --------------------- | ------------------------------------ | ---------------------------------------- |
| Authentication      | Header or Cookie | Yes | `string`        | Bearer token or `access_token` cookie | JWT from login (see [Authentication](#authentication)) |
| `type`              | Body     | Yes      | `string`              | `"WEB_VISIT"` \| `"APP_VISIT"`       | Event type                               |
| `timestamp`         | Body     | Yes      | `string`              | ISO-8601                             | When the event occurred                  |
| `source`            | Body     | Yes      | `string`              | `"browser_extension"` \| `"mobile_sdk"` | Event source identifier               |
| `metadata`          | Body     | Yes      | `object`              | Shape depends on `type` (see below)  | Event-specific payload                   |
| `id`                | Body     | No       | `string`              | UUID                                 | Optional client idempotency key          |
| `attempts`          | Body     | No       | `number`              | —                                    | Client retry count (ignored by backend)  |
| `createdAt`         | Body     | No       | `string`              | ISO-8601                             | Client queue timestamp (ignored by backend) |

#### Metadata by event type

##### `WEB_VISIT`

Typical source: `browser_extension`. Tags are derived from `metadata.url`.

| Field              | Required | Type     | Constraints | Description                    |
| ------------------ | -------- | -------- | ----------- | ------------------------------ |
| `metadata.url`     | Yes      | `string` | Non-empty   | Page URL                       |
| `metadata.title`   | Yes      | `string` | Non-empty   | Page title                     |
| `metadata.browser` | No       | `string` | —           | Browser name (e.g. `"chrome"`) |

```json
{
  "type": "WEB_VISIT",
  "timestamp": "2026-06-12T15:30:00.000Z",
  "source": "browser_extension",
  "metadata": {
    "url": "https://kafka.apache.org",
    "title": "Apache Kafka",
    "browser": "chrome"
  }
}
```

##### `APP_VISIT`

Typical source: `mobile_sdk`. Tags are derived from `metadata.appName`.

| Field                   | Required | Type     | Constraints | Description                                      |
| ----------------------- | -------- | -------- | ----------- | ------------------------------------------------ |
| `metadata.appName`      | Yes      | `string` | Non-empty   | Display name of the app (used for tag categorization) |
| `metadata.packageName`  | No       | `string` | —           | Platform package / bundle id (e.g. `com.instagram.android`) |
| `metadata.title`        | No       | `string` | —           | Optional screen or activity title                |

```json
{
  "type": "APP_VISIT",
  "timestamp": "2026-06-12T15:30:00.000Z",
  "source": "mobile_sdk",
  "metadata": {
    "appName": "Instagram",
    "packageName": "com.instagram.android",
    "title": "Feed"
  }
}
```

**Response:** `201`

```json
{
  "id": "0a2dec5a-6914-4657-9c06-03c1fd26e1f1",
  "status": "accepted"
}
```

---

## Dashboard

### `GET /api/v1/dashboard`

Aggregated stats for the authenticated user.

| Parameter       | Location | Required | Type     | Constraints | Default | Description                          |
| --------------- | -------- | -------- | -------- | ----------- | ------- | ------------------------------------ |
| Authentication  | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | — | JWT from login (see [Authentication](#authentication)) |
| `days`          | Query    | No       | `number` | Integer 7–90 | `30` | Rolling window length in days |

**Response:** `200` — `DashboardStats` object:

| Field               | Type     | Description                                      |
| ------------------- | -------- | ------------------------------------------------ |
| `timezone`          | `string` | User timezone from settings                      |
| `periodDays`        | `number` | Effective period used (matches `days` query)     |
| `summary`           | `object` | Totals, streaks, and date bounds                 |
| `eventsByDay`       | `array`  | `{ date, count }` per day in the period          |
| `categoryBreakdown` | `array`  | `{ tag, count, percentage }`                     |
| `topDomains`        | `array`  | `{ domain, count }`                              |
| `topBrowsers`       | `array`  | `{ browser, count }`                             |
| `eventsBySource`    | `array`  | `{ sourceCode, sourceName, count }`              |
| `activityByHour`    | `array`  | `{ hour, count }` (0–23)                         |

---

## Users

### `POST /api/v1/users`

Register a new user. Does not require authentication.

| Parameter  | Location | Required | Type     | Constraints              | Description      |
| ---------- | -------- | -------- | -------- | ------------------------ | ---------------- |
| `name`     | Body     | Yes      | `string` | Non-empty, max 100 chars | First name       |
| `surname`  | Body     | Yes      | `string` | Non-empty, max 100 chars | Last name        |
| `email`    | Body     | Yes      | `string` | Valid email format       | Unique email     |
| `password` | Body     | Yes      | `string` | 8–72 characters          | Plain-text password (hashed server-side) |

**Response:** `201` — user object (`password` excluded):

```json
{
  "id": "uuid",
  "name": "Jane",
  "surname": "Doe",
  "email": "jane@example.com",
  "createdAt": "2026-06-26T12:00:00.000Z",
  "updatedAt": "2026-06-26T12:00:00.000Z"
}
```

---

### `GET /api/v1/users`

List all users.

| Parameter      | Location | Required | Type     | Constraints                         | Description    |
| -------------- | -------- | -------- | -------- | ----------------------------------- | -------------- |
| Authentication | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | JWT from login |

**Response:** `200` — array of user objects (passwords excluded).

---

### `GET /api/v1/users/me`

Return the currently authenticated user. The user ID is derived from the JWT — no path parameter is required.

| Parameter      | Location | Required | Type     | Constraints                         | Description    |
| -------------- | -------- | -------- | -------- | ----------------------------------- | -------------- |
| Authentication | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | JWT from login |

**Response:** `200` — user object (password excluded):

```json
{
  "id": "uuid",
  "name": "Jane",
  "surname": "Doe",
  "email": "jane@example.com",
  "createdAt": "2026-06-26T12:00:00.000Z",
  "updatedAt": "2026-06-26T12:00:00.000Z"
}
```

**Errors:** `401` — missing or invalid authentication

---

### `GET /api/v1/users/:id`

Get a single user by ID.

| Parameter      | Location | Required | Type     | Constraints                         | Description    |
| -------------- | -------- | -------- | -------- | ----------------------------------- | -------------- |
| Authentication | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | JWT from login |
| `id`           | Path     | Yes      | `string` | UUID                                | User ID        |

**Response:** `200` — user object (password excluded).

---

### `PATCH /api/v1/users/:id`

Partially update a user. All body fields are optional; at least one should be sent.

| Parameter      | Location | Required | Type     | Constraints              | Description      |
| -------------- | -------- | -------- | -------- | ------------------------ | ---------------- |
| Authentication | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | JWT from login |
| `id`           | Path     | Yes      | `string` | UUID                     | User ID          |
| `name`          | Body     | No       | `string` | Non-empty, max 100 chars | First name       |
| `surname`       | Body     | No       | `string` | Non-empty, max 100 chars | Last name        |
| `email`         | Body     | No       | `string` | Valid email format       | Email            |
| `password`      | Body     | No       | `string` | 8–72 characters          | New password     |

**Response:** `200` — updated user object (password excluded).

---

### `DELETE /api/v1/users/:id`

Delete a user by ID.

| Parameter      | Location | Required | Type     | Constraints                         | Description    |
| -------------- | -------- | -------- | -------- | ----------------------------------- | -------------- |
| Authentication | Header or Cookie | Yes | `string` | Bearer token or `access_token` cookie | JWT from login |
| `id`           | Path     | Yes      | `string` | UUID                                | User ID        |

**Response:** `204` — no content.

---

## Validation

The API uses a global `ValidationPipe` with:

- `whitelist: true` — unknown properties are stripped
- `forbidNonWhitelisted: true` — unknown properties cause `400`
- `transform: true` — query/body values are coerced to DTO types

---

## Related docs

- [mvp-endpoints.md](./mvp-endpoints.md) — contract expected by the browser extension
- [phase-3-architecture-summary.md](./phase-3-architecture-summary.md) — architecture overview
