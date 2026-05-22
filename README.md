# zoidev.com — landing

Sitio estático para **zoidev.com**. HTML + CSS + un único JS. Sin Node, sin
backend, sin secretos. La auth se delega 100% a Pangolin (con Pocket ID como
identity provider si lo configuras en Pangolin).

```
.
├── index.html        ← landing
├── shared/zoi.js     ← i18n + scroll + login flow
├── Dockerfile        ← imagen nginx mínima
├── docker-compose.yml← stack para el VPS (tira de este repo)
├── nginx.conf        ← gzip, cache, headers
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

## Cómo desplegar

En tu VPS, sustituye tu stack actual por este:

```bash
mkdir -p /opt/zoidev && cd /opt/zoidev
curl -fsSL https://raw.githubusercontent.com/zoigram/landing/main/docker-compose.yml -o docker-compose.yml

docker compose down                 # baja el stack viejo si seguía corriendo
docker compose build --no-cache     # clona el repo y construye la imagen
docker compose up -d                # arranca
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

## Idiomas

Bilingüe ES/EN, toggle en el nav, persiste en `localStorage`.
Los strings viven en `shared/zoi.js` dentro del objeto `S`.
