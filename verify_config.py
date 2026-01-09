import os
import sys

def test_config(use_local, run_docker, api_key_set=False):
    os.environ["USE_LOCAL_LLM"] = str(use_local)
    os.environ["RUNNING_IN_DOCKER"] = str(run_docker)
    if api_key_set:
        os.environ["OPENAI_API_KEY"] = "sk-test-key"
    else:
        if "OPENAI_API_KEY" in os.environ:
            del os.environ["OPENAI_API_KEY"]
            
    if "OPENAI_BASE_URL" in os.environ:
         del os.environ["OPENAI_BASE_URL"]

    if "backend.agents" in sys.modules:
        del sys.modules["backend.agents"]
    
    try:
        from backend import agents
        print(f"--- Test Case: USE_LOCAL={use_local}, DOCKER={run_docker}, API_KEY={api_key_set} ---")
        print(f"API_KEY: {agents.API_KEY}")
        print(f"BASE_URL: {agents.BASE_URL}")
        print(f"LLM_MODEL: {agents.LLM_MODEL}")
        print("-" * 20)
    except Exception as e:
        print(f"Error: {e}")

sys.path.append(os.getcwd())

print("Starting Verification...")
test_config(use_local=True, run_docker=False)
test_config(use_local=True, run_docker=True)
test_config(use_local=False, run_docker=False, api_key_set=True)
