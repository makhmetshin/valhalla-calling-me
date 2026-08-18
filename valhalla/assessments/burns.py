from __future__ import annotations

from valhalla.assessments.definitions import Band, Choice, Instrument, Question, Section

CHOICES = (
    Choice(0, {"ru": "Совсем нет", "en": "Not at all"}),
    Choice(1, {"ru": "Слегка", "en": "Somewhat"}),
    Choice(2, {"ru": "Умеренно", "en": "Moderately"}),
    Choice(3, {"ru": "Сильно", "en": "A lot"}),
    Choice(4, {"ru": "Очень сильно", "en": "Extremely"}),
)

THOUGHTS = Section(
    key="thoughts",
    title={"ru": "Мысли и чувства", "en": "Thoughts and feelings"},
    questions=(
        Question(
            "sadness", {"ru": "Печаль, подавленность", "en": "Feeling sad or down in the dumps"}
        ),
        Question("unhappy", {"ru": "Уныние, тоска", "en": "Feeling unhappy or blue"}),
        Question(
            "crying", {"ru": "Слёзы, легко расплакаться", "en": "Crying spells or tearfulness"}
        ),
        Question("discouraged", {"ru": "Опускаются руки", "en": "Feeling discouraged"}),
        Question("hopeless", {"ru": "Ощущение безнадёжности", "en": "Feeling hopeless"}),
        Question("self_esteem", {"ru": "Низкая самооценка", "en": "Low self-esteem"}),
        Question(
            "worthless",
            {
                "ru": "Чувство никчёмности или несостоятельности",
                "en": "Feeling worthless or inadequate",
            },
        ),
        Question("guilt", {"ru": "Вина или стыд", "en": "Guilt or shame"}),
        Question(
            "self_blame",
            {"ru": "Ругаешь и винишь себя", "en": "Criticizing yourself or blaming yourself"},
        ),
        Question(
            "indecision", {"ru": "Трудно принимать решения", "en": "Difficulty making decisions"}
        ),
    ),
)

RELATIONS = Section(
    key="relations",
    title={"ru": "Дела и отношения", "en": "Activities and personal relationships"},
    questions=(
        Question(
            "interest_people",
            {
                "ru": "Пропал интерес к близким, друзьям, товарищам",
                "en": "Loss of interest in family, friends or colleagues",
            },
        ),
        Question("loneliness", {"ru": "Одиночество", "en": "Loneliness"}),
        Question(
            "withdrawal",
            {
                "ru": "Стал реже видеться с близкими и друзьями",
                "en": "Spending less time with family or friends",
            },
        ),
        Question("motivation", {"ru": "Пропала охота что-либо делать", "en": "Loss of motivation"}),
        Question(
            "interest_work",
            {
                "ru": "Пропал интерес к работе и другим занятиям",
                "en": "Loss of interest in work or other activities",
            },
        ),
        Question(
            "avoidance",
            {"ru": "Избегаешь работы и других дел", "en": "Avoiding work or other activities"},
        ),
        Question(
            "pleasure",
            {
                "ru": "Пропало удовольствие и удовлетворение от жизни",
                "en": "Loss of pleasure or satisfaction in life",
            },
        ),
    ),
)

BODY = Section(
    key="body",
    title={"ru": "Телесные признаки", "en": "Physical symptoms"},
    questions=(
        Question("tired", {"ru": "Усталость", "en": "Feeling tired"}),
        Question(
            "sleep",
            {
                "ru": "Спишь плохо или слишком много",
                "en": "Difficulty sleeping or sleeping too much",
            },
        ),
        Question(
            "appetite",
            {"ru": "Аппетит пропал или наоборот вырос", "en": "Decreased or increased appetite"},
        ),
        Question("libido", {"ru": "Пропал интерес к близости", "en": "Loss of interest in sex"}),
        Question("health", {"ru": "Тревога о своём здоровье", "en": "Worrying about your health"}),
    ),
)

URGES = Section(
    key="urges",
    title={"ru": "Мысли об уходе", "en": "Suicidal urges"},
    questions=(
        Question(
            "suicidal_thoughts",
            {"ru": "Приходят мысли о самоубийстве", "en": "Do you have any suicidal thoughts?"},
        ),
        Question(
            "wish_to_die",
            {"ru": "Хочется закончить свою жизнь", "en": "Would you like to end your life?"},
        ),
        Question(
            "plan",
            {
                "ru": "Есть план, как причинить себе вред",
                "en": "Do you have a plan for harming yourself?",
            },
            alarming=True,
        ),
    ),
)

BANDS = (
    Band(
        key="none",
        low=0,
        high=5,
        title={"ru": "Депрессии нет", "en": "No depression"},
    ),
    Band(
        key="unhappy",
        low=6,
        high=10,
        title={"ru": "Обычное состояние, но без радости", "en": "Normal but unhappy"},
    ),
    Band(
        key="mild",
        low=11,
        high=25,
        title={"ru": "Лёгкая депрессия", "en": "Mild depression"},
    ),
    Band(
        key="moderate",
        low=26,
        high=50,
        title={"ru": "Умеренная депрессия", "en": "Moderate depression"},
    ),
    Band(
        key="severe",
        low=51,
        high=75,
        title={"ru": "Тяжёлая депрессия", "en": "Severe depression"},
    ),
    Band(
        key="extreme",
        low=76,
        high=100,
        title={"ru": "Крайне тяжёлая депрессия", "en": "Extreme depression"},
    ),
)

BURNS_DEPRESSION_CHECKLIST = Instrument(
    slug="burns-depression",
    title={"ru": "Опросник депрессии Бёрнса", "en": "Burns Depression Checklist"},
    author={"ru": "Дэвид Бёрнс", "en": "David D. Burns"},
    source={"ru": "«Терапия настроения»", "en": "The Feeling Good Handbook"},
    about={
        "ru": "Двадцать пять признаков, по которым Бёрнс предлагает измерять настроение. ",
        "en": "The twenty-five signs by which Burns measures mood.",
    },
    lead={
        "ru": "Отметь, насколько каждое из этого беспокоило тебя за последнюю неделю, "
        "включая сегодня.",
        "en": "Mark how much each of these has troubled you over the past week, "
        "including today.",
    },
    choices=CHOICES,
    sections=(THOUGHTS, RELATIONS, BODY, URGES),
    bands=BANDS,
    alarm={
        "ru": "Ты отметил, что у тебя есть план. Мысли о смерти и желание, чтобы всё кончилось, "
        "приходят ко многим в депрессии, но план Бёрнс выделяет отдельно: это та самая строка, "
        "после которой стоит связаться со специалистом сразу, каким бы ни был общий счёт.",
        "en": "You marked that you have a plan. Thoughts of death and the wish for it all to end "
        "come to many in depression, but Burns sets the plan apart: this is the one line after "
        "which it is worth reaching a specialist at once, whatever the total is.",
    },
)
