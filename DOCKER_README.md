# Docker Deployment Guide

## Quick Start

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop all services:**
   ```bash
   docker-compose down
   ```

## Services

| Service     | Port | URL                      |
|-------------|------|--------------------------|
| Frontend    | 5173 | http://localhost:5173    |
| Backend     | 3001 | http://localhost:3001    |
| PostgreSQL  | 5432 | localhost:5432           |

## Development

For development with hot reload, you may want to run frontend and backend locally while connecting to the Docker database:

```bash
# Start only database
docker-compose up postgres -d

# Set DATABASE_URL in your local .env
DATABASE_URL=postgresql://conference_user:conference_password@localhost:5432/conference_db?schema=public
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_USER | Database username | conference_user |
| POSTGRES_PASSWORD | Database password | conference_password |
| POSTGRES_DB | Database name | conference_db |
| JWT_SECRET | Secret key for JWT tokens | (required) |
| OPENAI_API_KEY | OpenAI API key (optional) | mock mode |
| GOOGLE_CLIENT_ID | Google OAuth client ID | - |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | - |
| GITHUB_CLIENT_ID | GitHub OAuth client ID | - |
| GITHUB_CLIENT_SECRET | GitHub OAuth client secret | - |

## Database Migrations

Migrations run automatically on container startup via the entrypoint script.

Manual migration:
```bash
docker-compose exec backend npx prisma migrate deploy
```

## Troubleshooting

### Check backend health:
```bash
curl http://localhost:3001/health
```

### View backend logs:
```bash
docker-compose logs backend
```

### Reset database:
```bash
docker-compose down -v
docker-compose up -d
```

### Rebuild containers:
```bash
docker-compose build --no-cache
docker-compose up -d
```

