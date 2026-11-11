from collections.abc import Iterator
from ipaddress import IPv6Address, ip_address
from typing import BinaryIO
from unicodedata import category
from urllib.parse import urlsplit, urlunsplit

import idna
from PIL import Image

from .schemas import MediaMetadata

IMAGE_LIMIT = 10 * 1024 * 1024
VIDEO_LIMIT = 50 * 1024 * 1024
IMAGE_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def public_url(value: str, *, allow_domain: bool = False) -> str:
    """Validate URL syntax and literal targets without resolving DNS or opening connections."""
    value = value.strip(" ")
    if allow_domain and value and not value.startswith(("/", "?", "#")) and ":" not in value:
        value = "https://" + value
    if any(char.isspace() or category(char).startswith("C") or char == "\\" for char in value):
        raise ValueError("Invalid URL characters")
    parts = urlsplit(value)
    host = parts.hostname
    if parts.scheme not in {"http", "https"} or not host or any(c in parts.netloc for c in "@%"):
        raise ValueError("Invalid URL authority")
    port = parts.port
    if parts.netloc.endswith(":") or port == 0:
        raise ValueError("Invalid URL port")
    if "[" in parts.netloc:
        prefix = f"[{host}]"
        if not parts.netloc.lower().startswith(prefix) or (
            parts.netloc[len(prefix):] and not parts.netloc[len(prefix):].startswith(":")
        ):
            raise ValueError("Invalid IP literal")
    try:
        address = ip_address(host)
    except ValueError:
        if "[" in parts.netloc:
            raise ValueError("Invalid IP literal") from None
        hostname = idna.encode(host, uts46=True, std3_rules=True).decode("ascii").rstrip(".")
        labels = hostname.split(".")
        if (
            len(labels) < 2
            or not labels[-1][0].isalpha()
            or labels[-1].startswith("0x")
            or labels[-1] in {"localhost", "local", "internal", "invalid", "test"}
            or hostname.endswith(".home.arpa")
        ):
            raise ValueError("Invalid public hostname") from None
    else:
        checked = address.ipv4_mapped or address if isinstance(address, IPv6Address) else address
        if not checked.is_global or checked.is_multicast:
            raise ValueError("Nonpublic IP address")
        hostname = f"[{address}]" if isinstance(address, IPv6Address) else str(address)
    authority = f"{hostname}:{port}" if port is not None else hostname
    return urlunsplit((parts.scheme, authority, parts.path or "/", parts.query, ""))


def checked_text(value: str, minimum: int) -> str:
    if len(value.strip()) < minimum or any(
        category(char) in {"Cc", "Cs"} and char not in "\t\n\r" for char in value
    ):
        raise ValueError("Invalid text input")
    return value


def image_dimensions(file: BinaryIO, content_type: str, size: int) -> tuple[int, int]:
    # Verify structure and dimensions without decoding frames or invoking external tools.
    if content_type == "image/jpeg":
        file.seek(-2, 2)
        if file.read(2) != b"\xff\xd9":
            raise ValueError("Incomplete JPEG")
    elif content_type == "image/webp":
        file.seek(4)
        if int.from_bytes(file.read(4), "little") + 8 != size:
            raise ValueError("Invalid WebP length")
    file.seek(0)
    with Image.open(file, formats=[IMAGE_FORMATS[content_type]]) as image:
        width, height = image.size
        if not 0 < width <= 8192 or not 0 < height <= 8192 or width * height > 20_000_000:
            raise ValueError("Image dimensions out of range")
        image.verify()
    return width, height


def mp4_boxes(file: BinaryIO, start: int, end: int) -> Iterator[tuple[bytes, int, int]]:
    offset = start
    for _ in range(1024):
        if offset == end:
            return
        file.seek(offset)
        header = file.read(8)
        if len(header) != 8:
            break
        length, kind = int.from_bytes(header[:4], "big"), header[4:]
        header_size = 8
        if length == 1:
            extended = file.read(8)
            if len(extended) != 8:
                break
            length, header_size = int.from_bytes(extended, "big"), 16
        elif length == 0:
            length = end - offset
        if length < header_size or offset + length > end:
            break
        yield kind, offset + header_size, offset + length
        offset += length
    if offset != end:
        raise ValueError("Invalid MP4 box")


def validate_mp4(file: BinaryIO, size: int) -> None:
    boxes = mp4_boxes(file, 0, size)
    first = next(boxes, None)
    if not first or first[0] != b"ftyp" or first[2] - first[1] < 8:
        raise ValueError("Invalid MP4 type box")
    has_metadata = has_data = False
    for kind, start, end in boxes:
        if kind == b"moov":
            children = {child for child, left, right in mp4_boxes(file, start, end) if right > left}
            has_metadata = {b"mvhd", b"trak"} <= children
        elif kind == b"mdat" and end > start:
            has_data = True
    if has_metadata and has_data:
        return
    raise ValueError("Invalid MP4 container")


def ebml_value(file: BinaryIO, *, element_id: bool = False) -> tuple[int, bool]:
    first = file.read(1)
    if not first or not first[0]:
        raise ValueError("Invalid EBML value")
    length = 9 - first[0].bit_length()
    remaining = file.read(length - 1)
    if len(remaining) != length - 1 or (element_id and length > 4):
        raise ValueError("Invalid EBML value")
    value = int.from_bytes(first + remaining, "big")
    if element_id:
        return value, False
    value ^= 1 << (7 * length)
    return value, value == (1 << (7 * length)) - 1


def validate_webm(file: BinaryIO, size: int) -> None:
    if ebml_value(file, element_id=True)[0] != 0x1A45DFA3:
        raise ValueError("Invalid WebM signature")
    length, unknown = ebml_value(file)
    end = file.tell() + length
    if unknown or length > 4096 or end >= size:
        raise ValueError("Invalid EBML header")
    doc_type = None
    while file.tell() < end:
        field, _ = ebml_value(file, element_id=True)
        field_length, unknown = ebml_value(file)
        if unknown or file.tell() + field_length > end:
            raise ValueError("Invalid EBML header field")
        if field == 0x4282:
            if doc_type is not None:
                raise ValueError("Duplicate document type")
            doc_type = file.read(field_length)
        else:
            file.seek(field_length, 1)
    if doc_type != b"webm" or ebml_value(file, element_id=True)[0] != 0x18538067:
        raise ValueError("Invalid WebM segment")
    length, unknown = ebml_value(file)
    remaining = size - file.tell()
    if remaining < 1 or (not unknown and length != remaining):
        raise ValueError("Invalid WebM segment length")
    has_tracks = has_cluster = False
    for _ in range(1024):
        if file.tell() == size:
            break
        element, _ = ebml_value(file, element_id=True)
        length, unknown = ebml_value(file)
        if unknown:
            if element != 0x1F43B675:
                raise ValueError("Unsupported unknown-size WebM element")
            length = size - file.tell()
        if file.tell() + length > size:
            raise ValueError("Invalid WebM element length")
        has_tracks |= element == 0x1654AE6B and length > 0
        has_cluster |= element == 0x1F43B675 and length > 0
        file.seek(length, 1)
    if not has_tracks or not has_cluster or file.tell() != size:
        raise ValueError("Incomplete WebM metadata")


def validate_media(file: BinaryIO, content_type: str, size: int, *, video: bool) -> MediaMetadata:
    try:
        if not video and content_type in IMAGE_FORMATS and 12 <= size <= IMAGE_LIMIT:
            width, height = image_dimensions(file, content_type, size)
            return MediaMetadata(content_type=content_type, size_bytes=size, width=width, height=height)
        if video and 12 <= size <= VIDEO_LIMIT:
            if content_type == "video/mp4":
                validate_mp4(file, size)
                return MediaMetadata(content_type=content_type, size_bytes=size)
            if content_type == "video/webm":
                validate_webm(file, size)
                return MediaMetadata(content_type=content_type, size_bytes=size)
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise ValueError("Invalid media") from None
    finally:
        file.seek(0)
    raise ValueError("Unsupported media")
