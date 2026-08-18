from __future__ import annotations

from datetime import timedelta
from itertools import pairwise

import pytest

from valhalla.assessments import find, list_instruments
from valhalla.assessments.burns import BURNS_DEPRESSION_CHECKLIST as BURNS
from valhalla.db.base import now
from valhalla.schemas.assessments import AttemptWrite
from valhalla.services import assessments as service
from valhalla.services.errors import NotFoundError, ValidationError


def answers(value: int = 0, **overrides: int) -> dict[str, int]:
    given = {question.key: value for question in BURNS.questions}
    given.update(overrides)
    return given


def take(session, value: int = 0, when=None, **overrides: int):
    payload = AttemptWrite(answers=answers(value, **overrides), taken_at=when)
    return service.record_attempt(session, BURNS.slug, payload)


def test_the_checklist_has_the_shape_the_book_gives_it():
    assert len(BURNS.questions) == 25
    assert [choice.value for choice in BURNS.choices] == [0, 1, 2, 3, 4]
    assert BURNS.max_score == 100
    assert [section.key for section in BURNS.sections] == [
        "thoughts",
        "relations",
        "body",
        "urges",
    ]


def test_every_question_key_is_its_own():
    keys = [question.key for question in BURNS.questions]

    assert len(set(keys)) == len(keys)


def test_the_bands_cover_the_whole_scale_without_gaps():
    edges = [(band.low, band.high) for band in BURNS.bands]

    assert edges[0][0] == 0
    assert edges[-1][1] == BURNS.max_score
    for (_, high), (low, _) in pairwise(edges):
        assert low == high + 1


@pytest.mark.parametrize(
    ("score", "band"),
    [
        (0, "none"),
        (5, "none"),
        (6, "unhappy"),
        (10, "unhappy"),
        (11, "mild"),
        (25, "mild"),
        (26, "moderate"),
        (50, "moderate"),
        (51, "severe"),
        (75, "severe"),
        (76, "extreme"),
        (100, "extreme"),
    ],
)
def test_the_score_lands_in_the_band_the_book_names(score, band):
    assert BURNS.band_for(score).key == band


def test_the_catalogue_knows_the_checklist():
    assert find(BURNS.slug) is BURNS
    assert BURNS in list_instruments()
    assert find("nothing-like-this") is None


def test_an_attempt_is_scored_and_stored(session):
    attempt = take(session, 2, suicidal_thoughts=0, wish_to_die=0, plan=0)

    assert attempt.score == 44
    assert attempt.max_score == 100
    assert attempt.band == "moderate"
    assert attempt.alarming is False
    assert len(service.list_attempts(session, BURNS.slug)) == 1


def test_the_parts_are_counted_on_their_own(session):
    attempt = take(session, 0, sadness=4, unhappy=3, tired=2)

    parts = {section.key: (section.score, section.max_score) for section in attempt.sections}

    assert parts["thoughts"] == (7, 40)
    assert parts["body"] == (2, 20)
    assert parts["urges"] == (0, 12)


def test_only_a_plan_raises_the_alarm(session):
    heavy = take(session, 4, plan=0)
    thinking = take(session, 0, suicidal_thoughts=4, wish_to_die=4)
    planning = take(session, 0, plan=1)

    assert heavy.alarming is False
    assert thinking.alarming is False
    assert thinking.alarm == ""
    assert planning.alarming is True
    assert planning.alarm


def test_the_plan_is_the_only_line_the_book_calls_urgent():
    assert BURNS.alarming_keys() == frozenset({"plan"})


def test_an_unanswered_line_is_refused(session):
    short = answers(1)
    short.pop("sleep")

    with pytest.raises(ValidationError, match="sleep"):
        service.record_attempt(session, BURNS.slug, AttemptWrite(answers=short))


def test_an_answer_outside_the_scale_is_refused(session):
    with pytest.raises(ValidationError, match="guilt"):
        service.record_attempt(session, BURNS.slug, AttemptWrite(answers=answers(0, guilt=9)))


def test_a_question_nobody_asked_is_refused(session):
    given = answers(0)
    given["mood_of_the_sea"] = 2

    with pytest.raises(ValidationError, match="mood_of_the_sea"):
        service.record_attempt(session, BURNS.slug, AttemptWrite(answers=given))


def test_an_unknown_checklist_is_not_found(session):
    with pytest.raises(NotFoundError):
        service.record_attempt(session, "saga-of-nothing", AttemptWrite(answers={}))


def test_attempts_come_back_in_the_order_they_were_taken(session):
    moment = now()
    take(session, 1, when=moment - timedelta(days=3))
    take(session, 3, when=moment - timedelta(days=1))
    take(session, 2, when=moment - timedelta(days=2))

    scores = [attempt.score for attempt in service.list_attempts(session, BURNS.slug)]

    assert scores == [25, 50, 75]


def test_a_stretch_of_time_can_be_asked_for(session):
    moment = now()
    take(session, 1, when=moment - timedelta(days=40))
    take(session, 2, when=moment - timedelta(days=2))

    recent = service.list_attempts(session, BURNS.slug, since=moment - timedelta(days=30))

    assert [attempt.score for attempt in recent] == [50]


def test_the_summary_carries_the_latest_attempt(session):
    take(session, 1, when=now() - timedelta(days=2))
    take(session, 4)

    summary = service.summarize(session, BURNS)

    assert summary.attempts == 2
    assert summary.latest.score == 100
    assert summary.latest.band == "extreme"
    assert len(summary.bands) == len(BURNS.bands)


def test_an_attempt_can_be_read_back_with_its_answers(session):
    stored = take(session, 0, sadness=3)

    read = service.read_attempt(session, stored.id)
    lines = {
        answer.question_key: answer.value for section in read.sections for answer in section.answers
    }

    assert lines["sadness"] == 3
    assert len(lines) == 25


def test_erasing_an_attempt_takes_its_answers_with_it(session):
    from valhalla.models import AssessmentAnswer

    stored = take(session, 1)
    service.delete_attempt(session, stored.id)

    assert service.list_attempts(session, BURNS.slug) == []
    assert session.query(AssessmentAnswer).count() == 0


def test_the_checklist_speaks_both_tongues():
    russian = service.describe(BURNS, "ru")
    english = service.describe(BURNS, "en")

    assert russian.title != english.title
    assert [question.key for question in russian.sections[0].questions] == [
        question.key for question in english.sections[0].questions
    ]


def test_an_unknown_tongue_falls_back_to_the_first_one():
    assert service.describe(BURNS, "is").title == service.describe(BURNS, "ru").title


def test_every_line_of_every_checklist_is_written_in_both_tongues():
    tongues = {"ru", "en"}

    for instrument in list_instruments():
        spoken = [
            instrument.title,
            instrument.author,
            instrument.source,
            instrument.about,
            instrument.lead,
            instrument.alarm,
            *(choice.label for choice in instrument.choices),
            *(section.title for section in instrument.sections),
            *(question.text for question in instrument.questions),
            *(band.title for band in instrument.bands),
        ]
        for line in spoken:
            assert set(line) == tongues, line
