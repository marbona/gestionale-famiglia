# --- Build stage ---
FROM python:3.12-alpine AS builder

RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    freetype-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    zlib-dev \
    postgresql-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Runtime stage ---
FROM python:3.12-alpine

RUN apk add --no-cache \
    freetype \
    libpng \
    libjpeg-turbo \
    postgresql-libs

COPY --from=builder /install /usr/local

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
