# System Architecture
## Nexus Agency Platform

### 1. High-Level Architecture (Production)
The production system is designed around a decoupled, API-first architecture using a microservices-inspired workflow orchestration approach.

- **Frontend**: Next.js (React), Tailwind CSS, Framer Motion, Recharts. (Prototyped here in Vite/React).
- **Backend API**: Node.js / Express or Next.js API Routes.
- **Database**: PostgreSQL (Prisma ORM) for relational data (users, posts, clients).
- **Workflow / Automation Engine**: n8n instance for handling complex scheduling, retry logic, AI integration, and third-party API publishing.
- **Storage**: AWS S3 / Cloudflare R2 for media assets.
- **Cache / Queue**: Redis for fast analytics aggregation and queue state.

### 2. Frontend Component Hierarchy
- `App` (Router & Auth Provider)
  - `AppLayout`
    - `Sidebar` (Navigation, Client Switcher)
    - `Topbar` (Search, User Profile, Notifications)
    - `PageContent`
      - `Dashboard` (KPIs, Recent Activity, Alerts)
      - `Calendar` (Grid view, Draggable Items)
      - `Composer` (Editor, Platform Tabs, Device Preview)
      - `Analytics` (Recharts, Metric Cards)

### 3. Data Models (Core)
* **User**: id, email, role, agency_id
* **Client**: id, name, agency_id, logo_url
* **SocialAccount**: id, client_id, platform (IG, FB, LI, X), token_data
* **Post**: id, client_id, content, media_urls, scheduled_for, status (draft, pending_approval, scheduled, published, failed)

### 4. Automation Strategy (n8n)
n8n acts as the central nervous system for asynchronous tasks:
1. Webhook receives "Post Scheduled" event from Backend.
2. n8n workflow waits until `scheduled_for` time.
3. Split logic based on `platform` array.
4. Execute respective social media API calls.
5. On Success: Update Backend DB status to `published`.
6. On Failure: Trigger Retry Workflow -> If max retries, send Notification to Agency Slack/Email.
