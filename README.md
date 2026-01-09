# AI Training Project

A multi-agent system designed for automated code generation, testing, and documentation using Large Language Models (LLMs). This project utilizes a backend based on Python (FastAPI) and a frontend in React.

## Key Features

- **Multi-Agent Architecture**: Orchestrates specialized agents (Architect, Code Generator, Tester, Reviewer) to build software autonomously.
- **Local LLM Support**: Designed to work with local models via LM Studio.
- **Real-time Streaming**: improved WebSocket implementation for real-time feedback.
- **Automated Testing**: Integrated pytest execution for generated code.

## Implementation Details

The system follows a pipeline approach:
1.  **System Architect**: Analyze requirements and plan structure.
2.  **Code Generator**: Write the actual code.
3.  **Tester**: Generate and run tests to verify functionality.
4.  **Reviewer**: Check code quality.

## Installation & Usage

1.  **Backend Setup**:
    ```bash
    cd backend
    pip install -r requirements.txt
    python -m uvicorn main:app --reload
    ```

2.  **Frontend Setup**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

    - Ensure LM Studio is running on port `1234` with a local server enabled.

4.  **Docker Setup**:
    Alternatively, you can run the entire stack using Docker Compose:
    ```bash
    docker-compose up --build
    ```
    This will start both the backend (port 8000) and frontend (port 3000) automatically.

## Testing Verification

**Note**: Testing of this project was performed using **LM Studio** with a **local model** to generate relatively simple Python files. The system is optimized for this workflow to ensure privacy and offline capability.
