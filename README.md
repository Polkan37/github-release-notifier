# GitHub Release Notifier

The service allows users to subscribe to GitHub repositories and receive email notifications about new releases. 

### How It Works

1. User subscribes to a repository via API  
2. Service validates repo via GitHub API  
3. Subscription is created with `PENDING` status  
4. Confirmation email is sent  
5. After confirmation → status becomes `ACTIVE`  
6. Cron scanner runs periodically:
   - checks repositories for new releases
   - compares with `lastSeenTag`  
7. If a new release is found:
   - creates notification jobs  
8. Worker sends emails:
   - updates status (`SENT` / `FAILED`)
   - retries with backoff on failure 


### Tech Stack

- Node.js + TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Nodemailer (SMTP)
- node-cron
- Jest

---

## Environment Variables

Create `.env` file:

```env

DATABASE_URL=postgres://postgres:postgres@localhost:5432/releases
GITHUB_TOKEN=your_github_token

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM=no-reply@example.com
```

---
## Run
### Local Development

```bash
npm install

npx prisma generate
npx prisma migrate dev

npm run dev
```

### Docker

```bash
docker-compose up --build
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

---

## Project Structure

```text
prisma/
  schema.prisma

src/
  app.ts
  server.ts

  core/
    db/
      prisma.ts
    scheduler/
      scanner.ts

  integrations/
    github/
      github.client.ts
    mail/
      mail.client.ts

  modules/
    subscription/
      subscription.controller.ts
      subscription.routes.ts
      subscription.service.ts
      types.ts

    notification/
      notification.service.ts
      notification.worker.ts
      templates/

  helpers/

  test/
    unit/
    integration/

swagger.yaml
docker-compose.yml

```

## API

### POST `/api/subscribe`

Subscribe to a repository.

```json
{
  "email": "user@example.com",
  "repo": "owner/repo"
}
```

### GET `/api/confirm/:token`

Confirm email subscription.

### GET `/api/unsubscribe/:token`

Unsubscribe from notifications.

### GET `/api/subscriptions?email=user@example.com`

Get active subscriptions for a user.

### GET `/health`

Health check endpoint.

---

## Data Model

### Subscription
- `PENDING` — waiting for confirmation  
- `ACTIVE` — confirmed and receiving notifications  
- `UNSUBSCRIBED` — user opted out  

### Notification
- `PENDING` — waiting to be sent  
- `SENT` — successfully delivered  
- `FAILED` — failed (will retry)  

---

## Features

- Subscribe to GitHub repositories (`owner/repo`)
- Email confirmation flow (double opt-in)
- Unsubscribe via secure token
- List active subscriptions by email
- Background release scanner (cron)
- Detect new releases using `lastSeenTag`
- Queue notifications for new releases
- Email delivery with retry/backoff
- Rate-limit handling (GitHub / SMTP)
- Swagger API documentation
- Unit & integration tests (Jest)

