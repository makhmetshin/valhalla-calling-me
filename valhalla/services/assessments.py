from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from valhalla import assessments as catalog
from valhalla.assessments import Instrument, localize
from valhalla.db.base import now
from valhalla.models import AssessmentAnswer, AssessmentAttempt
from valhalla.schemas.assessments import (
    AnswerRead,
    AnswerSectionRead,
    AttemptDetailRead,
    AttemptRead,
    AttemptWrite,
    BandRead,
    ChoiceRead,
    InstrumentRead,
    InstrumentSummary,
    QuestionRead,
    SectionRead,
)
from valhalla.services.errors import NotFoundError, ValidationError
from valhalla.services.repository import require

DEFAULT_LANGUAGE = "ru"


def require_instrument(slug: str) -> Instrument:
    instrument = catalog.find(slug)
    if instrument is None:
        raise NotFoundError(f"Assessment {slug} not found")
    return instrument


def list_instruments(session: Session, language: str = DEFAULT_LANGUAGE) -> list[InstrumentSummary]:
    return [summarize(session, instrument, language) for instrument in catalog.list_instruments()]


def summarize(
    session: Session, instrument: Instrument, language: str = DEFAULT_LANGUAGE
) -> InstrumentSummary:
    total = session.execute(
        select(func.count())
        .select_from(AssessmentAttempt)
        .where(AssessmentAttempt.instrument == instrument.slug)
    ).scalar_one()
    latest = session.execute(
        select(AssessmentAttempt)
        .where(AssessmentAttempt.instrument == instrument.slug)
        .order_by(AssessmentAttempt.taken_at.desc(), AssessmentAttempt.id.desc())
        .limit(1)
    ).scalar_one_or_none()

    return InstrumentSummary(
        slug=instrument.slug,
        title=localize(instrument.title, language),
        author=localize(instrument.author, language),
        source=localize(instrument.source, language),
        about=localize(instrument.about, language),
        question_count=len(instrument.questions),
        max_score=instrument.max_score,
        attempts=total,
        bands=_bands(instrument, language),
        latest=serialize_attempt(instrument, latest, language) if latest else None,
    )


def describe(instrument: Instrument, language: str = DEFAULT_LANGUAGE) -> InstrumentRead:
    return InstrumentRead(
        slug=instrument.slug,
        title=localize(instrument.title, language),
        author=localize(instrument.author, language),
        source=localize(instrument.source, language),
        about=localize(instrument.about, language),
        lead=localize(instrument.lead, language),
        alarm=localize(instrument.alarm, language) if instrument.alarm else "",
        question_count=len(instrument.questions),
        max_score=instrument.max_score,
        choices=[
            ChoiceRead(value=choice.value, label=localize(choice.label, language))
            for choice in instrument.choices
        ],
        sections=[
            SectionRead(
                key=section.key,
                title=localize(section.title, language),
                questions=[
                    QuestionRead(
                        key=question.key,
                        text=localize(question.text, language),
                        alarming=question.alarming,
                    )
                    for question in section.questions
                ],
            )
            for section in instrument.sections
        ],
        bands=_bands(instrument, language),
    )


def _bands(instrument: Instrument, language: str) -> list[BandRead]:
    return [
        BandRead(
            key=band.key,
            low=band.low,
            high=band.high,
            title=localize(band.title, language),
        )
        for band in instrument.bands
    ]


def record_attempt(
    session: Session, slug: str, payload: AttemptWrite, language: str = DEFAULT_LANGUAGE
) -> AttemptDetailRead:
    instrument = require_instrument(slug)
    answers = _validated(instrument, payload.answers)

    attempt = AssessmentAttempt(
        instrument=instrument.slug,
        score=sum(answers.values()),
        max_score=instrument.max_score,
        note=payload.note,
        taken_at=payload.taken_at or now(),
    )
    attempt.band = instrument.band_for(attempt.score).key
    attempt.alarming = any(answers[key] > 0 for key in instrument.alarming_keys())
    attempt.answers = [
        AssessmentAnswer(question_key=question.key, value=answers[question.key])
        for question in instrument.questions
    ]

    session.add(attempt)
    session.flush()
    return detail(instrument, attempt, language)


def list_attempts(
    session: Session,
    slug: str,
    since: datetime | None = None,
    until: datetime | None = None,
    language: str = DEFAULT_LANGUAGE,
) -> list[AttemptRead]:
    instrument = require_instrument(slug)
    statement = (
        select(AssessmentAttempt)
        .where(AssessmentAttempt.instrument == instrument.slug)
        .order_by(AssessmentAttempt.taken_at, AssessmentAttempt.id)
    )
    if since is not None:
        statement = statement.where(AssessmentAttempt.taken_at >= since)
    if until is not None:
        statement = statement.where(AssessmentAttempt.taken_at <= until)

    return [
        serialize_attempt(instrument, attempt, language)
        for attempt in session.execute(statement).scalars()
    ]


def read_attempt(
    session: Session, attempt_id: int, language: str = DEFAULT_LANGUAGE
) -> AttemptDetailRead:
    attempt = require(session, AssessmentAttempt, attempt_id)
    return detail(require_instrument(attempt.instrument), attempt, language)


def delete_attempt(session: Session, attempt_id: int) -> None:
    session.delete(require(session, AssessmentAttempt, attempt_id))
    session.flush()


def serialize_attempt(
    instrument: Instrument, attempt: AssessmentAttempt, language: str = DEFAULT_LANGUAGE
) -> AttemptRead:
    band = instrument.band(attempt.band) or instrument.band_for(attempt.score)
    return AttemptRead(
        id=attempt.id,
        instrument=attempt.instrument,
        score=attempt.score,
        max_score=attempt.max_score,
        band=band.key,
        band_title=localize(band.title, language),
        alarming=attempt.alarming,
        note=attempt.note,
        taken_at=attempt.taken_at,
    )


def detail(
    instrument: Instrument, attempt: AssessmentAttempt, language: str = DEFAULT_LANGUAGE
) -> AttemptDetailRead:
    given = {answer.question_key: answer.value for answer in attempt.answers}
    labels = {choice.value: localize(choice.label, language) for choice in instrument.choices}
    top = max(labels)

    sections = []
    for section in instrument.sections:
        answered = [
            AnswerRead(
                question_key=question.key,
                question=localize(question.text, language),
                value=given.get(question.key, 0),
                label=labels.get(given.get(question.key, 0), ""),
            )
            for question in section.questions
        ]
        sections.append(
            AnswerSectionRead(
                key=section.key,
                title=localize(section.title, language),
                score=sum(answer.value for answer in answered),
                max_score=len(answered) * top,
                answers=answered,
            )
        )

    base = serialize_attempt(instrument, attempt, language)
    return AttemptDetailRead(
        **base.model_dump(),
        alarm=localize(instrument.alarm, language) if attempt.alarming and instrument.alarm else "",
        sections=sections,
    )


def _validated(instrument: Instrument, answers: dict[str, int]) -> dict[str, int]:
    expected = {question.key for question in instrument.questions}
    unknown = sorted(set(answers) - expected)
    if unknown:
        raise ValidationError(f"Unknown questions: {', '.join(unknown)}")

    missing = sorted(expected - set(answers))
    if missing:
        raise ValidationError(f"Unanswered questions: {', '.join(missing)}")

    allowed = instrument.allowed_values()
    wrong = sorted(key for key, value in answers.items() if value not in allowed)
    if wrong:
        raise ValidationError(f"Answers out of range: {', '.join(wrong)}")

    return answers
