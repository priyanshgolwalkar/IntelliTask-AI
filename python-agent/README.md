# IntelliTask AI Python Agent

This is a small, real FastAPI service. It exposes a health check and a Gemini-backed Python agent endpoint. It is separate from the existing Express/TypeScript orchestrator and is **not a LangGraph workflow**.

## Windows setup

Open a second terminal in this folder and run:

```powershell
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Put your Gemini API key in `.env`, then start the service:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://localhost:8000/health` or `http://localhost:8000/docs`. The IntelliTask header connection check should then show FastAPI Online.

Test the Python agent from PowerShell:

```powershell
curl.exe -X POST http://localhost:8000/api/agent/run -H "Content-Type: application/json" -d "{\"objective\":\"Create a simple 3-step study plan\"}"
```
