"""OCR with Tesseract (via pytesseract).

Tesseract was chosen over PaddleOCR because it is a small system package, CPU-only and
easy to run in a slim container. `image_to_data` returns per-word confidence, which feeds
the evidence-based confidence scoring.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from decimal import Decimal

import pytesseract
from PIL import Image, UnidentifiedImageError

from app.config.settings import Settings
from app.exceptions.extraction_exceptions import DocumentValidationError, OcrError
from app.utils.metrics import OCR_PAGES_TOTAL

log = logging.getLogger(__name__)

# Decompression-bomb guard: Pillow raises when an image exceeds this many pixels.
Image.MAX_IMAGE_PIXELS = 80_000_000


@dataclass
class OcrResult:
    text: str
    mean_confidence: Decimal  # 0..1


class OcrService:
    def __init__(self, settings: Settings) -> None:
        self._languages = settings.ocr_languages
        self._timeout = settings.ocr_timeout_seconds
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    def recognize(self, image_bytes: bytes) -> OcrResult:
        try:
            with Image.open(io.BytesIO(image_bytes)) as image:
                image.load()
                grayscale = image.convert("L")
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
            OCR_PAGES_TOTAL.labels(outcome="invalid_image").inc()
            raise DocumentValidationError("Image cannot be decoded safely") from exc

        try:
            data = pytesseract.image_to_data(
                grayscale, lang=self._languages, output_type=pytesseract.Output.DICT, timeout=self._timeout)
        except pytesseract.TesseractNotFoundError as exc:
            OCR_PAGES_TOTAL.labels(outcome="not_installed").inc()
            raise OcrError("Tesseract OCR is not installed or not configured") from exc
        except RuntimeError as exc:  # pytesseract raises RuntimeError on timeout
            OCR_PAGES_TOTAL.labels(outcome="timeout").inc()
            raise OcrError("OCR timed out") from exc
        except pytesseract.TesseractError as exc:
            OCR_PAGES_TOTAL.labels(outcome="error").inc()
            raise OcrError("OCR engine failed") from exc

        OCR_PAGES_TOTAL.labels(outcome="success").inc()
        return self._assemble(data)

    @staticmethod
    def _assemble(data: dict) -> OcrResult:
        """Rebuilds lines from Tesseract's word boxes and averages word confidence."""
        lines: dict[tuple[int, int, int], list[str]] = {}
        confidences: list[Decimal] = []
        for i, word in enumerate(data.get("text", [])):
            word = (word or "").strip()
            if not word:
                continue
            try:
                conf = Decimal(str(data["conf"][i]))
            except Exception:
                conf = Decimal("-1")
            if conf >= 0:
                confidences.append(conf)
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines.setdefault(key, []).append(word)

        text = "\n".join(" ".join(words) for _, words in sorted(lines.items()))
        mean = (sum(confidences) / len(confidences) / Decimal(100)) if confidences else Decimal(0)
        return OcrResult(text=text, mean_confidence=mean.quantize(Decimal("0.001")))
