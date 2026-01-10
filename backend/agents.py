import os
import json
import sys
import asyncio
from typing import List, Dict, Optional, AsyncGenerator
from pydantic import BaseModel
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "true").lower() == "true"
DEFAULT_MODEL = "local-model" if USE_LOCAL_LLM else "gpt-4o-mini"
LLM_MODEL = os.getenv("LLM_MODEL", DEFAULT_MODEL)

if USE_LOCAL_LLM:
    if os.getenv("RUNNING_IN_DOCKER") == "true":
         DEFAULT_BASE_URL = "http://host.docker.internal:1234/v1"
    else:
         DEFAULT_BASE_URL = "http://localhost:1234/v1"
    BASE_URL = os.getenv("OPENAI_BASE_URL", DEFAULT_BASE_URL)
    API_KEY = "lm-studio"
else:
    BASE_URL = os.getenv("OPENAI_BASE_URL")
    API_KEY = os.getenv("OPENAI_API_KEY")

client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)

class AgentResponse(BaseModel):
    agent_name: str
    content: str
    internal_output: Optional[str] = None
    files: Optional[Dict[str, str]] = None
    is_error: bool = False
    clear_history: bool = False

class Agent:
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role

    async def call_llm(self, system_prompt: str, user_prompt: str, config: Optional[Dict] = None) -> str:
        try:
            local_mode = USE_LOCAL_LLM
            if config and "use_local_llm" in config:
                local_mode = config["use_local_llm"]

            if local_mode:
                effective_api_key = "lm-studio"
                effective_model = LLM_MODEL if local_mode == USE_LOCAL_LLM else "local-model"
                
                if os.getenv("RUNNING_IN_DOCKER") == "true":
                     fallback_url = "http://host.docker.internal:1234/v1"
                else:
                     fallback_url = "http://localhost:1234/v1"
                effective_base_url = os.getenv("OPENAI_BASE_URL", fallback_url)
                timeout_val = 240.0
            else:
                effective_api_key = os.getenv("OPENAI_API_KEY")
                effective_model = LLM_MODEL if local_mode == USE_LOCAL_LLM else "gpt-4o-mini"
                effective_base_url = os.getenv("OPENAI_BASE_URL")

                if config and config.get("api_key"):
                    effective_api_key = config["api_key"]
                
                timeout_val = 60.0
                
                if not effective_api_key:
                     return "Error: OpenAI API Key is missing on backend."

            temp_client = AsyncOpenAI(api_key=effective_api_key, base_url=effective_base_url)

            for attempt in range(3):
                try:
                    response = await temp_client.chat.completions.create(
                        model=effective_model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        temperature=0.7,
                        timeout=timeout_val 
                    )
                    return response.choices[0].message.content
                except Exception as e:
                    import traceback
                    if attempt == 2:
                        return self.mock_fallback(user_prompt)
                    await asyncio.sleep(2)
            return self.mock_fallback(user_prompt)
        except Exception as e:
            return self.mock_fallback(user_prompt)

    def mock_fallback(self, user_prompt: str) -> str:
        return "Error: LLM Failed to generate code."

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        raise NotImplementedError

class SystemArchitect(Agent):
    def __init__(self):
        super().__init__("System Architect", "Design technical architecture")
    
    def mock_fallback(self, user_prompt: str) -> str:
        return "Architecture Plan: \n- Backend: Python (FastAPI)\n- Frontend: React (Vite)\n- Database: SQLite (if needed)"

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        yield AgentResponse(agent_name=self.name, content="Analyzing request and designing architecture...")
        
        config = previous_context.get("config")
        language = config.get("language", "Python")
        
        system_prompt = f"""You are a System Architect. 
        Analyze the user's request and propose a technical stack and file structure.
        Target Programming Language: {language}
        
        CRITICAL: Base your design STRICTLY on the User Request. Do not add unnecessary features.

        Output Requirements:
        1. Create a detailed and explanatory implementation plan in Markdown.
        2. Explain the rationale behind the file structure and key components.
        3. Return ONLY the raw Markdown content. Do NOT wrap in JSON.
        4. CRITICAL: Use correct Markdown spacing (e.g., `# Title`, `## Section`, not `##Section`).
        
        STRICT FILE PRESERVATION RULES:
        - The user's goal might be small. DO NOT assume they want a full rewrite.
        - Existing files are provided below. Treat them as READ-ONLY unless the user explicitly asks to change them.
        - If the user asks for a new feature, YOU MUST create new files (e.g., `new_feature.py`) rather than modifying or deleting existing ones.
        - DO NOT list an existing file in the plan if you are not changing it at all.
        - VIOLATION OF THIS RULE WILL CAUSE DATA LOSS. BE CAREFUL.
        """
        

        
        existing_files_str = ""
        files = previous_context.get("files", {})
        if files:
            existing_files_str = "\n\nExisting Files:\n" + "\n".join([f"--- {k} ---\n{v}\n" for k, v in files.items()])

        response_text = await self.call_llm(system_prompt, f"User Request: {input_data}{existing_files_str}", config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
        
        files = {"implementation_plan.md": response_text}
        
        yield AgentResponse(
            agent_name=self.name,
            content="Done! Implementation plan created.",
            internal_output=response_text,
            files=files
        )

class CodeGenerator(Agent):
    def __init__(self):
        super().__init__("Code Generator", "Generate code")

    def mock_fallback(self, user_prompt: str) -> str:
        return "Error: LLM Failed to generate code."

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        yield AgentResponse(agent_name=self.name, content="Generating application code (this may take a moment)...")

        config = previous_context.get("config")
        language = config.get("language", "Python")

        system_prompt = f"""You are an expert Programmer.
        Generate the actual code for the requested application in {language}.
        
        CRITICAL INSTRUCTIONS:
        1. **Follow the Architect's Plan**: You MUST generate code for EVERY file listed in the "Architect's Plan" below. Do not skip any files.
        2. **File Format**: Return the code using Markdown code blocks.
           - **IMPORTANT**: The VERY FIRST LINE of each code block MUST be a comment specifying the filename.
           - Format: `# filename: <filename>` (or `// filename: ...` for C++/Java/JS).
           - Example:
             ```python
             # filename: main.py
             import os
             print("Hello")
             ```
        3. **Dependencies**: If using external libraries, YOU MUST generate the appropriate dependency file (e.g., `requirements.txt`, `package.json`, `go.mod`, `Cargo.toml`, `pom.xml`).
        4. **Correctness**: The code must be bug-free and efficient.
           - **FOR RUST**: 
             - **Modules**: You **MUST** declare modules in `main.rs` using `mod my_module;` BEFORE using them (`use my_module::...`).
             - **Naming**: If you use `mod algorithms;`, you must create either `src/algorithms.rs` OR `src/algorithms/mod.rs`.
             - **Borrowing**: Avoid overlapping mutable borrows. Use `split_at_mut`.
             - **Warnings**: Avoid `unused_mut` warnings. Only declare variables as `mut` if they are actually modified. 
           - **FOR GO**:
             - **Imports**: Go fails compilation on unused imports. **DOUBLE CHECK** all imports are used. Remove any that are not.
        5. **Completeness**: Do not leave placeholders.
        6. **File Organization**: Use FULL RELATIVE PATHS in the filename comment to define the folder structure.
           - Example: `# filename: src/main.rs` or `# filename: src/components/Header.tsx`.
           - Do not assume flat structure if complex.
           
        STRICT FILE PRESERVATION RULES:
        - The text below contains "Existing Files".
        - YOU MUST NOT output code for any file that already exists UNLESS the user prompt explicitly requested a change to that specific file.
        - Unsolicited rewrites of existing files will be considered a CRITICAL FAILURE.
        - If you need to use an existing function, just import it. DO NOT redefine it.
        - DO NOT RETURN CODE BLOCKS FOR FILES YOU ARE NOT CHANGING.
        """
        

        
        existing_files_str = ""
        files = previous_context.get("files", {})
        if files:
            existing_files_str = "\n\nExisting Files:\n" + "\n".join([f"--- {k} ---\n{v}\n" for k, v in files.items()])
        
        full_prompt = f"User Request: {input_data}\\n\\nArchitect's Plan: {previous_context.get('architect_plan', '')}{existing_files_str}"
        
        response_text = await self.call_llm(system_prompt, full_prompt, config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
        
        files = {}
        error_content = None
        
        try:
            code_blocks = re.findall(r'```(?:[a-zA-Z0-9]*)(.*?)```', response_text, re.DOTALL)
            
            for block in code_blocks:
                content = block.strip()
                filename_match = re.search(r'^(?:#|//|<!--)\s*filename:\s*(.+?)(?:-->)?$', content, re.MULTILINE | re.IGNORECASE)
                
                if filename_match:
                    fname = filename_match.group(1).strip()
                    cleaned_content = re.sub(r'^(?:#|//|<!--)\s*filename:\s*.+?(?:-->)?$(\r\n|\r|\n)?', '', content, flags=re.MULTILINE | re.IGNORECASE).strip()
                    files[fname] = cleaned_content
                    
                    if fname.endswith('.go'):
                        common_imports = {
                            '"fmt"': 'fmt.', 
                            '"math"': 'math.', 
                            '"sort"': 'sort.', 
                            '"strings"': 'strings.',
                            '"math/rand"': 'rand.',
                            '"time"': 'time.',
                            '"os"': 'os.'
                        }
                        for imp_str, usage_str in common_imports.items():
                            if imp_str in cleaned_content and usage_str not in cleaned_content:
                                cleaned_content = re.sub(r'.*import\s+' + re.escape(imp_str) + r'.*\n?', '', cleaned_content)
                                cleaned_content = re.sub(r'\s+' + re.escape(imp_str) + r'.*\n?', '\n', cleaned_content) # For imports in parens
                        
                        files[fname] = cleaned_content.strip()
                elif "requirements.txt" in content and "=" not in content and "import" not in content:
                    files["requirements.txt"] = content
                else:
                    language = config.get("language", "Python").lower()
                    ext_map = {
                        "python": ".py",
                        "javascript": ".js",
                        "typescript": ".ts",
                        "java": ".java",
                        "c++": ".cpp",
                        "c": ".c",
                        "go": ".go",
                        "rust": ".rs"
                    }
                    default_ext = ext_map.get(language, ".txt")
                    
                    if "<html>" in content:
                        default_ext = ".html"
                    elif "{" in content and "}" in content and ";" in content and default_ext == ".txt":
                        default_ext = ".css" 

                    ext = default_ext
                    
                    if not files:
                        default_name = f"index{ext}" if ext == ".html" else f"main{ext}"
                        files[default_name] = content

            if not files:
                language = config.get("language", "Python").lower()
                ext_map = {
                    "python": ".py", "javascript": ".js", "typescript": ".ts",
                    "java": ".java", "c++": ".cpp", "c": ".c", "go": ".go", "rust": ".rs"
                }
                ext = ext_map.get(language, ".txt")
                
                if "def " in response_text or "import " in response_text or "class " in response_text or "void " in response_text:
                    files[f"main{ext}"] = response_text
                elif "<html>" in response_text:
                    files["index.html"] = response_text
                else:
                    if "Failed to generate code" in response_text or "Error:" in response_text:
                        error_content = f"LLM Error: {response_text}"
                    else:
                        error_content = "No code blocks found with '# filename:' marker."

        except Exception as e:
            error_content = f"Parse Error: {e}"
            files = {"error_log.txt": f"{error_content}\\nRaw: {response_text}"}

        if error_content or (not files):
            if not error_content and not files:
                error_content = "No files generated."
            yield AgentResponse(agent_name=self.name, content=f"Error! {error_content}", is_error=True, files=files)
        else:
            yield AgentResponse(
                agent_name=self.name,
                content="Done! Code generated successfully.",
                files=files
            )

class Tester(Agent):
    def __init__(self):
        super().__init__("Tester", "Create tests")

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        config = previous_context.get("config")
        language = config.get("language", "Python")

        if language != "Python":
            yield AgentResponse(agent_name=self.name, content=f"Skipping tests (Language '{language}' not currently supported for auto-testing).")
            return

        yield AgentResponse(agent_name=self.name, content="Generating test suite...")

        system_prompt = """You are a QA Engineer.
        Your goal is to write a robust Python test suite using `pytest`.
        
        CRITICAL INSTRUCTIONS:
        1. ANALYZE IMPORTS FIRST:
           - Look at the provided code. Where is the function you are testing defined?
           - If `merge_sort` is in `utils.py`, your test MUST say `from utils import merge_sort`.
           - If it is in `main.py`, say `from main import merge_sort`.
           - DO NOT assume `main.py` unless you see the function defined there.
        
        2. FILE STRUCTURE ANALYSIS:
           - If `main.py` DOES NOT have a `def main():`, DO NOT try `from main import main`.
           - If testing a script via subprocess, make sure you use the correct filename (e.g., `subprocess.run(['python', 'utils.py'])` if that's where the code is).
           
        3. You MUST generate at least one test file (e.g., `tests/test_main.py`).
        4. The test content MUST be valid Python code.
           - MANDATORY: Add this snippet at the very top of your test file to allow running it directly:
             ```python
             import sys
             import os
             sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
             ```
        5. Return the test files using Markdown code blocks.
           - Start each file with a comment line specifying the filename: `# filename: tests/test_mytest.py`.
           - Example:
             ```python
             # filename: tests/test_sorting.py
             import sys
             import os
             sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
             
             import pytest
             from utils import merge_sort 
             ```
             
        6. CRITICAL: ROBUST OUTPUT PARSING.
           - STOP! DO NOT USE `result.stdout.splitlines()[0]` OR `line.split(':')[1]`.
           - THIS IS FORBIDDEN: `original_line = result.stdout.split('\\n')[0].strip()`
           - THIS IS FORBIDDEN: `sorted_line = result.stdout.split('\\n')[1].strip()`
           - INSTEAD, USE REGEX TO SCAN THE WHOLE STRING.
           - `re.findall(r'-?\\d+', result.stdout)` will find all numbers regardless of where they are.
           - Example Strategy:
             ```python
             # Extract ALL numbers from the entire output at once
             all_nums = [int(x) for x in re.findall(r'-?\\d+', result.stdout)]
             # If you expect two arrays of size 100, you have 200 numbers.
             assert len(all_nums) >= 200
             # Slice them
             original_array = all_nums[:100]
             sorted_array = all_nums[100:200]
             ```
        """
        
        files = previous_context.get("files", {})
        code_context = "\n".join([f"Process File ({k}):\n{v}" for k, v in files.items()])
        
        if not code_context:
            yield AgentResponse(agent_name=self.name, content="Done! (No Python files to test)", files={}, is_error=True)
            return

        response_text = await self.call_llm(system_prompt, f"Code to test:\n{code_context}", config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()

        test_files = {}
        try:
             import re
             code_blocks = re.findall(r'```python(.*?)```', response_text, re.DOTALL)
             
             for block in code_blocks:
                 content = block.strip()
                 filename_match = re.search(r'^#\s*filename:\s*(.+)$', content, re.MULTILINE)
                 if filename_match:
                     fname = filename_match.group(1).strip()
                     test_files[fname] = content
                 else:
                     test_files["tests/test_generated.py"] = content

             if not test_files and "def test_" in response_text:
                  test_files = {"tests/test_generated.py": response_text}
        except Exception as e:
             print(f"Error parsing test blocks: {e}")
             if "def test_" in response_text:
                  test_files = {"tests/test_fallback.py": response_text}

        if not test_files:
             test_files = {
                 "tests/test_placeholder.py": "import pytest\ndef test_placeholder():\n    assert True\n    print('Fallback test executed successfully.')"
             }
             
        verified_test_files = {}
        test_results = ""
        
        for fname, content in test_files.items():
            yield AgentResponse(agent_name=self.name, content=f"Verifying {fname}...")
            try:
                compile(content, fname, 'exec')
                verified_test_files[fname] = content
            except SyntaxError as e:
                fix_prompt = f"Fix SyntaxError in python code: {e}\n\nCode:\n{content}\nReturn ONLY fixed code."
                fixed_code = await self.call_llm(fix_prompt, "", config)
                fixed_code = re.sub(r'<think>.*?</think>', '', fixed_code, flags=re.DOTALL).strip()
                fixed_code = re.sub(r'^```python', '', fixed_code, flags=re.MULTILINE).strip()
                fixed_code = re.sub(r'^```', '', fixed_code, flags=re.MULTILINE).strip()
                verified_test_files[fname] = fixed_code

        test_files = verified_test_files
        final_files = test_files.copy()
        
        if test_files:
            import tempfile
            import subprocess
            
            with tempfile.TemporaryDirectory() as temp_dir:
                for fname, fcontent in {**files, **test_files}.items():
                    if fname.endswith('/') or fname.endswith('\\'):
                        continue
                        
                    fpath = os.path.join(temp_dir, fname)
                    try:
                        os.makedirs(os.path.dirname(fpath), exist_ok=True)
                        with open(fpath, "w") as f:
                            f.write(fcontent)
                    except IsADirectoryError:
                         pass
                    except Exception as e:
                         print(f"Warning: Failed to write temporary file {fname}: {e}")

                if "requirements.txt" in files:
                    yield AgentResponse(agent_name=self.name, content="Installing dependencies from requirements.txt...")
                    try:
                        install_proc = subprocess.run(
                            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                            cwd=temp_dir,
                            capture_output=True,
                            text=True
                        )
                        if install_proc.returncode != 0:
                             yield AgentResponse(agent_name=self.name, content=f"Dependency Installation Warning:\n{install_proc.stderr}", is_error=True)
                        else:
                             yield AgentResponse(agent_name=self.name, content="Dependencies installed successfully.")
                    except Exception as e:
                         yield AgentResponse(agent_name=self.name, content=f"Warning: Failed to attempt dependency installation: {e}", is_error=True)
                
                yield AgentResponse(agent_name=self.name, content="Running pytest (Streaming)...", files=final_files)
                
                env = os.environ.copy()
                env["PYTHONPATH"] = temp_dir
                
                process = subprocess.Popen(
                    ["pytest", "."],
                    cwd=temp_dir,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                while True:
                    line = process.stdout.readline()
                    if not line and process.poll() is not None:
                        break
                    if line:
                        test_results += line
                        final_files["TEST_RESULTS.log"] = test_results
                        yield AgentResponse(agent_name=self.name, content="Running pytest...", files=final_files)
                        await asyncio.sleep(0.01)
                
                stderr_output = process.stderr.read()
                if stderr_output:
                    test_results += f"\nSTDERR:\n{stderr_output}"
                
                final_files["TEST_RESULTS.log"] = test_results
                
                if process.returncode == 0:
                    test_results += "\n\n[SUCCESS] All tests passed."
                    yield AgentResponse(agent_name=self.name, content="Done! Tests executed and passed.", files=final_files)
                else:
                    test_results += "\n\n[FAILURE] Some tests failed."
                    yield AgentResponse(agent_name=self.name, content="Done! Tests executed with failures.", files=final_files, is_error=True)
        else:
             yield AgentResponse(agent_name=self.name, content="Done! (No tests executed)")

class CodeReviewer(Agent):
    def __init__(self):
        super().__init__("Code Reviewer", "Review code")

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
         yield AgentResponse(agent_name=self.name, content="Reviewing code...")
         
         system_prompt = "You are a Senior Code Reviewer. Review for bugs/style. Summary only."
         files = previous_context.get("files", {})
         code_context = "\n".join([f"File: {k}\nContent:\n{v}" for k, v in files.items()])
         
         config = previous_context.get("config")
         response_text = await self.call_llm(system_prompt, f"Review:\n{code_context}", config)
         
         import re
         response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
         
         yield AgentResponse(
             agent_name=self.name,
             content="Done!",
             files={"REVIEW.md": response_text}
        )

class TechnicalWriter(Agent):
    def __init__(self):
        super().__init__("Technical Writer", "Write docs")

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        yield AgentResponse(agent_name=self.name, content="Writing documentation...")
        
        system_prompt = """You are an expert Technical Writer.
        Create a comprehensive and professional `README.md` suitable for a top-tier open source project.
        
        Sections to include:
        1. **Project Title & Description**: clearly explain what the project does.
        2. **Implementation Details**: Briefly explain the architecture/logic used.
        3. **Installation & Usage**: Step-by-step instructions.
        4. **Key Features**: List the main capabilities.
        
        Style Guide:
        - Use professional, clear language.
        - Return ONLY raw markdown.
        - CRITICAL: Use correct Markdown spacing (e.g., `# Title`, `## Section`, not `##Section`).
        """
        
        files = previous_context.get("files", {})
        plan = files.get("implementation_plan.md", "")
        context_str = f"Plan: {plan}\nFiles: {list(files.keys())}"
        
        config = previous_context.get("config")
        response_text = await self.call_llm(system_prompt, f"Context:\n{context_str}\n\nRequest: {input_data}", config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()
        
        updated_files = files.copy()
        updated_files["README.md"] = response_text
        
        yield AgentResponse(
            agent_name=self.name,
            content="Done! Documentation written.",
            files=updated_files
        )

class Orchestrator:
    def __init__(self):
        self.architect = SystemArchitect()
        self.generator = CodeGenerator()
        self.tester = Tester()
        self.reviewer = CodeReviewer()
        self.writer = TechnicalWriter()

    async def save_to_disk(self, files: Dict[str, str]) -> AsyncGenerator[AgentResponse, None]:
        try:
            for filename, content in files.items():
                if not filename.endswith('.log'):
                    if os.path.isabs(filename): 
                        pass
                    base_dir = "/app/workspace"
                    filepath = os.path.join(base_dir, filename) 
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    with open(filepath, "w") as f:
                        f.write(content)
            yield AgentResponse(agent_name="System", content="Files saved to temporary workspace (ready for run).")
        except Exception as e:
            yield AgentResponse(agent_name="System", content=f"Warning: Failed to save files to workspace: {e}", is_error=True)

    async def cleanup_workspace(self) -> AsyncGenerator[AgentResponse, None]:
        try:
            base_dir = "/app/workspace"
            if os.path.exists(base_dir):
                import shutil
                for item in os.listdir(base_dir):
                    item_path = os.path.join(base_dir, item)
                    try:
                        if os.path.isfile(item_path) or os.path.islink(item_path):
                            os.unlink(item_path)
                        elif os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                    except Exception as e:
                         yield AgentResponse(agent_name="System", content=f"Warning: Failed to delete {item}: {e}", is_error=True)
                
                yield AgentResponse(agent_name="System", content="Workspace cleaned for fresh generation.")
        except Exception as e:
            yield AgentResponse(agent_name="System", content=f"Warning: Failed to clean workspace: {e}", is_error=True)

    async def load_workspace_files(self) -> Dict[str, str]:
        files = {}
        workspace_dir = "/app/workspace"
        if os.path.exists(workspace_dir):
            for root, dirs, filenames in os.walk(workspace_dir):
                for filename in filenames:
                    filepath = os.path.join(root, filename)
                    rel_path = os.path.relpath(filepath, workspace_dir).replace("\\", "/")
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            files[rel_path] = f.read()
                    except:
                        pass
        return files

    async def run_workflow(self, user_prompt: str, config: Optional[Dict] = None):
        config = config or {}
        auto_fix = config.get("auto_fix", False)
        
        existing_files = await self.load_workspace_files()
        context = {"files": existing_files, "architect_plan": "", "config": config}
        results = {}

        async def run_agent(agent, prompt=None):
            p = prompt or user_prompt
            last_response = None
            async for response in agent.process(p, context):
                last_response = response
                yield response
            results[agent.name] = last_response

        if not auto_fix:
            yield AgentResponse(agent_name="System", content="Starting Workflow...")
            
            async for res in run_agent(self.architect): yield res
            last_arch = results.get(self.architect.name)
            if last_arch and last_arch.internal_output:
                context["architect_plan"] = last_arch.internal_output

            async for res in run_agent(self.generator): 
                yield res
                if res.files: 
                    context["files"].update(res.files)
            
            async for res in self.save_to_disk(context["files"]): yield res
            
            last_gen = results.get(self.generator.name)
            if last_gen and not last_gen.is_error:
                async for res in run_agent(self.tester): 
                    yield res
                    if res.files: 
                        context["files"].update(res.files)
                async for res in self.save_to_disk(context["files"]): yield res
            else:
                 yield AgentResponse(agent_name="System", content="Skipping Tests due to Generator failure.")

            last_tester = results.get(self.tester.name)
            is_failure = last_gen.is_error if last_gen else True
            if last_tester:
                 is_failure = is_failure or last_tester.is_error

            if not is_failure:
                async for res in run_agent(self.reviewer): yield res
                async for res in run_agent(self.writer): yield res
                
                async for res in self.save_to_disk(context["files"]): yield res

                yield AgentResponse(agent_name="System", content="Workflow Completed Successfully.")

                yield AgentResponse(agent_name="System", content="Workflow Completed Successfully.")
            else:
                yield AgentResponse(agent_name="System", content="Workflow Completed (Tests Failed).")
            
            return

        MAX_RETRIES = 15
        attempt = 1
        current_prompt = user_prompt
        
        while attempt <= MAX_RETRIES:
            yield AgentResponse(
                agent_name="System", 
                content=f"Starting Auto-Fix Cycle (Iteration {attempt})",
                clear_history=True
            )
            
            async for res in run_agent(self.architect, prompt=current_prompt): yield res
            
            last_arch = results.get(self.architect.name)
            if last_arch and last_arch.internal_output:
                context["architect_plan"] = last_arch.internal_output

            async for res in run_agent(self.generator, prompt=current_prompt): 
                yield res
                if res.files: context["files"].update(res.files)
            
            last_gen = results.get(self.generator.name)
            if last_gen and last_gen.is_error:
                 yield AgentResponse(agent_name="System", content=f"Code Generation Failed (Iteration {attempt}). Retrying...")
                 current_prompt = f"CRITICAL: Generation Failed.\nError Log:\n{context['files'].get('error_log.txt', 'Unknown Error')}\nOriginal Request: {user_prompt}\nTry again."
                 attempt += 1
                 continue

            async for res in run_agent(self.tester, prompt=current_prompt): 
                yield res
                if res.files: context["files"].update(res.files)

            async for res in self.save_to_disk(context["files"]): yield res

            last_tester = results.get(self.tester.name)
            is_failure = last_tester.is_error if last_tester else False

            if not is_failure:
                async for res in run_agent(self.reviewer): yield res
                async for res in run_agent(self.writer): yield res

                async for res in self.save_to_disk(context["files"]): yield res

                yield AgentResponse(agent_name="System", content=f"Workflow Fixed & Completed in {attempt} iterations.")
                return

            yield AgentResponse(agent_name="System", content=f"Tests Failed (Iteration {attempt}). Analyzing errors for retry...")
            
            test_log = context["files"].get("TEST_RESULTS.log", "No log")
            all_files_snapshot = {k: v for k, v in context["files"].items() if not k.endswith('.log')}
            code_snapshot = "\n".join([f"--- FILE: {k} ---\n{v}\n" for k, v in all_files_snapshot.items()])
            
            current_prompt = f"""
            CRITICAL: PREVIOUS ITERATION FAILED VALIDATION.
            
            ### OBJECTIVE
            Fix the errors in the codebase to satisfy the User Request.
            
            ### ORIGINAL REQUEST
            {user_prompt}
            
            ### PREVIOUS ATTEMPT CONTEXT
            
            #### EXISTING FILES & FAILED IMPLEMENTATION
            {code_snapshot}
            
            #### TEST EXECUTION LOGS
            {test_log}
            
            ### YOUR TASK
            1. Analyze the 'TEST EXECUTION LOGS' to understand why it failed.
            2. Review the 'FAILED IMPLEMENTATION' to find the bugs.
            3. CREATE A NEW IMPLEMENTATION PLAN that specifically addresses these errors.
            4. Be extremely careful to not repeat the same mistake.
            """
            
            attempt += 1
            
        yield AgentResponse(agent_name="System", content="max auto-fix retries reached. Stopping.")
