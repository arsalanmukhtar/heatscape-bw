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


settings = Settings()
