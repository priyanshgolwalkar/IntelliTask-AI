from fastapi.testclient import TestClient

from main import (
    app,
    is_temporary_gemini_error,
    validate_daily_tasks,
    batch_ranges,
    merge_daily_task_batches,
)

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["agent"] == "Python Gemini Agent"


def test_invalid_objective_is_rejected():
    response = client.post("/api/agent/run", json={"objective": "x"})
    assert response.status_code == 422


def test_temporary_gemini_error_classifier():
    assert is_temporary_gemini_error(Exception("503 UNAVAILABLE"))
    assert is_temporary_gemini_error(Exception("429 RESOURCE_EXHAUSTED"))
    assert is_temporary_gemini_error(TimeoutError("request timed out"))
    assert not is_temporary_gemini_error(Exception("404 model not found"))


def test_validate_daily_tasks_accepts_seven_unique_days():
    tasks = [
        {"title": f"Day {day}", "description": f"Action {day}", "priority": "medium", "estimatedHours": 2, "dayOffset": day}
        for day in range(1, 8)
    ]
    validate_daily_tasks(tasks, 7)


def test_validate_daily_tasks_accepts_fourteen_unique_days():
    tasks = [
        {"title": f"Day {day}", "description": f"Action {day}", "priority": "medium", "estimatedHours": 1.5, "dayOffset": day}
        for day in range(1, 15)
    ]
    validate_daily_tasks(tasks, 14)


def test_validate_daily_tasks_rejects_incomplete_output():
    tasks = [
        {"title": f"Day {day}", "description": f"Action {day}", "priority": "medium", "estimatedHours": 2, "dayOffset": day}
        for day in range(1, 7)
    ]
    try:
        validate_daily_tasks(tasks, 7)
        assert False, "Expected incomplete output to be rejected"
    except ValueError as exc:
        assert "Missing daily tasks" in str(exc)


def test_seven_day_batches_are_small():
    assert batch_ranges(7) == [(1, 3), (4, 5), (6, 7)]


def test_duplicate_day_is_rejected():
    tasks = [
        {"title": "One", "description": "Action one", "priority": "high", "estimatedHours": 2, "dayOffset": 1},
        {"title": "Duplicate", "description": "Action duplicate", "priority": "high", "estimatedHours": 2, "dayOffset": 1},
    ]
    try:
        validate_daily_tasks(tasks, 7, {1})
        assert False, "Expected duplicate day to be rejected"
    except ValueError as exc:
        assert "Duplicate day number" in str(exc)


def test_out_of_range_day_is_rejected_for_assigned_batch():
    tasks = [
        {"title": "Day five reused", "description": "Wrong batch", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
    ]
    try:
        validate_daily_tasks(tasks, 7, {6, 7})
        assert False, "Expected out-of-range day to be rejected"
    except ValueError as exc:
        assert "outside the assigned batch range" in str(exc)


def test_merge_returns_exactly_seven_days_in_ascending_order():
    batches = [
        (1, 3, [
            {"title": "D3", "description": "Action 3", "priority": "medium", "estimatedHours": 2, "dayOffset": 3},
            {"title": "D1", "description": "Action 1", "priority": "medium", "estimatedHours": 2, "dayOffset": 1},
            {"title": "D2", "description": "Action 2", "priority": "medium", "estimatedHours": 2, "dayOffset": 2},
        ]),
        (4, 5, [
            {"title": "D4", "description": "Action 4", "priority": "medium", "estimatedHours": 2, "dayOffset": 4},
            {"title": "D5", "description": "Action 5", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
        ]),
        (6, 7, [
            {"title": "D6", "description": "Action 6", "priority": "medium", "estimatedHours": 2, "dayOffset": 6},
            {"title": "D7", "description": "Action 7", "priority": "medium", "estimatedHours": 2, "dayOffset": 7},
        ]),
    ]

    merged = merge_daily_task_batches(batches, 7)
    assert [task["dayOffset"] for task in merged] == [1, 2, 3, 4, 5, 6, 7]


def test_merge_rejects_missing_batch_days():
    batches = [
        (1, 3, [
            {"title": "D1", "description": "Action 1", "priority": "medium", "estimatedHours": 2, "dayOffset": 1},
            {"title": "D2", "description": "Action 2", "priority": "medium", "estimatedHours": 2, "dayOffset": 2},
            {"title": "D3", "description": "Action 3", "priority": "medium", "estimatedHours": 2, "dayOffset": 3},
        ]),
        (4, 5, [
            {"title": "D4", "description": "Action 4", "priority": "medium", "estimatedHours": 2, "dayOffset": 4},
            {"title": "D5", "description": "Action 5", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
        ]),
        (6, 7, [
            {"title": "D6", "description": "Action 6", "priority": "medium", "estimatedHours": 2, "dayOffset": 6},
        ]),
    ]
    try:
        merge_daily_task_batches(batches, 7)
        assert False, "Expected missing Day 7 to be rejected"
    except ValueError as exc:
        assert "Missing daily tasks for Day 7" in str(exc)


def test_merge_rejects_day_outside_assigned_batch():
    batches = [
        (1, 3, [
            {"title": "D1", "description": "Action 1", "priority": "medium", "estimatedHours": 2, "dayOffset": 1},
            {"title": "D2", "description": "Action 2", "priority": "medium", "estimatedHours": 2, "dayOffset": 2},
            {"title": "D5", "description": "Wrong batch", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
        ]),
        (4, 5, []),
        (6, 7, []),
    ]
    try:
        merge_daily_task_batches(batches, 7)
        assert False, "Expected out-of-range Day 5 to be rejected"
    except ValueError as exc:
        assert "outside the assigned batch range Day 1-3" in str(exc)


def test_merge_rejects_duplicate_days_across_batches():
    batches = [
        (1, 3, [
            {"title": "D1", "description": "Action 1", "priority": "medium", "estimatedHours": 2, "dayOffset": 1},
            {"title": "D2", "description": "Action 2", "priority": "medium", "estimatedHours": 2, "dayOffset": 2},
            {"title": "D3", "description": "Action 3", "priority": "medium", "estimatedHours": 2, "dayOffset": 3},
        ]),
        (4, 5, [
            {"title": "D5A", "description": "Reuse 5", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
            {"title": "D5B", "description": "Reuse 5", "priority": "medium", "estimatedHours": 2, "dayOffset": 5},
        ]),
        (6, 7, [
            {"title": "D6", "description": "Action 6", "priority": "medium", "estimatedHours": 2, "dayOffset": 6},
            {"title": "D7", "description": "Action 7", "priority": "medium", "estimatedHours": 2, "dayOffset": 7},
        ]),
    ]
    try:
        merge_daily_task_batches(batches, 7)
        assert False, "Expected duplicate Day 5 to be rejected"
    except ValueError as exc:
        assert "Duplicate day number Day 5" in str(exc)
