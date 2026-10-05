import httpx
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.translate import TranslateRequest, TranslateResponse

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("", response_model=TranslateResponse)
async def translate(body: TranslateRequest) -> TranslateResponse:
    """Machine-translate report text (EN ↔ DE) with the self-hosted LibreTranslate service.

    Text stays on our servers. Short texts only (≤ 20 000 characters); the first call after
    a restart is slow while the models load.
    """
    if body.source == body.target:
        return TranslateResponse(text=body.text, provider="none")
    try:
        async with httpx.AsyncClient(timeout=settings.translate_timeout_s) as client:
            res = await client.post(
                f"{settings.translate_url}/translate",
                json={"q": body.text, "source": body.source, "target": body.target, "format": body.format},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Translation service unavailable (is the translate container running and are its models downloaded?)") from exc
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Translation failed ({res.status_code}): {res.text[:200]}")
    return TranslateResponse(text=res.json().get("translatedText", ""), provider="libretranslate")
