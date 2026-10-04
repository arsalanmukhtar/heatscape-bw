from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Read from environment variables (set in docker-compose.yml)."""

    app_name: str = "Heatscape BW API"
    database_url: str = "postgresql://heatscape:heatscape@database:5432/heatscape"


settings = Settings()
