from datetime import date as date_

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GoalBase(BaseModel):
    text: str = Field(min_length=1)
    target_value: float | None = Field(default=None, ge=0)
    target_date: date_ | None = None

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("text no puede estar vacío ni ser solo espacios")
        return stripped


class GoalCreate(GoalBase):
    # done no se pasa al crear: siempre nace en False.
    pass


class GoalUpdate(GoalBase):
    # Reemplazo total salvo el id (viene en la URL, no en el body). done sí es
    # reasignable aquí a diferencia de GoalCreate: mismo endpoint sirve tanto
    # para editar texto/objetivo como para el toggle de "hecho".
    done: bool


class Goal(GoalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    done: bool
