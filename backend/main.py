from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agents import Orchestrator
import json
import subprocess
import asyncio
import tempfile
import os
from pydantic import BaseModel

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
    orchestrator = Orchestrator()
    try:
        data = await websocket.receive_text()
        request_data = json.loads(data)
        prompt = request_data.get("prompt")
        
        use_local_llm = request_data.get("use_local_llm", True) 
        config = {"use_local_llm": use_local_llm}

        if not prompt:
            await websocket.send_json({"error": "No prompt provided"})
            return

        async for response in orchestrator.run_workflow(prompt, config):
            await websocket.send_json(response.dict())
            
        await websocket.send_json({"status": "done"})

    except WebSocketDisconnect:
        print("Client disconnected")
