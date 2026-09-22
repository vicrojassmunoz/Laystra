from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.goal import Goal, GoalCreate, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[Goal])
def list_goals(db: Session = Depends(get_db)) -> list[models.Goal]:
    return db.query(models.Goal).order_by(models.Goal.id).all()


@router.post("", response_model=Goal, status_code=201)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db)) -> models.Goal:
    goal = models.Goal(**payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}", response_model=Goal)
def update_goal(goal_id: int, payload: GoalUpdate, db: Session = Depends(get_db)) -> models.Goal:
    goal = db.get(models.Goal, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.text = payload.text
    goal.target_value = payload.target_value
    goal.target_date = payload.target_date
    goal.done = payload.done
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)) -> None:
    goal = db.get(models.Goal, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(goal)
    db.commit()
