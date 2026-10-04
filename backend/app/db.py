import asyncpg
from fastapi import Request

from app.config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
        min_size=1,
        max_size=10,
    )


def get_pool(request: Request) -> asyncpg.Pool:
    """FastAPI dependency: the connection pool opened at startup."""
    return request.app.state.pool
