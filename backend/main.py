from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agents import Orchestrator
import json
import subprocess
import asyncio
import tempfile
import os
from pydantic import BaseModel
import pty
import sys
import select

class RunRequest(BaseModel):
    code: str
    filename: str

app = FastAPI()

@app.post("/run")
async def run_script(request: RunRequest):
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
            tmp.write(request.code)
            tmp_path = tmp.name
        
        process = await asyncio.create_subprocess_exec(
            "python", tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        os.unlink(tmp_path)
        
        return {
            "output": stdout.decode(),
            "error": stderr.decode(),
            "exit_code": process.returncode
        }
    except Exception as e:
        return {"error": str(e), "exit_code": -1}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Multi-Agent Backend is Running"}

@app.websocket("/generate")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        print("Initializing Orchestrator...")
        orchestrator = Orchestrator()
        
        data = await websocket.receive_text()
        request_data = json.loads(data)
        prompt = request_data.get("prompt")
        
        use_local_llm = request_data.get("use_local_llm", True) 
        api_key = request_data.get("api_key")
        auto_fix = request_data.get("auto_fix", False)
        config = {"use_local_llm": use_local_llm, "api_key": api_key, "auto_fix": auto_fix}

        if not prompt:
            await websocket.send_json({"error": "No prompt provided"})
            return

        print(f"Starting generation with prompt: {prompt[:50]}...")
        async for response in orchestrator.run_workflow(prompt, config):
            print(f"Backend yielding response from: {response.agent_name}")
            await websocket.send_json(response.dict())
            print(f"Message sent to client for: {response.agent_name}")
            
        print("Workflow finished, sending done status")
        await websocket.send_json({"status": "done"})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Generate Critical Error: {e}")
        try:
             await websocket.send_json({"error": f"Backend Error: {str(e)}"})
        except:
             pass

@app.websocket("/terminal")
async def terminal_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        # Create PTY
        master_fd, slave_fd = pty.openpty()
        
        # Spawn shell
        process = subprocess.Popen(
            ["/bin/bash"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            cwd="/app", 
            env={**os.environ, "TERM": "xterm-256color"}
        )
        
        # Close slave fd in parent
        os.close(slave_fd)
        
        loop = asyncio.get_running_loop()

        async def read_from_pty():
            try:
                while True:
                    # Blocking read in default executor
                    data = await loop.run_in_executor(None, os.read, master_fd, 4096)
                    if not data:
                        break
                    await websocket.send_text(data.decode(errors='ignore'))
            except Exception:
                pass

        async def write_to_pty():
            try:
                while True:
                    data = await websocket.receive_text()
                    os.write(master_fd, data.encode())
            except WebSocketDisconnect:
                pass
            except Exception:
                pass

        # Run both tasks
        write_task = asyncio.create_task(write_to_pty())
        read_task = asyncio.create_task(read_from_pty())
        
        done, pending = await asyncio.wait(
            [write_task, read_task], 
            return_when=asyncio.FIRST_COMPLETED
        )
        
        for task in pending:
            task.cancel()
            
    except Exception as e:
        print(f"Terminal Error: {e}")
        await websocket.close()
    finally:
        # Cleanup
        try:
            process.terminate()
            process.wait()
            os.close(master_fd)
        except:
            pass