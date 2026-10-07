from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db import create_pool
from app.routers import datasets, health, layers, pipelines, translate, weather


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await create_pool()
    yield
    await app.state.pool.close()


# Every route lives under /api so the gateway and middleware forward paths unchanged.
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)

app.include_router(health.router, prefix="/api")
app.include_router(translate.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(layers.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(pipelines.router, prefix="/api")
