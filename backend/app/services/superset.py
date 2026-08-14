"""Validation for super-series (superset_group) grouping.

Shared between `POST/PUT /routines` (RoutineExerciseCreate) and
`POST/PUT /workouts` (WorkoutSetCreate) — both item types carry an
`exercise_id` and an optional `superset_group`. Lives here rather than in the
Pydantic schemas because it needs to see the *whole* list of items to detect a
group used by fewer than 2 distinct exercises, not just a single item.
"""

from typing import Protocol

from fastapi import HTTPException


class HasSupersetGroup(Protocol):
    exercise_id: int
    superset_group: int | None


def validate_superset_groups(items: list[HasSupersetGroup]) -> None:
    """Every superset_group present must cover at least 2 distinct exercise_id.

    A group with only one distinct exercise is very likely a frontend bug
    (e.g. sending the same superset_group for two sets of the SAME exercise,
    or forgetting to include the second exercise) — reject it loudly instead
    of silently persisting a broken group.
    """
    exercises_by_group: dict[int, set[int]] = {}
    for item in items:
        if item.superset_group is None:
            continue
        exercises_by_group.setdefault(item.superset_group, set()).add(item.exercise_id)

    for group, exercise_ids in exercises_by_group.items():
        if len(exercise_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"superset_group {group} solo tiene un ejercicio, "
                    "una super-serie necesita al menos 2"
                ),
            )
