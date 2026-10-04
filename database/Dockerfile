# PostgreSQL 17 on Debian bookworm with PostGIS 3 and H3 from the PostgreSQL apt repository
# (already configured in the official image). Extensions are created by init/*.sql.
FROM postgres:17-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-17-postgis-3 \
      postgresql-17-postgis-3-scripts \
      postgresql-17-h3 \
 && rm -rf /var/lib/apt/lists/*
COPY init/ /docker-entrypoint-initdb.d/
