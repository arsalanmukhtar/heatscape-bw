from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["en", "de"]


class TranslateRequest(BaseModel):
    text: str = Field(..., max_length=20000, description="Text to translate; HTML when format is 'html' (tags and inline styles are kept).")
    source: Language = Field(..., description="Language of the text.")
    target: Language = Field(..., description="Language to translate into.")
    format: Literal["html", "text"] = Field("html", description="'html' keeps markup (bold, colour, lists); 'text' for plain text.")


class TranslateResponse(BaseModel):
    text: str = Field(..., description="Translated text, in the same format as the request.")
    provider: str = Field(..., description="Translation engine used (machine translation; review before publishing).")
