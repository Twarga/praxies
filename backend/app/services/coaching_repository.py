"""Local coach repositories.

Stores goals, assignments, and coach profile in the journal folder
under _coach/ and _practice/.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from app.models.schemas import (
    CoachProfileModel,
    GoalModel,
    GoalRepositoryModel,
    PracticeAssignmentModel,
    PracticeRepositoryModel,
)
from app.services.config import ensure_journal_dir
from app.services.json_io import read_json_file, write_json_file


def _resolve_journal_root(config: Any) -> Path:
    if hasattr(config, "journal_folder"):
        return Path(config.journal_folder).expanduser().resolve()
    return ensure_journal_dir(config)


def get_coach_dir(config: Any) -> Path:
    return _resolve_journal_root(config) / "_coach"


def get_practice_dir(config: Any) -> Path:
    return _resolve_journal_root(config) / "_practice"


def get_coach_profile_path(config: Any) -> Path:
    return get_coach_dir(config) / "profile.json"


def get_goals_path(config: Any) -> Path:
    return get_coach_dir(config) / "goals.json"


def get_assignments_path(config: Any) -> Path:
    return get_practice_dir(config) / "assignments.json"


def load_coach_profile(config: Any) -> CoachProfileModel:
    path = get_coach_profile_path(config)
    if not path.exists():
        return save_coach_profile(config, CoachProfileModel(updated_at=datetime.now().astimezone().isoformat(timespec="seconds")))

    return CoachProfileModel.model_validate(read_json_file(path))


def save_coach_profile(config: Any, profile: CoachProfileModel) -> CoachProfileModel:
    path = get_coach_profile_path(config)
    write_json_file(path, profile.model_dump(mode="json"))
    return profile


def load_goal_repository(config: Any) -> GoalRepositoryModel:
    path = get_goals_path(config)
    if not path.exists():
        return save_goal_repository(config, GoalRepositoryModel())

    payload = read_json_file(path)
    if not isinstance(payload, dict):
        return save_goal_repository(config, GoalRepositoryModel())

    return GoalRepositoryModel.model_validate(payload)


def save_goal_repository(config: Any, repo: GoalRepositoryModel) -> GoalRepositoryModel:
    path = get_goals_path(config)
    write_json_file(path, repo.model_dump(mode="json"))
    return repo


def load_practice_repository(config: Any) -> PracticeRepositoryModel:
    path = get_assignments_path(config)
    if not path.exists():
        return save_practice_repository(config, PracticeRepositoryModel())

    return PracticeRepositoryModel.model_validate(read_json_file(path))


def save_practice_repository(config: Any, repo: PracticeRepositoryModel) -> PracticeRepositoryModel:
    path = get_assignments_path(config)
    write_json_file(path, repo.model_dump(mode="json"))
    return repo


def create_goal(
    config: Any,
    *,
    text: str,
    source_session_id: str,
    success_criteria: list[str] | None = None,
    category: str = "journal",
) -> GoalModel:
    repo = load_goal_repository(config)
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    normalized_category = category.strip() or "journal"

    # One active goal per track keeps the coaching loop clear while allowing
    # independent tracks such as language + journal to coexist.
    for existing in repo.goals:
        if existing.status == "active" and existing.category == normalized_category:
            existing.status = "completed"
            existing.completed_at = now

    goal = GoalModel(
        goal_id=str(uuid.uuid4()),
        source_session_id=source_session_id,
        text=text,
        category=normalized_category,
        success_criteria=success_criteria or [],
        status="active",
        created_at=now,
    )

    repo.goals.append(goal)
    # Praxis supports parallel tracks: a language target can stay active while
    # the user journals about work, a project, or an ordinary check-in.
    active_ids = list(repo.active_goal_ids)
    if repo.active_goal_id and repo.active_goal_id not in active_ids:
        active_ids.append(repo.active_goal_id)
    active_ids = [goal_id for goal_id in active_ids if (found := _find_goal(repo, goal_id)) and found.status == "active"]
    active_ids.append(goal.goal_id)
    repo.active_goal_ids = list(dict.fromkeys(active_ids))
    repo.active_goal_id = goal.goal_id  # legacy callers still receive the newest goal.
    save_goal_repository(config, repo)

    return goal


def create_assignment(
    config: Any,
    *,
    source_session_id: str,
    source_goal_id: str | None = None,
    title: str = "",
    instructions: str = "",
    success_criteria: list[str] | None = None,
) -> PracticeAssignmentModel:
    repo = load_practice_repository(config)
    now = datetime.now().astimezone().isoformat(timespec="seconds")

    assignment = PracticeAssignmentModel(
        assignment_id=str(uuid.uuid4()),
        source_session_id=source_session_id,
        source_goal_id=source_goal_id,
        title=title,
        instructions=instructions,
        success_criteria=success_criteria or [],
        created_at=now,
    )

    repo.assignments.append(assignment)
    save_practice_repository(config, repo)

    return assignment


def complete_assignment(config: Any, assignment_id: str) -> PracticeAssignmentModel | None:
    repo = load_practice_repository(config)
    assignment = _find_assignment(repo, assignment_id)
    if assignment is None:
        return None

    assignment.completed = True
    assignment.completed_at = datetime.now().astimezone().isoformat(timespec="seconds")
    save_practice_repository(config, repo)

    return assignment


def get_active_goal(config: Any) -> GoalModel | None:
    active = get_active_goals(config)
    return active[0] if active else None


def get_active_goals(config: Any) -> list[GoalModel]:
    repo = load_goal_repository(config)
    active_ids = list(repo.active_goal_ids)
    if repo.active_goal_id and repo.active_goal_id not in active_ids:
        active_ids.append(repo.active_goal_id)
    return [goal for goal in repo.goals if goal.goal_id in active_ids and goal.status == "active"]


def get_goal_history(config: Any) -> list[GoalModel]:
    return load_goal_repository(config).goals


def get_assignment_history(config: Any) -> list[PracticeAssignmentModel]:
    return load_practice_repository(config).assignments


def get_current_assignment(config: Any) -> PracticeAssignmentModel | None:
    repo = load_practice_repository(config)
    incomplete = [a for a in repo.assignments if not a.completed]
    return incomplete[-1] if incomplete else None


def _find_goal(repo: GoalRepositoryModel, goal_id: str) -> GoalModel | None:
    for goal in repo.goals:
        if goal.goal_id == goal_id:
            return goal
    return None


def _find_assignment(repo: PracticeRepositoryModel, assignment_id: str) -> PracticeAssignmentModel | None:
    for assignment in repo.assignments:
        if assignment.assignment_id == assignment_id:
            return assignment
    return None
