import os
import asyncio
import json
from typing import Optional, Dict, Any, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(
    title="IntelliTask AI Python Agent",
    version="1.0.0",
    description="Python AI agent service for IntelliTask AI",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    objective: str = Field(..., min_length=3, max_length=5000)
    context: Optional[str] = Field(default=None, max_length=5000)
    horizon_days: int = Field(default=14, ge=1, le=90)


class PlanningResponse(BaseModel):
    status: str
    agent: str
    model: str
    provider: str
    result: Dict[str, Any]
    retries: int
    horizonDays: int
    milestones: List[Dict[str, Any]]
    tasks: List[Dict[str, Any]]
    executionLogs: List[Dict[str, Any]] = []


def provider_priority():
    priority = [
        value.strip().lower()
        for value in os.getenv("LLM_PROVIDER_PRIORITY", "gemini,groq").split(",")
        if value.strip().lower() in {"gemini", "groq"}
    ]
    return list(dict.fromkeys(priority or ["gemini", "groq"]))


def is_temporary_gemini_error(exc):
    message = str(exc).upper()
    return (
        isinstance(exc, (asyncio.TimeoutError, TimeoutError))
        or any(code in message for code in ["429", "500", "502", "503", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "ECONNRESET", "ETIMEDOUT", "NETWORK", "TIMED OUT"])
    )


def classify_http_status(error):
    status = getattr(error, "status_code", None)
    message = str(error).upper()
    exhausted = status == 429 or "RESOURCE_EXHAUSTED" in message or "DAILY" in message or "QUOTA" in message
    retryable = status in {500, 502, 503, 504, 404} or any(code in message for code in ["UNAVAILABLE", "ECONNRESET", "ETIMEDOUT", "NETWORK", "TIMED OUT"])
    return retryable, exhausted, status


def validate_daily_tasks(tasks: Any, horizon_days: int, expected_days: Optional[set[int]] = None):
    if not isinstance(tasks, list):
        raise ValueError("Planning response is missing the tasks array.")
    expected = expected_days or set(range(1, horizon_days + 1))
    seen = {}
    for task in tasks:
        if not isinstance(task, dict):
            raise ValueError("Daily task is malformed.")
        raw_day = task.get("dayOffset")
        if isinstance(raw_day, bool):
            raise ValueError("Daily task dayOffset must be an integer.")
        try:
            numeric_day = float(raw_day)
        except (TypeError, ValueError):
            raise ValueError(f"Daily task Day {raw_day} has an invalid dayOffset.")
        if not numeric_day.is_integer():
            raise ValueError(f"Daily task Day {raw_day} has an invalid non-integer dayOffset.")
        day = int(numeric_day)
        title = str(task.get("title", "")).strip()
        description = str(task.get("description", "")).strip()
        priority = str(task.get("priority", "")).strip().lower()
        hours = float(task.get("estimatedHours", 0) or 0)
        if day not in expected:
            expected_label = min(expected) if expected else 0
            expected_max = max(expected) if expected else 0
            raise ValueError(
                f"Daily task Day {day} is outside the assigned batch range "
                f"Day {expected_label}-{expected_max}."
            )
        if title == "" or description == "" or priority not in {"low", "medium", "high", "urgent"} or hours <= 0:
            raise ValueError(f"Daily task Day {day} is incomplete.")
        if day in seen:
            raise ValueError(f"Duplicate day number Day {day} is not allowed.")
        normalized_task = dict(task)
        normalized_task["dayOffset"] = day
        normalized_task["title"] = title
        normalized_task["description"] = description
        normalized_task["priority"] = priority
        normalized_task["estimatedHours"] = hours
        seen[day] = normalized_task
    missing = sorted(expected - set(seen))
    if missing:
        raise ValueError(f"Missing daily tasks for Day {', '.join(str(day) for day in missing)}.")
    return [seen[day] for day in sorted(seen)]


def batch_ranges(horizon: int):
    if horizon == 7:
        return [(1, 3), (4, 5), (6, 7)]
    ranges = []
    start = 1
    while start <= horizon:
        end = min(start + 2, horizon)
        ranges.append((start, end))
        start = end + 1
    return ranges


def merge_daily_task_batches(
    batches: Any,
    horizon_days: int,
):
    if not isinstance(batches, list):
        raise ValueError("Planner batch results are malformed.")

    expected_ranges = batch_ranges(horizon_days)
    if len(batches) != len(expected_ranges):
        raise ValueError(
            f"Planner returned {len(batches)} batches instead of {len(expected_ranges)}."
        )

    merged_by_day = {}
    for index, batch in enumerate(batches):
        if not isinstance(batch, (list, tuple)) or len(batch) != 3:
            raise ValueError(f"Planner batch {index + 1} is malformed.")
        start_day, end_day, tasks = batch
        if (start_day, end_day) != expected_ranges[index]:
            raise ValueError(
                f"Planner batch {index + 1} is for Day {start_day}-{end_day}; "
                f"expected Day {expected_ranges[index][0]}-{expected_ranges[index][1]}."
            )
        batch_tasks = validate_daily_tasks(
            tasks,
            horizon_days,
            set(range(start_day, end_day + 1)),
        )
        for task in batch_tasks:
            day = int(task["dayOffset"])
            if day in merged_by_day:
                raise ValueError(f"Duplicate day number Day {day} was returned by multiple batches.")
            merged_by_day[day] = task

    expected_days = set(range(1, horizon_days + 1))
    missing_days = sorted(expected_days - set(merged_by_day))
    if missing_days:
        raise ValueError(
            f"Missing daily tasks for Day {', '.join(str(day) for day in missing_days)}."
        )
    if len(merged_by_day) != horizon_days:
        raise ValueError(
            f"Planner must return exactly {horizon_days} unique days."
        )

    return [merged_by_day[day] for day in range(1, horizon_days + 1)]


@app.get("/health")
async def health():
    priority = provider_priority()
    return {
        "status": "healthy",
        "service": "IntelliTask AI Python Agent",
        "version": "1.0.0",
        "agent": "Python Gemini Agent",
        "llm": {
            "primary": priority[0] if priority else "gemini",
            "priority": priority,
            "geminiConfigured": bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_MODEL")),
            "geminiModel": os.getenv("GEMINI_MODEL") or None,
            "groqConfigured": bool(os.getenv("GROQ_API_KEY") and os.getenv("GROQ_MODEL")),
            "groqModel": os.getenv("GROQ_MODEL") or None,
        },
    }


def generate_gemini_response(client, model, prompt, timeout):
    return client.models.generate_content(model=model, contents=prompt)


@app.post("/api/agent/run")
async def run_agent(payload: AgentRequest):
    request_timeout = max(5.0, float(os.getenv("LLM_REQUEST_TIMEOUT_MS", "30000")) / 1000)
    groq_max_tokens = max(1, min(int(os.getenv("GROQ_MAX_TOKENS", "300")), 400))
    provider_errors = []
    execution_logs = []
    all_tasks = []
    selected_provider = None
    selected_model = None
    retries = 0

    for provider in provider_priority():
        provider_tasks = []
        provider_batch_results = []
        provider_failed_batch = None

        try:
            if provider == "gemini":
                api_key = os.getenv("GEMINI_API_KEY")
                model = os.getenv("GEMINI_MODEL")
                if not api_key:
                    raise HTTPException(status_code=503, detail="Gemini API key is not configured")
                if not model:
                    raise HTTPException(status_code=404, detail="GEMINI_MODEL is not configured")
                client = genai.Client(api_key=api_key)
            else:
                api_key = os.getenv("GROQ_API_KEY")
                model = os.getenv("GROQ_MODEL")
                if not api_key:
                    raise HTTPException(status_code=503, detail="Groq API key is not configured")
                if not model:
                    raise HTTPException(status_code=404, detail="GROQ_MODEL is not configured")

            provider_failed = False
            for batch_index, (start_day, end_day) in enumerate(batch_ranges(payload.horizon_days), start=1):
                prompt = f"""Return ONLY valid JSON for Days {start_day}-{end_day}.
Objective: {payload.objective}
Context: {payload.context or 'None'}
Horizon: {payload.horizon_days} days
Generate exactly {end_day - start_day + 1} unique tasks, one each for Day {start_day} through Day {end_day}.
No duplicated days and no tasks outside this batch.
Required JSON: {{"tasks":[{{"title":string,"description":string,"priority":"low|medium|high|urgent","estimatedHours":number,"dayOffset":integer}}]}}
"""
                try:
                    if provider == "gemini":
                        response = await asyncio.wait_for(
                            asyncio.to_thread(generate_gemini_response, client, model, prompt, request_timeout),
                            timeout=request_timeout,
                        )
                        raw = (response.text or "").strip()
                    else:
                        base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
                        async with httpx.AsyncClient(timeout=request_timeout) as groq_client:
                            response = await groq_client.post(
                                f"{base_url}/chat/completions",
                                headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
                                json={
                                    "model": model,
                                    "messages": [
                                        {"role": "system", "content": "You are a compact planning agent. Return only valid JSON for the requested day batch."},
                                        {"role": "user", "content": prompt},
                                    ],
                                    "temperature": 0.2,
                                    "max_tokens": groq_max_tokens,
                                    "response_format": {"type": "json_object"},
                                },
                            )
                            if response.status_code == 429:
                                retry_after_header = response.headers.get("retry-after")
                                try:
                                    retry_after = max(0, min(float(retry_after_header or 0), 15))
                                except ValueError:
                                    retry_after = 0
                                if retry_after > 0:
                                    await asyncio.sleep(retry_after)
                                    response = await groq_client.post(
                                        f"{base_url}/chat/completions",
                                        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
                                        json={
                                            "model": model,
                                            "messages": [
                                                {"role": "system", "content": "You are a compact planning agent. Return only valid JSON for the requested day batch."},
                                                {"role": "user", "content": prompt},
                                            ],
                                            "temperature": 0.2,
                                            "max_tokens": groq_max_tokens,
                                            "response_format": {"type": "json_object"},
                                        },
                                    )
                        if response.status_code >= 400:
                            detail_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                            detail = detail_data.get("error", {}).get("message", "") if isinstance(detail_data, dict) else ""
                            retry_after = response.headers.get("retry-after")
                            raise HTTPException(
                                status_code=response.status_code,
                                detail=f"{detail or f'Groq HTTP {response.status_code}'}{f'; retry-after: {retry_after}s' if retry_after else ''}",
                            )
                        raw = response.json()["choices"][0]["message"]["content"]

                    parsed = json.loads(raw.replace("```json", "").replace("```", "").strip())
                    batch_tasks = validate_daily_tasks(
                        parsed.get("tasks"),
                        payload.horizon_days,
                        set(range(start_day, end_day + 1)),
                    )
                    provider_tasks.extend(batch_tasks)
                    provider_batch_results.append((start_day, end_day, batch_tasks))
                    execution_logs.append({
                        "batch": f"Days {start_day}-{end_day}",
                        "provider": provider,
                        "model": model,
                        "status": "success",
                    })
                except HTTPException as exc:
                    provider_failed = True
                    provider_failed_batch = f"Days {start_day}-{end_day}"
                    provider_errors.append(f"{provider}: HTTP {exc.status_code}: {exc.detail}")
                    break
                except Exception as exc:
                    if provider == "groq":
                        try:
                            repair_prompt = (
                                prompt
                                + f"\nRepair required: the previous response was invalid ({exc}). "
                                + f"Return exactly {end_day - start_day + 1} tasks with dayOffset integers only from {start_day} through {end_day}. "
                                + "Do not return any other day number."
                            )
                            base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
                            async with httpx.AsyncClient(timeout=request_timeout) as repair_client:
                                repair_response = await repair_client.post(
                                    f"{base_url}/chat/completions",
                                    headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
                                    json={
                                        "model": model,
                                        "messages": [
                                            {"role": "system", "content": "Repair the JSON batch. Return only valid JSON with every required field and no extra text."},
                                            {"role": "user", "content": repair_prompt},
                                        ],
                                        "temperature": 0.1,
                                        "max_tokens": groq_max_tokens,
                                        "response_format": {"type": "json_object"},
                                    },
                                )
                            if repair_response.status_code < 400:
                                repair_raw = repair_response.json()["choices"][0]["message"]["content"]
                                repair_parsed = json.loads(repair_raw.replace("```json", "").replace("```", "").strip())
                                repair_tasks = validate_daily_tasks(
                                    repair_parsed.get("tasks"),
                                    payload.horizon_days,
                                    set(range(start_day, end_day + 1)),
                                )
                                provider_tasks.extend(repair_tasks)
                                provider_batch_results.append((start_day, end_day, repair_tasks))
                                execution_logs.append({
                                    "batch": f"Days {start_day}-{end_day}",
                                    "provider": provider,
                                    "model": model,
                                    "status": "success",
                                    "repair": True,
                                })
                                continue
                        except Exception as repair_exc:
                            provider_errors.append(f"{provider}: batch repair failed: {repair_exc}")
                    provider_failed = True
                    provider_failed_batch = f"Days {start_day}-{end_day}"
                    provider_errors.append(f"{provider}: {exc}")
                    break

            if provider_failed:
                continue

            validated = merge_daily_task_batches(
                provider_batch_results,
                payload.horizon_days,
            )
            if len(validated) != payload.horizon_days:
                raise ValueError(f"Missing daily tasks; expected {payload.horizon_days} unique days.")
            all_tasks = validated
            selected_provider = provider
            selected_model = model
            break
        except HTTPException as exc:
            provider_errors.append(f"{provider}: HTTP {exc.status_code}: {exc.detail}")
            continue
        except Exception as exc:
            provider_errors.append(f"{provider}: {exc}")
            continue

    if not all_tasks or not selected_provider:
        missing_days = []
        missing_batch = provider_failed_batch if provider_failed_batch else None
        missing_description = (
            f"Missing {missing_batch}"
            if missing_batch
            else f"Missing Days 1-{payload.horizon_days}"
        )
        raise HTTPException(
            status_code=429 if any("429" in error for error in provider_errors) else 502,
            detail=f"Python planning agent could not generate exactly {payload.horizon_days} unique daily tasks. {missing_description}. {'; '.join(provider_errors)}",
        )

    tasks = [{
        "title": task["title"],
        "description": task["description"],
        "priority": task["priority"].lower(),
        "estimatedHours": float(task["estimatedHours"]),
        "dayOffset": int(task["dayOffset"]),
        "dependencies": task.get("dependencies", []),
    } for task in all_tasks]
    milestones = [{
        "id": f"DAY-{task['dayOffset']}",
        "title": f"Day {task['dayOffset']}: {task['title']}",
        "description": task["description"],
        "dayOffset": task["dayOffset"],
        "tasks": [task],
    } for task in tasks]
    summary = f"A {payload.horizon_days}-day actionable roadmap with one unique task per day."

    return PlanningResponse(
        status="success",
        agent=f"Python {selected_provider.title()} Planning Agent",
        model=selected_model,
        provider=selected_provider,
        result={
            "summary": summary,
            "tasks": tasks,
            "sequence": [f"Day {day}" for day in range(1, payload.horizon_days + 1)],
            "risks": [],
            "nextActions": [],
        },
        retries=retries,
        horizonDays=payload.horizon_days,
        milestones=milestones,
        tasks=tasks,
        executionLogs=execution_logs,
    )
