# 🚀 OpenSyntax: AI-Powered Polyglot Multi-Agent Workspace

OpenSyntax is a sophisticated AI-powered software development environment that orchestrates specialized agents to autonomously build, test, and refine codebases. Now featuring robust **polyglot support**, OpenSyntax bridges the gap between high-level descriptions and functioning software in Python, C, C++, Java, Go, and Rust.

![OpenSyntax UI Placeholder](https://via.placeholder.com/800x450?text=OpenSyntax+UI+Preview)

## ✨ Key Features

### 🌍 Polyglot Autonomy
Generate, build, and run code in your preferred language:
- **Languages**: Python, C, C++, Java, Go, Rust, JavaScript*, TypeScript*.
- **Auto-Build**: Automatic compilation for C/C++, Java, Go, and Rust.
- **Project Structure**: Agents intelligently structure multi-file projects with appropriate dependency files (`requirements.txt`, `go.mod`, etc.).
*(Note: Execution is currently disabled for JS/TS security, but generation is fully supported.)*

### 🤖 Autonomous Multi-Agent Orchestration
Leverage a team of specialized AI agents working in sync:
- **Architect**: Designs system structure and file organization.
- **Generator**: Writes modular, clean code implementation.
- **Tester**: Generates exhaustive test suites (pytest for Python) and verifies functionality.
- **Reviewer**: Performs quality checks and suggests optimizations.

### 🖥️ High-Performance Interactive Terminal
- **Zero-Lag Resizing**: Custom-built terminal resizing for a perfectly fluid experience.
- **Live Output Streaming**: Watch builds and tests run in real-time.
- **Persistent Shell**: A robust, interactive bash environment for manual inspection and command execution.
- **Integrated Control**: Clean, glassmorphism-inspired terminal interface that stays out of your way until needed.

### 🎙️ Voice-to-Code Integration
- **Speech Recognition**: Dictate tasks directly into the prompt using the Web Speech API.
- **Seamless Prompting**: Combine voice and text for rapid iteration.

### 💎 Premium Developer Experience
- **Modern UI**: A sleek, dark-themed design with smooth transitions and custom scrollbars.
- **Flexible LLM Backend**: Support for both **OpenAI API** and **Local LLMs** (via LM Studio/Ollama).
- **Auto-Fix Loop**: a "self-healing" mode where agents iterate on errors until the code compiles and passes tests.

## 🛠️ Tech Stack

- **Backend**: Python 3.10, FastAPI, OpenAI SDK, WebSockets.
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Framer Motion, XTerm.js, Lucide Icons.
- **Infrastructure**: Docker, Docker Compose.
- **supported Compilers**: GCC, G++, OpenJDK, Go, Rustc.

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
1. **Choose your Language**: Select Python, C++, Go, etc. from the sidebar.
2. **Describe your Task**: Provide a detailed description of the software you want to build (or use Voice input!).
3. **Generate**: Click "Generate Code" and watch the agents go to work.
4. **Interact**: Use the System Terminal to run scripts or inspect the generated files manually.

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by the OpenSyntax Team.*
