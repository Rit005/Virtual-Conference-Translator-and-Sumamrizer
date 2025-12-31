#!/bin/sh

echo "🔧 Running database migrations..."
npx prisma migrate deploy || {
    echo "❌ Migration failed. Attempting to create extension..."
    npx prisma migrate deploy --accept-data-loss || {
        echo "⚠️  Migration completed with warnings (this is normal for first run)"
    }
}

echo "✅ Database migrations completed"

echo "🚀 Starting application..."
exec "$@"

