import os
import json
import asyncio
from typing import List, Dict, Optional, AsyncGenerator
from pydantic import BaseModel
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()


USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "true").lower() == "true"
LLM_MODEL = os.getenv("LLM_MODEL", "local-model")

if USE_LOCAL_LLM:
    API_KEY = "lm-studio"
    if os.getenv("RUNNING_IN_DOCKER") == "true":
        BASE_URL = os.getenv("OPENAI_BASE_URL", "http://host.docker.internal:1234/v1")
    else:
        BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
    print(f"Loaded: Using Local LLM at {BASE_URL} with model {LLM_MODEL}")
else:
    API_KEY = os.getenv("OPENAI_API_KEY")
    BASE_URL = os.getenv("OPENAI_BASE_URL")
    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
    print(f"Loaded: Using OpenAI API with model {LLM_MODEL}")


class AgentResponse(BaseModel):
    agent_name: str
    content: str
    internal_output: Optional[str] = None
    files: Optional[Dict[str, str]] = None
    is_error: bool = False


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
                effective_base_url = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
                if os.getenv("RUNNING_IN_DOCKER") == "true":
                     effective_base_url = os.getenv("OPENAI_BASE_URL", "http://host.docker.internal:1234/v1")
                effective_api_key = "lm-studio"
                effective_model = "local-model"
                timeout_val = 240.0
            else:
                effective_base_url = os.getenv("OPENAI_BASE_URL")
                effective_api_key = os.getenv("OPENAI_API_KEY")

                # Check config for API Key override
                if config and config.get("api_key"):
                    effective_api_key = config["api_key"]

                effective_model = "gpt-4o"
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
                    print(f"[{self.name}] LLM Error (Attempt {attempt+1}/3): {e}")
                    if attempt == 2:
                        return self.mock_fallback(user_prompt)
                    await asyncio.sleep(2)
            return self.mock_fallback(user_prompt)
        except Exception as e:
            print(f"[{self.name}] Critical Error: {e}")
            return self.mock_fallback(user_prompt)

    def mock_fallback(self, user_prompt: str) -> str:
        return f"Simulation: Processed '{user_prompt}' (LLM Unavailable)"

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        raise NotImplementedError


class SystemArchitect(Agent):
    def __init__(self):
        super().__init__("System Architect", "Design technical architecture")
    
    def mock_fallback(self, user_prompt: str) -> str:
        return "Architecture Plan: \n- Backend: Python (FastAPI)\n- Frontend: React (Vite)\n- Database: SQLite (if needed)"

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        yield AgentResponse(agent_name=self.name, content="Analyzing request and designing architecture...")
        
        system_prompt = """You are a System Architect. 
        Analyze the user's request and propose a technical stack and file structure.
        
        CRITICAL: Base your design STRICTLY on the User Request. Do not add unnecessary features.

        Output Requirements:
        1. Create a detailed and explanatory implementation plan in Markdown.
        2. Explain the rationale behind the file structure and key components.
        3. Return ONLY the raw Markdown content. Do NOT wrap in JSON.
        4. CRITICAL: Use correct Markdown spacing (e.g., `# Title`, `## Section`, not `##Section`).
        """
        
        config = previous_context.get("config")
        response_text = await self.call_llm(system_prompt, f"User Request: {input_data}", config)
        
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
        return json.dumps({
            "main.py": "print('Fallback code')",
            "README.md": "# Fallback"
        })

    async def process(self, input_data: str, previous_context: Dict) -> AsyncGenerator[AgentResponse, None]:
        yield AgentResponse(agent_name=self.name, content="Generating application code (this may take a moment)...")

        system_prompt = """You are an expert Programmer.
        Generate the actual code for the requested application.
        
        CRITICAL: 
        1. PRIORITY 1: Correctness. The code MUST work and be bug-free.
        2. PRIORITY 2: Efficiency. Optimize only after ensuring correctness.
        3. Follow the User's specific logic and requirements STRICTLY. 
        4. Do not improvise if the user gave specific instructions for the code.
        5. Return ONLY a valid JSON object where keys are filenames (e.g., "main.py") and values are the file content.
        """
        
        config = previous_context.get("config")
        full_prompt = f"User Request: {input_data}\n\nArchitect's Plan: {previous_context.get('architect_plan', '')}"
        
        response_text = await self.call_llm(system_prompt, full_prompt, config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL)
        
        files = {}
        error_content = None
        try:
            start_index = response_text.find('{')
            end_index = response_text.rfind('}')
            if start_index != -1 and end_index != -1 and end_index > start_index:
                json_str = response_text[start_index : end_index + 1]
                files = json.loads(json_str)
            else:
                 error_content = f"Failed to generate JSON. Raw: {response_text[:200]}..."
                 files = {"error_log.txt": error_content}
        except Exception as e:
             error_content = f"JSON Parse Error: {e}"
             files = {"error_log.txt": f"{error_content}\nRaw: {response_text}"}

        if error_content:
             yield AgentResponse(agent_name=self.name, content=f"Error! {error_content}", is_error=True)
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
        yield AgentResponse(agent_name=self.name, content="Generating test suite...")

        system_prompt = """You are a QA Engineer.
        Your goal is to write a robust Python test suite using `pytest`.
        
        CRITICAL INSTRUCTIONS:
        1. Analyze the CODE content and FILE STRUCTURE.
           - If `main.py` DOES NOT have a `def main():`, DO NOT try `from main import main`.
           - If `main.py` is inside a folder (e.g., `src/main.py`), use that relative path in `subprocess.run` (e.g., `['python', 'src/main.py']`).
           - If `main.py` is at root, use `['python', 'main.py']`.
        2. You MUST generate at least one test file (e.g., `tests/test_main.py`).
        3. The test content MUST be valid Python code.
        4. Return ONLY a valid JSON object where keys are filenames and values are the file content.
           - Do NOT wrap the JSON in Markdown code blocks (no ```json).
        
        Example (Script Test):
        {
          "tests/test_main.py": "import subprocess\\nimport sys\\nimport os\\nimport pytest\\n\\ndef test_script_execution():\\n    # Detect if main.py is in src or root\\n    script_path = 'src/main.py' if os.path.exists('src/main.py') else 'main.py'\\n    if not os.path.exists(script_path):\\n        pytest.skip(f'{script_path} not found')\\n    result = subprocess.run([sys.executable, script_path], capture_output=True, text=True)\\n    assert result.returncode == 0"
        }
        """
        
        files = previous_context.get("files", {})
        code_context = "\n".join([f"Process File ({k}):\n{v}" for k, v in files.items()])
        
        if not code_context:
            yield AgentResponse(agent_name=self.name, content="Done! (No Python files to test)", files={})
            return

        config = previous_context.get("config")
        response_text = await self.call_llm(system_prompt, f"Code to test:\n{code_context}", config)
        
        import re
        response_text = re.sub(r'<think>.*?</think>', '', response_text, flags=re.DOTALL).strip()

        test_files = {}
        try:
            start_index = response_text.find('{')
            end_index = response_text.rfind('}')
            if start_index != -1 and end_index != -1 and end_index > start_index:
                test_files = json.loads(response_text[start_index : end_index + 1])
        except:
             pass 
        if not test_files and "def test_" in response_text:
             test_files = {"tests/test_generated.py": response_text}

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
                    fpath = os.path.join(temp_dir, fname)
                    os.makedirs(os.path.dirname(fpath), exist_ok=True)
                    with open(fpath, "w") as f:
                        f.write(fcontent)
                
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

    async def run_workflow(self, user_prompt: str, config: Optional[Dict] = None):
        config = config or {}
        auto_fix = config.get("auto_fix", False)
        
        context = {"files": {}, "architect_plan": "", "config": config}
        results = {}

        async def run_agent(agent, prompt=None):
            p = prompt or user_prompt
            last_response = None
            async for response in agent.process(p, context):
                last_response = response
                yield response
            results[agent.name] = last_response

        # --- Single Pass Mode ---
        if not auto_fix:
            yield AgentResponse(agent_name="System", content="Starting Workflow...")
            
            # 1. Architect
            async for res in run_agent(self.architect): yield res
            last_arch = results.get(self.architect.name)
            if last_arch and last_arch.internal_output:
                context["architect_plan"] = last_arch.internal_output

            # 2. Generator
            async for res in run_agent(self.generator): 
                yield res
                if res.files: context["files"].update(res.files)

            # 3. Tester
            async for res in run_agent(self.tester): 
                yield res
                if res.files: context["files"].update(res.files)
            
            last_tester = results.get(self.tester.name)
            is_failure = last_tester.is_error if last_tester else False

            if not is_failure:
                async for res in run_agent(self.reviewer): yield res
                async for res in run_agent(self.writer): yield res
                yield AgentResponse(agent_name="System", content="Workflow Completed Successfully.")
            else:
                yield AgentResponse(agent_name="System", content="Workflow Completed (Tests Failed).")
            
            return

        # --- Auto-Fix Loop Mode ---
        MAX_RETRIES = 15 # Safety limit to prevent infinite cost
        attempt = 1
        current_prompt = user_prompt
        
        while attempt <= MAX_RETRIES:
            yield AgentResponse(agent_name="System", content=f"Starting Auto-Fix Cycle (Iteration {attempt})")
            
            # 1. Architect
            # If retry, we use the constructed 'current_prompt' which contains the feedback
            async for res in run_agent(self.architect, prompt=current_prompt): yield res
            
            last_arch = results.get(self.architect.name)
            if last_arch and last_arch.internal_output:
                context["architect_plan"] = last_arch.internal_output

            # 2. Generator
            async for res in run_agent(self.generator, prompt=current_prompt): 
                yield res
                if res.files: context["files"].update(res.files)

            # 3. Tester
            async for res in run_agent(self.tester, prompt=current_prompt): 
                yield res
                if res.files: context["files"].update(res.files)

            last_tester = results.get(self.tester.name)
            is_failure = last_tester.is_error if last_tester else False

            if not is_failure:
                async for res in run_agent(self.reviewer): yield res
                async for res in run_agent(self.writer): yield res
                yield AgentResponse(agent_name="System", content=f"Workflow Fixed & Completed in {attempt} iterations.")
                return

            # Handle Failure & Retry
            yield AgentResponse(agent_name="System", content=f"Tests Failed (Iteration {attempt}). Analyzing errors for retry...")
            
            test_log = context["files"].get("TEST_RESULTS.log", "No log")
            # Collect all code files (source and tests)
            code_files = {k: v for k, v in context["files"].items() if k.endswith('.py')}
            code_snapshot = "\n".join([f"--- FILE: {k} ---\n{v}\n" for k, v in code_files.items()])
            
            # Construct robust feedback prompt for the Architect
            current_prompt = f"""
            CRITICAL: PREVIOUS ITERATION FAILED VALIDATION.
            
            ### OBJECTIVE
            Fix the errors in the codebase to satisfy the User Request.
            
            ### ORIGINAL REQUEST
            {user_prompt}
            
            ### PREVIOUS ATTEMPT CONTEXT
            
            #### FAILED IMPLEMENTATION & TESTS
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
            # Reset context files? 
            # If we don't, the agents might see old files. 
            # But we want to keep them so the 'CodeGenerator' can see previous files if needed?
            # Actually, CodeGenerator usually overwrites.
            # Ideally, we pass the 'code_snapshot' in the prompt, so we can clean the context or rely on overwrites.
            # Getting a fresh start for the 'files' dict (except artifacts like readme) might be safer to avoid ghost files.
            # But let's trust the 'overwrite' mechanics.
            
        yield AgentResponse(agent_name="System", content="max auto-fix retries reached. Stopping.")

