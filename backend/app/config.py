from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Read from environment variables (set in docker-compose.yml).

    Connection parts stay separate (no URL) so passwords may contain any character.
    """

    app_name: str = "Heatscape BW API"
    postgres_host: str = "database"
    postgres_port: int = 5432
    postgres_db: str = "heatscape"
    postgres_user: str = "heatscape"
    postgres_password: str = ""
    # Self-hosted LibreTranslate (report text EN <-> DE).
    translate_url: str = "http://translate:5000"
    translate_timeout_s: float = 60.0

    # Region the live-data imports cover (Mannheim). bbox: west, south, east, north (EPSG:4326).
    region_name: str = "Mannheim"
    region_bbox: tuple[float, float, float, float] = (8.41, 49.40, 8.59, 49.59)
    region_center: tuple[float, float] = (8.466, 49.4875)
    # DWD: warn cells (municipality and district of Mannheim), MOSMIX station (Mannheim),
    # climate stations within this radius of the region centre.
    dwd_warncells: tuple[int, ...] = (808222000, 108222000)
    dwd_mosmix_station: str = "10729"
    dwd_station_radius_km: float = 30.0
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    # Public mirrors tried in turn when the main server is busy (504/429) or unreachable.
    overpass_mirrors: tuple[str, ...] = (
        "https://overpass.private.coffee/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    )
    # Overture Maps release to read (e.g. "2026-09-17.0"); empty = the latest in the bucket.
    overture_release: str = ""
    # Sent with every import request (providers ask for an identifying user agent).
    ingest_user_agent: str = "heatscape-bw/0.1 (open-data import; research project)"
    ingest_timeout_s: float = 120.0


settings = Settings()
