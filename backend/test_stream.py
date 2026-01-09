import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents import Orchestrator, AgentResponse

async def main():
    print("--- Starting Test Stream ---")
    orchestrator = Orchestrator()
    prompt = "Create a simple python hello world script"
    config = {"use_local_llm": True}
    
    try:
        async for response in orchestrator.run_workflow(prompt, config):
            print(f"\n[RECEIVED] Agent: {response.agent_name}")
            print(f"Status: {'ERROR' if response.is_error else 'OK'}")
            print(f"Content: {response.content[:100].replace(chr(10), ' ')}...")
            if response.files:
                print(f"Files: {list(response.files.keys())}")
            if response.is_error:
                print("!!! ERROR DETECTED !!!")
                
    except Exception as e:
        print(f"\n!!! CRITICAL EXCEPTION !!!: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
