# Docker — kun-galgame-counter

The "down for maintenance" page + tiny vote counter, containerized in the same
style as the rest of the 鲲 Galgame ecosystem
(see [`kun-galgame-infra/docs/deploy`](../../kun-galgame-infra/docs/deploy)), but
**stripped to what a standalone app needs**:

- **No shared infrastructure.** It owns no Postgres/Redis/MinIO/Meili and makes
  no service-to-service calls — so there is no infra network, no `migrate` jobs,
  no Go/cgo image. Just one Nuxt SSR `web` container.
- **The only state is the vote tally**, persisted to `server/data/counter.json`
  on a named volume (`counter-data`). Nitro's `.output` does not bundle that
  dir, so without the volume every redeploy resets the count.
- **Healthcheck is a TCP liveness probe**, not an HTTP check: the page returns
  `503` on purpose (maintenance), which an HTTP probe would read as unhealthy.

| File | Role |
|---|---|
| `docker/nuxt.Dockerfile` | Multi-stage build: `node:24-trixie-slim` → `.output`, runs as `node`, listens on `2326`. |
| `docker-compose.yml` | **Dev/local**: `build:` + host port `15014:2326` + own network. |
| `docker-compose.prod.yml` | **Prod (Dokploy)**: GHCR `image:` + `expose:` + `dokploy-network`. |
| `docker/web.env.example` | Copy to `docker/web.env` (gitignored) to set `COUNTER_IP_SALT`. |

## Local

```bash
docker compose build
docker compose up -d
curl -I http://localhost:15014/        # HTTP/1.1 503 Service Unavailable (intentional)
curl    http://localhost:15014/api/counter
docker compose logs -f web
docker compose down                    # keeps the counter-data volume
```

## Production (Dokploy + Traefik)

Mirrors [`12-dokploy.md`](../../kun-galgame-infra/docs/deploy/12-dokploy.md): one
Dokploy **Compose** application on the shared `dokploy-network`; Traefik handles
routing + automatic Let's Encrypt certs.

1. **Image** — build & push to GHCR (CI, per
   [`13-registry-ci.md`](../../kun-galgame-infra/docs/deploy/13-registry-ci.md)),
   or build locally and push:
   ```bash
   docker build -f docker/nuxt.Dockerfile -t ghcr.io/kungal/counter-web:latest .
   docker push ghcr.io/kungal/counter-web:latest
   ```
2. **DNS** — point all of these A/AAAA records at the server's public IP:
   `down.kungal.com`, `www.kungal.com`, `kungal.com`, `www.moyu.moe`, `moyu.moe`.
3. **Deploy** — Dokploy Compose app from `docker-compose.prod.yml`:
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```
4. **Domains** — on the `web` service's **Domains** tab add each domain above,
   target **`web:2326`**. (apex↔www can be left side-by-side, or add a 301 to
   converge them.)
5. **Env** — set `COUNTER_IP_SALT` in `docker/web.env` or Dokploy Environment;
   keep it stable so per-IP vote dedup survives restarts.

> Don't publish host ports under Dokploy — Traefik routes internally via
> `expose`. Don't stack Caddy/nginx/Cloudflare-Tunnel on top of Dokploy's
> Traefik.
