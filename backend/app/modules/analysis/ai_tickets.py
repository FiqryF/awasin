"""Bounded, process-local authorization for a single explanation of a completed scan."""

from collections import deque
from dataclasses import dataclass
from hashlib import sha256
from secrets import token_urlsafe
from time import monotonic
from typing import Generic, TypeVar

from .ai_schema import AIOffer
T = TypeVar("T")

TTL_SECONDS = 60
PER_SUBJECT_LIMIT = 4
GLOBAL_LIMIT = 30


@dataclass(frozen=True, slots=True, repr=False)
class Binding:
    subject: str
    session: str


@dataclass(frozen=True, slots=True, repr=False)
class Pending(Generic[T]):
    assessment: T
    binding: Binding
    expires: float


def digest(value: str) -> str:
    return sha256(value.encode()).hexdigest()


class ExplanationTickets(Generic[T]):
    def __init__(self):
        self.pending: dict[str, Pending[T]] = {}
        self.admissions: deque[tuple[float, str]] = deque()

    def prune(self, now: float) -> None:
        for key, item in tuple(self.pending.items()):
            if item.expires <= now:
                del self.pending[key]
        while self.admissions and self.admissions[0][0] <= now:
            self.admissions.popleft()

    def issue(self, assessment: T, binding: Binding) -> AIOffer:
        now = monotonic()
        self.prune(now)
        if (len(self.admissions) >= GLOBAL_LIMIT
                or sum(subject == binding.subject for _, subject in self.admissions) >= PER_SUBJECT_LIMIT):
            return AIOffer(status="rate_limited")
        token = token_urlsafe(32)
        expiry = now + TTL_SECONDS
        self.admissions.append((expiry, binding.subject))
        self.pending[digest(token)] = Pending(assessment, binding, expiry)
        return AIOffer(status="pending", ticket=token)

    def consume(self, token: str, binding: Binding) -> T | None:
        self.prune(monotonic())
        key = digest(token)
        item = self.pending.get(key)
        if item is None or item.binding != binding:
            return None
        return self.pending.pop(key).assessment
