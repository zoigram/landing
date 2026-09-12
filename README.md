# zoidev.com — landing

Landing estática para **zoidev.com** (HTML + CSS + un único JS, servida por
nginx) más un microservicio mínimo (FastAPI) que atiende el panel de
contacto. La auth del dashboard se delega 100% a Pangolin (con Pocket ID
como identity provider si lo configuras en Pangolin) — eso sigue sin tocar
backend propio.

```
.
├── index.html        ← landing
├── shared/zoi.js     ← i18n + scroll + fondo animado + login flow + form de contacto
├── api/               ← microservicio de contacto (FastAPI + Resend)
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── Dockerfile        ← imagen nginx mínima (solo estáticos)
├── docker-compose.yml← stack para el VPS (nginx + api de contacto)
├── nginx.conf        ← gzip, cache, headers, proxy /api/ → contact-api
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

Variables de entorno del servicio `zoidev-contact` (ponlas en el shell o
en un `.env` junto a `docker-compose.yml` antes de `up`):

```bash
RESEND_API_KEY=re_xxxxxxxx                              # tu API key de resend.com
RESEND_FROM="zoidev <noreply@notifications.zoidev.com>" # remitente verificado en Resend
CONTACT_TO=contacto@zoidev.com                          # a quién llega el aviso (opcional, ya es el default)
ALLOWED_ORIGINS=https://zoidev.com                      # CORS (opcional, ya es el default)
```

Si `RESEND_API_KEY`/`RESEND_FROM` no están configuradas, el endpoint
sigue respondiendo "OK" (el panel nunca se ve roto) pero no manda nada
de verdad — se avisa por log del contenedor.

## Cómo desplegar

En tu VPS, sustituye tu stack actual por este:

```bash
mkdir -p /opt/zoidev && cd /opt/zoidev
curl -fsSL https://raw.githubusercontent.com/zoigram/landing/main/docker-compose.yml -o docker-compose.yml

export RESEND_API_KEY=re_xxxxxxxx   # ver sección "Panel de contacto" arriba
export RESEND_FROM="zoidev <noreply@notifications.zoidev.com>"

docker compose down                 # baja el stack viejo si seguía corriendo
docker compose build --no-cache     # clona el repo y construye las dos imágenes
docker compose up -d                # arranca nginx + el microservicio de contacto
```

Lo que cambia respecto a tu stack viejo:

- **No hay volúmenes locales** (`/opt/zoidev/app.js`, `package.json`, `html/`, `.env`) — el contenido vive en GitHub.
- **No hay Node** — nginx sirve estáticos directamente.
- Sigues conectándote a la red externa `pangolin` por nombre de contenedor (`zoidev-app:80`). Tu resource de Pangolin sigue apuntando ahí, sin cambios.

## Cómo actualizar tras un commit

```bash
cd /opt/zoidev
docker compose build --no-cache && docker compose up -d
```

(Opcional) Webhook de GitHub → un mini script en el VPS que ejecute lo de
arriba. O un cron `*/15 * * * *` que haga lo mismo si quieres "auto-pull".

## Desarrollo local

Cualquier servidor estático sirve:

```bash
python3 -m http.server 8080
# o
npx serve .
```

Abre `http://localhost:8080`. El login está en `demoMode` automáticamente
fuera de `zoidev.com`, así que el botón abre el dashboard sin redirigir.

El panel de contacto llama a `/api/contacto` con rutas relativas, así que
en local solo funciona detrás de un proxy que sirva ambos (o con
`docker compose up`, que sí levanta nginx + la API juntos). Sirviendo
`index.html` suelto con `python3 -m http.server` el fetch dará 404 —
esperable, no es un bug: prueba visual de la landing sin enviar de verdad.

## Idiomas

Bilingüe ES/EN, toggle en el nav, persiste en `localStorage`.
Los strings viven en `shared/zoi.js` dentro del objeto `S`.
