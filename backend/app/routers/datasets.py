import asyncpg
from fastapi import APIRouter, Depends

from app.db import get_pool
from app.schemas.live import Dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=list[Dataset])
async def datasets(pool: asyncpg.Pool = Depends(get_pool)) -> list[Dataset]:
    """Imported open datasets: source, licence, version, last fetch and status of the last run."""
    rows = await pool.fetch("SELECT * FROM datasets ORDER BY id")
    return [Dataset(**dict(r)) for r in rows]
