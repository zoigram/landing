# zoidev.com — landing

Landing estática para **zoidev.com** (HTML + CSS + un único JS, servida por
nginx) más un microservicio mínimo (FastAPI) que atiende el panel de
contacto. La auth del dashboard se delega 100% a Pangolin (con Pocket ID
como identity provider si lo configuras en Pangolin) — eso sigue sin tocar
backend propio.

```
.
├── index.html                    ← landing
├── shared/zoi.js                 ← i18n + scroll + fondo animado + login flow + form de contacto
├── api/                          ← microservicio de contacto (FastAPI + Resend)
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── Dockerfile                    ← imagen nginx mínima (solo estáticos)
├── docker-compose.yml            ← stack para Portainer/VPS: pull de GHCR, sin build
├── docker-compose.override.yml   ← solo desarrollo local: sí construye desde el repo
├── .github/workflows/docker-build.yml ← build + push a GHCR + aviso a Portainer
├── nginx.conf                    ← gzip, cache, headers, proxy /api/ → contact-api
└── README.md
```

## Cómo configurar Pangolin

Edita las URLs en `shared/zoi.js`, arriba del todo:

```js
window.ZOIDEV_CONFIG = {
  authUrl:          'https://pangolin.zoidev.com',
  authLoginPath:    '/auth/login',
  authLogoutPath:   '/auth/logout',
  pocketIdLoginUrl: 'https://pangolin.zoidev.com/auth/idp/pocket-id/oidc/login',
  services: [
    { id: 'portainer', name: 'Portainer', url: 'https://portainer.zoidev.com', dot: '#13bef9',
      desc: { es: 'Contenedores Docker', en: 'Docker containers' } },
    // …
  ],
};
```

> Los usuarios viven dentro de **Pangolin** (admin UI en `pangolin.zoidev.com`).
> El botón **Continuar →** abre la página de login de Pangolin con todos los
> métodos que tengas configurados. **Continuar con Pocket ID** salta el picker
> e inicia el flujo OIDC directo (ajusta el slug del IDP en `pocketIdLoginUrl`).

## Panel de contacto (a prueba de bots)

La sección `#contact` es un formulario real (no solo un `mailto:`): el
visitor escribe nombre/email/mensaje directamente en la propia landing y
`shared/zoi.js` lo envía por `fetch` a `/api/contacto`, que nginx reenvía
al contenedor `zoidev-contact` (`api/main.py`). Ese servicio llama a la
API HTTP de [Resend](https://resend.com) y te reenvía el correo a
`contacto@zoidev.com` con `reply_to` puesto al remitente — mismo patrón
que ya usa el contacto de `zoigram/eva`.

Anti-bot, por capas (cliente **y** servidor — los checks del cliente por
sí solos son triviales de saltarse):

- **Honeypot**: un campo (`asunto_web`) fuera de pantalla que ningún
  visitante real ve ni rellena; un bot que rellena todos los inputs a
  ciegas lo delata. Si llega relleno, se responde "OK" sin enviar nada.
- **Time-trap**: se guarda cuándo se renderizó el formulario; un envío
  más rápido de lo que tarda una persona en leer y escribir se descarta
  en silencio igual que el honeypot.
- **Rate limit** por IP en el propio microservicio (5 envíos / 10 min).

Variables de entorno del servicio `zoidev-contact` — como **variables de
entorno del stack en Portainer** (Stacks → landing → Editor → Environment
variables), o en un `.env` junto a `docker-compose.yml` si usas
`docker compose` a pelo:

```bash
RESEND_API_KEY=re_xxxxxxxx                              # tu API key de resend.com
RESEND_FROM="zoidev <noreply@notifications.zoidev.com>" # remitente verificado en Resend
CONTACT_TO=contacto@zoidev.com                          # a quién llega el aviso (opcional, ya es el default)
ALLOWED_ORIGINS=https://zoidev.com                      # CORS (opcional, ya es el default)
```

Si `RESEND_API_KEY`/`RESEND_FROM` no están configuradas, el endpoint
sigue respondiendo "OK" (el panel nunca se ve roto) pero no manda nada
de verdad — se avisa por log del contenedor.

## Cómo desplegar (Portainer + GHCR, con auto-deploy)

`docker-compose.yml` ya **no construye nada** — solo hace `pull` de dos
imágenes publicadas en GHCR (`ghcr.io/zoigram/landing` y
`ghcr.io/zoigram/landing-contact`). Quien las construye y publica es
`.github/workflows/docker-build.yml`, en cada push a `main` — mismo
patrón que ya usa `zoigram/eva`. Eso hace que un simple `pull` + `up -d`
sea siempre suficiente para actualizar: nada de `--no-cache`, nada de
clonar el repo en el VPS.

**1. Stack en Portainer, apuntando al repo:**

- Stacks → Add stack → *Build method*: **Repository**.
- Repository URL: `https://github.com/zoigram/landing.git`, reference `refs/heads/main`, Compose path: `docker-compose.yml`.
- En *Environment variables* añade `RESEND_API_KEY` y `RESEND_FROM` (ver arriba).
- Si el paquete en GHCR es privado, añade las credenciales del registry en Portainer (Registries → Add registry → GHCR) antes de desplegar.

**2. Webhook de redeploy:**

- En el propio stack, activa **Webhook** — Portainer te da una URL única (`https://portainer.zoidev.com/api/stacks/webhooks/...`).
- En GitHub: repo → Settings → Secrets and variables → Actions → New repository secret → `PORTAINER_WEBHOOK_URL` con esa URL.
- Listo: cada push a `main` construye ambas imágenes, las publica en GHCR y el último paso del workflow llama a ese webhook — Portainer hace `pull` + redeploy solo. Sin el secret configurado, el build/push sigue funcionando igual; ese último paso simplemente se salta.

Lo que cambia respecto al stack viejo (Node + volúmenes en `/opt/zoidev`):

- **No hay volúmenes locales** (`app.js`, `package.json`, `html/`, `.env` sueltos) — todo vive en GitHub/GHCR.
- **No hay Node** — nginx sirve estáticos directamente.
- Sigues conectándote a la red externa `pangolin` por nombre de contenedor (`zoidev-app:80`). Tu resource de Pangolin sigue apuntando ahí, sin cambios.

### Sin Portainer (docker compose a pelo)

```bash
mkdir -p /opt/zoidev && cd /opt/zoidev
curl -fsSL https://raw.githubusercontent.com/zoigram/landing/main/docker-compose.yml -o docker-compose.yml

cat > .env <<'EOF'
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=zoidev <noreply@notifications.zoidev.com>
EOF

docker compose up -d   # solo pull + arranque, no build
```

Para actualizar tras un push (sin webhook): `docker compose pull && docker compose up -d`.

## Desarrollo local

Para solo mirar el HTML/CSS, cualquier servidor estático sirve:

```bash
python3 -m http.server 8080
# o
npx serve .
```

Abre `http://localhost:8080`. El login está en `demoMode` automáticamente
fuera de `zoidev.com`, así que el botón abre el dashboard sin redirigir.
El panel de contacto llama a `/api/contacto` con rutas relativas, así que
sirviendo el HTML suelto el fetch dará 404 — esperable, no es un bug.

Para probar el envío real de principio a fin, levanta nginx + la API
juntos — `docker-compose.override.yml` hace que esto construya desde tu
copia local en vez de tirar de GHCR:

```bash
docker compose up --build
```

## Idiomas

Bilingüe ES/EN, toggle en el nav, persiste en `localStorage`.
Los strings viven en `shared/zoi.js` dentro del objeto `S`.
