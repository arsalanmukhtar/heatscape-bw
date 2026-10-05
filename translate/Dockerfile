# Machine translation for report text (LibreTranslate, open source, Argos models).
# Internal only: the backend calls it at http://translate:5000; no published port.
# English and German models only; they download on first start into the lt-models volume.
FROM libretranslate/libretranslate:v1.6.0
ENV LT_LOAD_ONLY=en,de \
    LT_DISABLE_WEB_UI=true \
    LT_DISABLE_FILES_TRANSLATION=true \
    LT_CHAR_LIMIT=20000
