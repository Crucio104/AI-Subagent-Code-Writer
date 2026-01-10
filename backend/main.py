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

from fastapi.responses import FileResponse
import zipfile
import io

from fastapi.staticfiles import StaticFiles

os.makedirs("/app/workspace", exist_ok=True)
app.mount("/preview", StaticFiles(directory="/app/workspace", html=True), name="preview")

@app.get("/download-project")
async def download_project():
    base_dir = "/app/workspace"
    if not os.path.exists(base_dir):
        return {"error": "No project files found."}
        
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, base_dir)
                zip_file.write(file_path, arcname)
                
    zip_buffer.seek(0)
    
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.zip', delete=False) as tmp_zip:
        tmp_zip.write(zip_buffer.getvalue())
        tmp_zip_path = tmp_zip.name

    return FileResponse(
        tmp_zip_path, 
        media_type='application/zip', 
        filename='project_files.zip',
        background=asyncio.create_task(cleanup_file(tmp_zip_path))
    )

async def cleanup_file(path: str):
    await asyncio.sleep(10) 
    try:
        os.unlink(path)
    except:
        pass


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
    print("WS: Connection request received for /generate")
    await websocket.accept()
    print("WS: Connection accepted")
    try:
        print("WS: Initializing Orchestrator...")
        orchestrator = Orchestrator()
        
        data = await websocket.receive_text()
        request_data = json.loads(data)
        prompt = request_data.get("prompt")
        
        use_local_llm = request_data.get("use_local_llm", True) 
        api_key = request_data.get("api_key")
        auto_fix = request_data.get("auto_fix", False)
        language = request_data.get("language", "Python")
        config = {"use_local_llm": use_local_llm, "api_key": api_key, "auto_fix": auto_fix, "language": language}

        if not prompt:
            await websocket.send_json({"error": "No prompt provided"})
            return

        print(f"Starting generation with prompt: {prompt[:50]}...")
        async for response in orchestrator.run_workflow(prompt, config):
            await websocket.send_json(response.dict())
            
        await websocket.send_json({"status": "done"})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Generate Critical Error: {e}")
        try:
             await websocket.send_json({"error": f"Backend Error: {str(e)}"})
        except:
             pass

@app.websocket("/terminal")
async def terminal_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        master_fd, slave_fd = pty.openpty()
        
        os.makedirs("/app/workspace", exist_ok=True)

        process = subprocess.Popen(
            ["/bin/bash"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=os.setsid,
            cwd="/app/workspace",
            env={**os.environ, "TERM": "xterm-256color"}
        )
        
        os.close(slave_fd)
        
        loop = asyncio.get_running_loop()

        async def read_from_pty():
            try:
                while True:
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
        try:
            process.terminate()
            process.wait()
            os.close(master_fd)
        except:
            pass