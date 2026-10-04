# PostGIS plus the H3 extension from the PostgreSQL apt repository.
FROM postgis/postgis:17-3.5
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-h3 \
 && rm -rf /var/lib/apt/lists/*
COPY init/ /docker-entrypoint-initdb.d/
