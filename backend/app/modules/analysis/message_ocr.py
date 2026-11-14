import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import BinaryIO

from anyio import CapacityLimiter, to_thread
from PIL import Image, ImageOps

@dataclass(frozen=True, repr=False)
class OCRResult:
    status: str
    text: str = ''


class MessageOCR:
    def __init__(self, executable: str, tessdata_dir: Path | None = None):
        self.executable = executable
        self.tessdata_dir = tessdata_dir
        self.capacity = CapacityLimiter(1)

    async def read(self, stream: BinaryIO) -> OCRResult:
        if self.capacity.borrowed_tokens:
            return OCRResult('busy')
        return await to_thread.run_sync(self.read_image, stream, limiter=self.capacity)

    def read_image(self, stream: BinaryIO) -> OCRResult:
        try:
            import pytesseract
        except ImportError:
            return OCRResult('unavailable')
        command = shutil.which(self.executable)
        if not command and self.executable == 'tesseract' and os.name == 'nt':
            candidate = Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'Tesseract-OCR' / 'tesseract.exe'
            command = str(candidate) if candidate.is_file() else None
        if not command:
            return OCRResult('unavailable')
        try:
            args = ['--tessdata-dir', str(self.tessdata_dir)] if self.tessdata_dir else []
            languages = subprocess.run([command, *args, '--list-langs'], capture_output=True, timeout=2, check=True).stdout.splitlines()
            if not {b'eng', b'ind'}.issubset({line.strip() for line in languages}):
                return OCRResult('missing_languages')
            pytesseract.pytesseract.tesseract_cmd = command
            stream.seek(0)
            with Image.open(stream) as original:
                original.load()
                if getattr(original, 'is_animated', False):
                    return OCRResult('failed')
                image = ImageOps.grayscale(ImageOps.exif_transpose(original))
                image.thumbnail((2600, 2600))
                # pytesseract retains literal quotes in Windows config arguments. Pass the
                # model directory through the inherited Tesseract environment instead.
                previous = os.environ.get('TESSDATA_PREFIX')
                if self.tessdata_dir:
                    os.environ['TESSDATA_PREFIX'] = str(self.tessdata_dir)
                try:
                    words = pytesseract.image_to_data(image, lang='ind+eng', config='--psm 6', output_type=pytesseract.Output.DICT, timeout=4)
                finally:
                    if self.tessdata_dir:
                        if previous is None:
                            os.environ.pop('TESSDATA_PREFIX', None)
                        else:
                            os.environ['TESSDATA_PREFIX'] = previous
            lines = {}
            confidence = []
            for index, word in enumerate(words['text']):
                if not word.strip():
                    continue
                line = tuple(words[key][index] for key in ('block_num', 'par_num', 'line_num'))
                lines.setdefault(line, []).append(word)
                confidence.append(float(words['conf'][index]))
            text_parts = []
            previous_paragraph = None
            for line, tokens in lines.items():
                if previous_paragraph is not None and line[:2] != previous_paragraph:
                    text_parts.append('')
                text_parts.append(' '.join(tokens))
                previous_paragraph = line[:2]
            text = '\n'.join(text_parts)
            if len(text.strip()) < 10:
                return OCRResult('empty')
            if len(text) > 10000:
                return OCRResult('truncated', text[:10000].rsplit(maxsplit=1)[0])
            return OCRResult('low_confidence' if mean(confidence) < 70 else 'completed', text)
        except (subprocess.TimeoutExpired, RuntimeError) as error:
            return OCRResult('timeout' if isinstance(error, subprocess.TimeoutExpired) or str(error) == 'Tesseract process timeout' else 'failed')
        except (OSError, ValueError, KeyError, IndexError, SyntaxError, subprocess.CalledProcessError):
            return OCRResult('failed')
