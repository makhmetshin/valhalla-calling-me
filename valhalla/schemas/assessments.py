from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel


class ChoiceRead(ReadModel):
    value: int
    label: str


class QuestionRead(ReadModel):
    key: str
    text: str
    alarming: bool


class SectionRead(ReadModel):
    key: str
    title: str
    questions: list[QuestionRead]


class BandRead(ReadModel):
    key: str
    low: int
    high: int
    title: str


class InstrumentRead(ReadModel):
    slug: str
    title: str
    author: str
    source: str
    about: str
    lead: str
    alarm: str
    question_count: int
    max_score: int
    choices: list[ChoiceRead]
    sections: list[SectionRead]
    bands: list[BandRead]


class AttemptRead(ReadModel):
    id: int
    instrument: str
    score: int
    max_score: int
    band: str
    band_title: str
    alarming: bool
    note: str
    taken_at: datetime


class AnswerRead(ReadModel):
    question_key: str
    question: str
    value: int
    label: str


class AnswerSectionRead(ReadModel):
    key: str
    title: str
    score: int
    max_score: int
    answers: list[AnswerRead]


class AttemptDetailRead(AttemptRead):
    alarm: str
    sections: list[AnswerSectionRead]


class InstrumentSummary(ReadModel):
    slug: str
    title: str
    author: str
    source: str
    about: str
    question_count: int
    max_score: int
    attempts: int
    bands: list[BandRead]
    latest: AttemptRead | None


class AttemptWrite(WriteModel):
    answers: dict[str, int]
    note: str = Field(default="", max_length=2000)
    taken_at: datetime | None = None
