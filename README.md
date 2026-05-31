# Kanban Board 🚀

Полноценная Kanban-доска реального времени с кастомными полями, чеклистами, комментариями, Drag-and-Drop и интеграцией с Telegram-ботом.

**Стек технологий:**
- **Frontend:** Next.js, Tailwind CSS, Zustand, Socket.io-client
- **Backend:** NestJS, Prisma ORM, Socket.io
- **Инфраструктура:** PostgreSQL, Redis, Docker, Nginx

---

## 🛠 Требования

Для запуска проекта вам понадобится только установленный **[Docker](https://www.docker.com/)** (включая Docker Compose).
*(Установка Node.js на хост-машину не обязательна, если вы планируете запускать всё через Docker).*

---

## ⚙️ Конфигурация (Переменные окружения)

Перед первым запуском необходимо создать **три файла** с переменными окружения. Убедитесь, что они добавлены в `.gitignore` и не попадут в публичный репозиторий.

### 1. Корневой файл `.env` (в папке с `docker-compose.yml`)
Этот файл нужен Docker Compose для инициализации пустого контейнера PostgreSQL.
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=kanban