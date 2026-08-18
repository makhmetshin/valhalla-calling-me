from __future__ import annotations

from dataclasses import dataclass, field

Localized = dict[str, str]

FALLBACK_LANGUAGE = "ru"


def _pick(text: Localized, language: str) -> str:
    return text.get(language) or text[FALLBACK_LANGUAGE]


@dataclass(frozen=True, slots=True)
class Choice:
    value: int
    label: Localized


@dataclass(frozen=True, slots=True)
class Question:
    key: str
    text: Localized
    alarming: bool = False


@dataclass(frozen=True, slots=True)
class Section:
    key: str
    title: Localized
    questions: tuple[Question, ...]


@dataclass(frozen=True, slots=True)
class Band:
    key: str
    low: int
    high: int
    title: Localized


@dataclass(frozen=True, slots=True)
class Instrument:
    slug: str
    title: Localized
    author: Localized
    source: Localized
    about: Localized
    lead: Localized
    choices: tuple[Choice, ...]
    sections: tuple[Section, ...]
    bands: tuple[Band, ...]
    alarm: Localized = field(default_factory=dict)

    @property
    def questions(self) -> tuple[Question, ...]:
        return tuple(question for section in self.sections for question in section.questions)

    @property
    def max_score(self) -> int:
        return len(self.questions) * max(choice.value for choice in self.choices)

    def question(self, key: str) -> Question | None:
        return next((item for item in self.questions if item.key == key), None)

    def band_for(self, score: int) -> Band:
        for band in self.bands:
            if band.low <= score <= band.high:
                return band
        return self.bands[-1]

    def band(self, key: str) -> Band | None:
        return next((item for item in self.bands if item.key == key), None)

    def alarming_keys(self) -> frozenset[str]:
        return frozenset(question.key for question in self.questions if question.alarming)

    def allowed_values(self) -> frozenset[int]:
        return frozenset(choice.value for choice in self.choices)


def localize(text: Localized, language: str) -> str:
    return _pick(text, language)
