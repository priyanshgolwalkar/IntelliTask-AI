# IntelliTask AI
### Autonomous Task Planning and Execution Platform

IntelliTask AI is an AI-powered task planning and management platform designed to transform high-level user objectives into structured, actionable tasks.

The project explores Agentic AI concepts through LLM integration, task decomposition, specialized agent roles, AI-assisted planning and task management. Users can describe their goals in natural language, generate structured plans and manage the resulting tasks through a centralized dashboard.

---

## Project Overview

Traditional task management applications require users to manually create, organize and prioritize tasks.

IntelliTask AI aims to simplify this process by using AI-assisted reasoning and planning to convert user objectives into manageable workflows.

The platform combines a React-based frontend, Node.js backend and Python planning service with large language model integrations.

## Key Features

- **AI Assistant:** Interact with an AI-powered assistant to understand objectives and generate contextual responses.
- **AI Task Planner:** Convert high-level goals into structured, multi-day plans.
- **Task Management:** Organize tasks through a centralized backlog with priorities and workflow statuses.
- **Multi-Agent Architecture:** Define specialized roles for orchestration, research, planning, code generation and quality verification.
- **Agent Monitoring:** View configured agent roles and their displayed execution status.
- **Deadline Calculation:** Calculate working-day schedules and deadline-related information.
- **Task Persistence:** Store task information using Firebase Authentication and Cloud Firestore.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Planning Service | Python, FastAPI |
| AI Models | Google Gemini, Groq |
| Database | Firebase Cloud Firestore |
| Authentication | Firebase Authentication |
| Development Tools | Git, GitHub, VS Code |

## System Architecture

The application follows a multi-layer architecture:

1. **Presentation Layer:** React frontend provides the dashboard, AI Assistant, Planner and Task Management interfaces.
2. **Backend Layer:** Node.js and Express.js handle application APIs and backend operations.
3. **AI Planning Layer:** Python FastAPI service supports structured planning and task generation.
4. **LLM Integration Layer:** Gemini and Groq provide language-model capabilities.
5. **Data Layer:** Firebase Authentication and Cloud Firestore support authentication and task persistence.

## Specialized Agent Roles

The application defines six specialized agent roles:

| Agent | Responsibility |
|---|---|
| Supervisor Orchestrator | Coordinates workflow operations |
| Research Specialist | Intended for technical research and information synthesis |
| Planner Architect | Decomposes objectives into milestones and tasks |
| Python Planning Agent | Generates structured plans through the FastAPI service |
| Code Generator | Supports code and implementation generation |
| QA & Verification Guard | Represents validation and quality-checking responsibilities |

**Note:** These roles represent the application's agent architecture. The current implementation uses application-level coordination. Independent autonomous execution of every role has not been verified.

## Project Workflow

1. User enters a high-level objective.
2. The application processes the request.
3. The AI planning service generates a structured plan.
4. Generated tasks are presented through the Planner interface.
5. The user can import the generated tasks into the backlog.
6. Tasks are managed through the Task Management interface.
7. The user remains in control of reviewing and managing the generated work.

## Project Structure

The following is a logical representation of the application structure. Adjust directory names to match the actual repository.

```text
IntelliTask-AI/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   └── package.json
│
├── planning-service/
│   ├── app/
│   └── requirements.txt
│
├── README.md
└── .gitignore
```

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Python 3.10 or later
- Git
- Firebase project configuration
- Gemini or Groq API credentials

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/IntelliTask-AI.git

cd IntelliTask-AI
```

### 2. Configure Environment Variables

Create the required `.env` files using the environment variable names expected by the application.

Typical configuration includes:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

Configure Firebase credentials and frontend/backend service URLs according to the application configuration.

**Never commit API keys, private credentials or service account files to GitHub.**

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

Start the frontend using the configured development script:

```bash
npm run dev
```

### 4. Install Backend Dependencies

Open another terminal and navigate to the backend directory.

```bash
cd backend
npm install
```

Start the backend using its configured development script.

### 5. Configure the Python Planning Service

```bash
cd planning-service

python -m venv .venv
```

Activate the virtual environment.

Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI service using the application's configured entry point.

For example:

```bash
uvicorn main:app --reload
```

The exact entry point and commands may vary according to the project configuration.

## Testing and Validation

The prototype was tested through application-level workflows and development validation.

| Test Scenario | Observed Result |
|---|---|
| User authentication | Working |
| AI Assistant response generation | Demonstrated |
| Seven-day AWS learning plan | Successfully generated |
| Importing generated tasks into backlog | Demonstrated |
| Task persistence after browser refresh | Demonstrated |
| Agent Monitoring interface | Loads successfully |
| Research Center interface | Loads successfully |
| Live external research retrieval | No results returned in final verification |

The latest reported Python test run contained 13 passing tests. Frontend linting and production build checks also passed during development.

## Current Limitations

- Live research retrieval did not return results during final verification.
- Persistent agent memory has not been implemented or verified.
- All six agent roles are configured in the interface, but independent autonomous execution of every role has not been demonstrated.
- AI model availability and response quality depend on external provider services, quotas and API configurations.

## Future Enhancements

- Implement persistent agent memory.
- Improve external research and retrieval integrations.
- Introduce more robust multi-agent coordination.
- Add automated task execution and verification.
- Improve monitoring, logging and execution metrics.
- Introduce advanced planning and dependency management.

## Applications

IntelliTask AI can be extended for:

- Academic planning and study management.
- Technical project planning.
- Software development workflows.
- Personal productivity.
- Learning roadmaps and skill development.
- Team task coordination.

## Academic Project

**Project Title:** IntelliTask AI – Autonomous Task Planning and Execution Platform

**Subject:** Agentic Artificial Intelligence

**Project Type:** Individual Mini Project

**Student:** Priyansh Golwalkar

**Enrollment Number:** ADT23SOCB0808

**Department:** Computer Science and Engineering

**Institution:** MIT ADT University, Pune

---

## License

This project is developed for academic and educational purposes. Add an appropriate open-source license before permitting reuse or redistribution.

---

**IntelliTask AI – Turning objectives into actionable workflows.**
