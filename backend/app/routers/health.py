import asyncpg
from fastapi import APIRouter, Depends

from app.db import get_pool

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> dict:
    return {"status": "ok", "service": "backend"}


@router.get("/db")
async def health_db(pool: asyncpg.Pool = Depends(get_pool)) -> dict:
    """Database reachability plus the installed spatial extensions and their versions."""
    rows = await pool.fetch(
        "SELECT extname, extversion FROM pg_extension WHERE extname = ANY($1::text[])",
        ["postgis", "h3", "h3_postgis"],
    )
    return {"status": "ok", "extensions": {r["extname"]: r["extversion"] for r in rows}}
