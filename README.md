# 🤖 AgentForge: AI-Powered Multi-Agent Workspace

AgentForge is a sophisticated multi-agent software development environment that orchestrates specialized AI agents to autonomously build, test, and refine codebases. Featuring a high-performance interactive terminal, real-time feedback, and voice-to-code capabilities, AgentForge bridges the gap between high-level descriptions and functioning software.

![AgentForge UI Placeholder](https://via.placeholder.com/800x450?text=AgentForge+UI+Preview)

## ✨ Key Features

### 🚀 Autonomous Multi-Agent Orchestration
Leverage a team of specialized AI agents working in sync:
- **Architect**: Designs system structure and file organization.
- **Generator**: Writes modular, clean code implementation.
- **Tester**: Generates exhaustive pytest suites and verifies functionality.
- **Reviewer**: Performs quality checks and suggests optimizations.

### 🖥️ High-Performance Interactive Terminal
- **Zero-Lag Resizing**: Custom-built terminal resizing with `requestAnimationFrame` for a perfectly fluid experience.
- **Live Pytest Streaming**: Watch tests run in real-time with piped output directly from the container.
- **Persistent Shell**: A robust, interactive bash environment for manual inspection and command execution.

### 🎙️ Voice-to-Code Integration
- **Speech Recognition**: Dictate tasks directly into the prompt using the Web Speech API (localized for Italian).
- **Seamless Prompting**: Combine voice and text for rapid iteration.

### 💎 Premium Developer Experience
- **Modern UI**: A sleek, glassmorphism-inspired design with dark mode, smooth transitions, and custom scrollbars.
- **Flexible LLM Backend**: Support for both **OpenAI API** and **Local LLMs** (via LM Studio/Ollama).
- **Ephemeral Workspace**: Robust file persistence at `/tmp/agent_workspace` ensuring the container environment remains clean yet persistent during sessions.

## 🛠️ Tech Stack

- **Backend**: Python 3.10, FastAPI, OpenAI SDK, WebSockets, Pytest.
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Framer Motion, XTerm.js, Lucide Icons.
- **Infrastructure**: Docker, Docker Compose.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose installed.
- (Optional) [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.ai/) for local LLM support.

### 1. Configure Environment
Create a `.env` file in the root directory (refer to `.env.example`):
```env
OPENAI_API_KEY=your_key_here
LLM_MODEL=gpt-4o-mini  # or your local model identifier
USE_LOCAL_LLM=false
```

### 2. Launch with Docker
```bash
docker-compose up --build
```
Once initialized, access the workspace at:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`

### 3. Usage
1. **Choose your LLM**: Toggle between Local and OpenAI in the sidebar.
2. **Describe your Task**: Provide a detailed description of the software you want to build.
3. **Generate**: Click "Generate Code" and watch the agents go to work.
4. **Interact**: Use the System Terminal to run scripts or inspect the generated files manually.

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by the AgentForge Team.*
