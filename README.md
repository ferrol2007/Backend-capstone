# University Campus Management System

A production-structured REST API and real-time service built with Node.js, Express, MongoDB, Mongoose, bcrypt, JWT, and Socket.IO.

## Requirements and setup

- Node.js 20+
- MongoDB 6+ (local or hosted)

```powershell
npm install
Copy-Item .env.example .env
# Set MONGODB_URI and distinct, strong JWT secrets in .env
npm run seed
npm run dev
```

The API listens on `http://localhost:3000` by default. `GET /api/health` is an unauthenticated readiness endpoint. Do not commit `.env`; `.gitignore` excludes it. The seed credentials are for local evaluation only and must be replaced before any shared or deployed use.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `MONGODB_URI` | MongoDB connection string | required |
| `JWT_ACCESS_SECRET` | HS256 access-token signing secret | required |
| `JWT_REFRESH_SECRET` | Separate HS256 refresh-token signing secret | required |
| `ACCESS_TOKEN_TTL` | Access-token lifetime | `15m` |
| `REFRESH_TOKEN_TTL` | Refresh-token lifetime | `7d` |
| `CLIENT_ORIGIN` | CORS and Socket.IO allowed origin | `http://localhost:3000` |

Use long, independent random secrets outside local development. The application fails startup if either signing secret is missing.

## Architecture and response flow

`server.js` configures HTTP, Socket.IO, common middleware, API mounts, and startup. `config/db.js` owns the database connection. Each resource follows the layered flow:

`Route -> request validation/authentication/RBAC middleware -> Controller -> Mongoose Model -> MongoDB -> JSON response`

Controllers own business rules and response status; models own persistence and schema validation. `middleware/errorMiddleware.js` centralizes failures with `{ "success": false, "message": "...", "errors": [] }`. Successful responses use `{ "success": true, "data": ... }` (and may include a `message`). Request logs include method, path, status, and duration. Passwords are hashed with bcrypt (10 rounds), selected out of normal queries, and omitted from responses. Refresh JWTs are stored as SHA-256 digests in the user's `refreshToken` field and are invalidated on logout.

### Registration and access

Open registration is student-only to prevent public privilege escalation. An authenticated admin can register `admin`, `faculty`, or `student` accounts using `POST /api/auth/register`; admins can also create accounts at `POST /api/users`. This endpoint takes optional Bearer authentication. Public role requests other than `student` receive `403`.

Login returns an access token, refresh token, and safe user profile. Refresh tokens rotate only the access token; the refresh token remains valid until expiry or logout. Send access tokens as `Authorization: Bearer <accessToken>`. `protect` authenticates and attaches the current user, while `authorizeRoles` enforces roles.

## API outline

### Authentication (`/api/auth`)

- `POST /register` — public student registration; admin Bearer token enables other roles
- `POST /login` — returns `{ accessToken, refreshToken, user }`
- `POST /refresh` — accepts `{ refreshToken }`, returns a new access token
- `POST /logout` — authenticated; revokes the stored refresh-token digest

### Users (`/api/users`)

- `GET /me`, `PATCH /me` (only `name` and `department` can be edited)
- `GET /?page=1&limit=20&role=student` (admin only)
- `POST /` (admin only; creates a user)

### Courses and enrollment (`/api/courses`)

- `GET /?page=1&limit=20&search=CS101&department=Computer%20Science` and `GET /:id` — authenticated
- `POST /`, `PATCH /:id`, `DELETE /:id` — admin only
- `POST /:id/assign-faculty` — admin; body `{ "facultyId": "...", "section": "A" }`
- `POST /:id/enroll` — admin; body `{ "studentId": "...", "section": "A" }`

Course assignment associates one faculty member with the course; section values identify the sections that faculty member teaches. Enrollment section must exist on that course. A unique student/course index ensures a student cannot enroll twice in a course.

### Attendance (`/api/attendance`)

- `POST /` — faculty; accepts `{ "course": "...", "section": "A", "date": "2025-01-15", "records": [{ "student": "...", "status": "present" }] }`
- `PATCH /:id` — assigned faculty only; requires a correction `reason` and replacement `records` for students in the original session. Each correction appends an audit log entry.
- `GET /student/:studentId` — students may request only their own ID; faculty/admin may request student summaries. Results are per-course totals and percentages.

Faculty can mark or correct attendance only for courses assigned to them and sections configured for that course. Every submitted student must be enrolled in the matching section. Class dates are normalized to UTC midnight, and a unique course/section/date index prevents duplicate class sessions.

### Announcements (`/api/announcements`)

- `POST /` — admin for `university` scope; assigned faculty for `course` or `section` scopes
- `GET /` — authenticated; university announcements plus the caller's enrolled/assigned course and section announcements (admins see all)

### Reports (`/api/reports`, admin only)

- `GET /low-attendance?threshold=75` uses an Attendance aggregation with `$unwind`, `$group`, `$project`, and `$match` to calculate each student's course-level percentage and return records below the threshold (0–100).
- `GET /course-summary` joins courses with enrollments and faculty using `$lookup`, groups enrollment counts by section and course, and projects compact summaries.

## Indexes

- `User.email`: unique; `User.enrollmentNo`: unique sparse
- `Course.code`: unique; compound `{ department: 1, code: 1 }`
- `Enrollment`: unique compound `{ student: 1, course: 1 }`
- `Attendance`: unique compound `{ course: 1, section: 1, date: 1 }`

Mongoose auto-index creation is enabled in development and disabled in production. Manage index creation explicitly during production deployments.

## Events and Socket.IO

`events/campusEvents.js` uses a custom `EventEmitter` to decouple controllers/reports from audit logging and real-time broadcasts:

- `announcementCreated` writes a structured audit log and emits `newAnnouncement`
- `attendanceMarked` logs the session and emits `attendanceUpdated`
- `lowAttendanceAlert` logs low-attendance results and emits `lowAttendanceAlert` to the affected student's room

Authenticate a Socket.IO connection with `io("http://localhost:3000", { auth: { token: "<accessToken>" } })`. A valid access token is required. Connected users automatically join `university`, `role_<role>`, and `user_<userId>`. Students additionally join their enrolled `course_<courseId>` and `section_<courseId>_<section>` rooms; faculty join their assigned course/section rooms; admins join all course/section rooms.

Socket events emitted by the server are `newAnnouncement`, `attendanceUpdated`, and `lowAttendanceAlert`. Attendance updates are sent to the course, section, and affected student rooms; announcements are sent to the appropriate university/course/section room.

## Postman

Import `postman/postman_collection.json`, set `baseUrl` (default `http://localhost:3000`), then authenticate and copy access tokens into `adminToken`, `facultyToken`, and `studentToken`. Seed data provides four sample accounts and a CS101 course. The collection includes representative success, input-validation, authentication, RBAC/ownership, not-found, and duplicate-conflict requests.

## Scripts

- `npm start` — start the API
- `npm run dev` — restart automatically with Node's built-in watch mode
- `npm run seed` — idempotently populate sample records
- `npm test` — run Node's built-in test runner
