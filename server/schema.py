"""Source-neutral data contracts shared by every Flex Card."""
from typing import Literal
from pydantic import BaseModel, Field

CardKind = Literal["gallery", "map", "initiative", "scene", "dice"]


class Login(BaseModel):
    passphrase: str = Field(min_length=1, max_length=512)


class Pair(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class Share(BaseModel):
    card: CardKind | None = None


class Selection(BaseModel):
    asset_id: str


class Scene(BaseModel):
    text: str = Field(max_length=4000)


class Dice(BaseModel):
    text: str = Field(min_length=1, max_length=120)


class Combatant(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    initiative: int = Field(ge=-20, le=99)
    hp_current: int | None = Field(default=None, ge=0, le=99999)
    hp_max: int | None = Field(default=None, ge=1, le=99999)
    private_note: str = Field(default="", max_length=1000)
    visible: bool = True


class NextTurn(BaseModel):
    reset: bool = False


class Roll(BaseModel):
    sides: Literal[4, 6, 8, 10, 12, 20, 100]
    count: int = Field(default=1, ge=1, le=20)
    modifier: int = Field(default=0, ge=-99, le=99)
