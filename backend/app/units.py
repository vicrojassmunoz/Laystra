from typing import Literal

WeightUnit = Literal["kg", "lb", "bw"]
LB_TO_KG = 0.45359237


def to_kg(weight: float, unit: str) -> float:
    """Convert pounds to kg; kg, bw, and unknown units are already kg-like."""
    return weight * LB_TO_KG if unit == "lb" else weight


def convert_weight(weight: float, from_unit: str, to_unit: str) -> float:
    """Convert a stored weight through kg while preserving physical meaning."""
    if from_unit == to_unit:
        return weight

    weight_kg = to_kg(weight, from_unit)
    return weight_kg / LB_TO_KG if to_unit == "lb" else weight_kg
