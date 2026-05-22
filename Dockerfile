# Build a tiny static-site image. Nginx serves index.html + shared/ over
# Pangolin's internal network. No node, no app code, no secrets in the image.
FROM nginx:1.27-alpine

# Drop the default landing
RUN rm -rf /usr/share/nginx/html/*

# Copy only what the site needs
COPY index.html /usr/share/nginx/html/index.html
COPY shared/    /usr/share/nginx/html/shared/

# Light caching + gzip + sane defaults
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
