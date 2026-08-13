from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from valhalla.db.session import get_session

DbSession = Annotated[Session, Depends(get_session)]
