# Q&A Flashcard Deck (with persistent DB)

Full-stack self-hosted version: Node/Express backend + SQLite + static frontend.

## Stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Frontend | Vanilla HTML/JS             |
| Backend  | Node.js + Express           |
| Database | SQLite via better-sqlite3   |
| Server   | Node built-in HTTP          |

---

## Where is the data stored?

The SQLite database file lives at:

```
/data/cards.db   (inside the container)
```

This path is controlled by the `DB_PATH` environment variable.

**Docker Compose** mounts a named volume (`qa-data`) at `/data` so the file
survives container restarts and rebuilds:

```
Docker host: /var/lib/docker/volumes/qa-data/_data/cards.db
Container:   /data/cards.db
```

**Kubernetes** uses a PersistentVolumeClaim mounted at `/data`.

---

## Quick start

### Docker Compose
```bash
docker compose up -d
```
→ http://localhost:8080

### Plain Docker
```bash
docker build -t qa-flashcards .
docker run -d \
  -p 8080:3000 \
  -v qa-data:/data \
  --name qa-flashcards \
  qa-flashcards
```

### Kubernetes
```bash
# Build and push your image first
docker build -t your-registry/qa-flashcards:latest .
docker push your-registry/qa-flashcards:latest

# Update image name in k8s.yaml, then:
kubectl apply -f k8s.yaml
kubectl port-forward svc/qa-flashcards 8080:80
```
→ http://localhost:8080

---

## API endpoints

| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | /api/cards            | All categories + cards   |
| POST   | /api/categories       | Create category          |
| DELETE | /api/categories/:id   | Delete category + cards  |
| POST   | /api/cards            | Create card              |
| PUT    | /api/cards/:id        | Edit card                |
| DELETE | /api/cards/:id        | Delete card              |

---

## Backing up the database

```bash
# Docker
docker cp qa-flashcards:/data/cards.db ./backup.db

# Or copy from the volume directly
docker run --rm -v qa-data:/data alpine cat /data/cards.db > backup.db
```

---

## Kubernetes notes

- **replicas: 1** — SQLite supports only one writer at a time. If you need
  horizontal scaling, swap SQLite for PostgreSQL.
- The PVC uses `ReadWriteOnce` access mode which is standard for single-node SQLite.
- Change the Service type from `ClusterIP` to `LoadBalancer` (or add an Ingress)
  to expose the app outside the cluster.

---

## Environment variables

| Variable  | Default          | Description              |
|-----------|------------------|--------------------------|
| PORT      | 3000             | HTTP port                |
| DB_PATH   | /data/cards.db   | Path to SQLite file      |
