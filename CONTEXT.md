# CONTEXT.md — Kanban Project

> Этот файл читается перед каждым промптом. Не повторяй его содержимое в промптах — просто ссылайся: "см. CONTEXT.md".

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, dnd-kit, Zustand, Socket.io-client, Axios |
| Backend | NestJS, TypeScript, Prisma ORM, Socket.io |
| DB | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Auth | JWT (jsonwebtoken, без Passport), bcrypt, Magic Link |
| Telegram | grammy |
| Infra | Docker, Nginx, Certbot (Let's Encrypt) |

---

## Repo structure

```
kanban/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/configuration.ts
│   │   ├── prisma/prisma.service.ts
│   │   ├── redis/redis.service.ts
│   │   ├── common/
│   │   │   ├── guards/jwt-auth.guard.ts
│   │   │   ├── guards/board-role.guard.ts
│   │   │   ├── decorators/current-user.decorator.ts
│   │   │   ├── decorators/board-role.decorator.ts
│   │   │   └── filters/http-exception.filter.ts
│   │   ├── auth/
│   │   ├── users/
│   │   ├── boards/         ← contains boards.gateway.ts
│   │   ├── columns/
│   │   ├── cards/
│   │   ├── fields/
│   │   ├── comments/
│   │   ├── invites/
│   │   ├── notifications/
│   │   └── telegram/
│   ├── test/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── auth/page.tsx
│   │   │   ├── auth/magic/page.tsx
│   │   │   └── boards/
│   │   │       ├── page.tsx
│   │   │       └── [boardId]/
│   │   │           ├── page.tsx
│   │   │           └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── board/
│   │   │   ├── card/
│   │   │   ├── settings/
│   │   │   └── ui/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   └── Dockerfile
├── nginx/iinstasave.uz.conf
├── docker-compose.yml
├── docker-compose.dev.yml
└── CONTEXT.md
```

---

## Environment variables

### backend/.env
```
DATABASE_URL=postgresql://kanban:password@postgres:5432/kanban
REDIS_URL=redis://redis:6379
JWT_SECRET=
JWT_EXPIRES_IN=7d
MAGIC_LINK_TTL=600
TELEGRAM_BOT_TOKEN=
FRONTEND_URL=https://iinstasave.uz
PORT=4000
```

### frontend/.env
```
NEXT_PUBLIC_API_URL=https://iinstasave.uz/api
NEXT_PUBLIC_SOCKET_URL=https://iinstasave.uz
```

---

## DB models (краткая схема)

```
User              — id, telegramId?, email?, passwordHash?, name, avatarUrl?
NotificationSettings — userId(unique), onAssigned, onDeadline, onComment
MagicLink         — userId, token(unique), expiresAt, isUsed
Board             — title, ownerId
BoardMember       — boardId, userId, role(OWNER/EDITOR/VIEWER)  @@unique([boardId,userId])
InviteLink        — boardId, token(unique), role, isRevoked, createdById
Column            — boardId, title, order  @@index([boardId,order])
Card              — columnId, boardId, title, description?, order  @@index([columnId,order])
FieldDefinition   — boardId, name, type(USER/DATE/TEXT/NUMBER/SELECT/COLOR), isRequired, options(Json?), order, deletedAt?
FieldValue        — cardId, fieldDefId, valueText?, valueNumber?, valueDate?  @@unique([cardId,fieldDefId])
FieldValueUser    — fieldValueId, userId  @@unique([fieldValueId,userId])
Comment           — cardId, authorId, text
Checklist         — cardId, title
ChecklistItem     — checklistId, text, isDone, order
Tag               — boardId, name, color
CardTag           — cardId, tagId  @@id([cardId,tagId])
```

Каскады: удаление Board → всё каскадом. Comment.authorId → SetNull.

---

## Key architectural rules

- **BoardRoleGuard** — проверяет JWT + роль участника доски на каждом защищённом эндпоинте. Декоратор: `@BoardRole(Role.EDITOR)`.
- **boards.gateway.ts** — единственный WebSocket gateway. Метод `notifyBoard(boardId, event, data)` вызывается из любого сервиса после мутации.
- **notifications.service.ts** — единственная точка входа для Telegram-уведомлений. Проверяет `NotificationSettings` пользователя, затем вызывает `telegram.service`.
- **FieldValueUser** — отдельная таблица для multi-user полей (тип USER допускает несколько участников).
- **FieldDefinition.deletedAt** — soft delete. Удалённые поля не показываются в UI, но значения в старых карточках сохраняются.
- **Magic Link** — TTL 10 мин, одноразовый. Хранится в БД + Redis (key: `magic:{token}`).
- **Invite flow**: `t.me/BOT?start=invite_{token}` → бот привязывает telegramId к доске → отправляет Magic Link кнопкой.

---

## Nginx routing

```
/api/*      → backend:4000
/socket.io/ → backend:4000  (WebSocket upgrade)
/*          → frontend:3000
```

---

## Code style

- TypeScript strict mode
- NestJS: class-validator + class-transformer на всех DTO
- Все async методы с try/catch или через NestJS exception filters
- Никаких any — только явные типы
- Комментарии только на русском где нужно пояснение логики
