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

class SaveRequest(BaseModel):
    filename: str
    content: str

@app.post("/save-file")
async def save_file_endpoint(request: SaveRequest):
    try:
        if ".." in request.filename or request.filename.startswith("/"):
             return {"error": "Invalid filename"}

        workspace_dir = "/app/workspace"
        file_path = os.path.join(workspace_dir, request.filename)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(request.content)
            
        return {"status": "ok", "message": f"File {request.filename} saved successfully"}
    except Exception as e:
        return {"error": f"Failed to save file: {str(e)}"}

class CreateFolderRequest(BaseModel):
    path: str

@app.post("/create-folder")
async def create_folder_endpoint(request: CreateFolderRequest):
    try:
        # Prevent directory traversal
        if ".." in request.path or request.path.startswith("/"):
             return {"error": "Invalid folder path"}

        workspace_dir = "/app/workspace"
        folder_path = os.path.join(workspace_dir, request.path)
        
        os.makedirs(folder_path, exist_ok=True)
        
        with open(os.path.join(folder_path, ".keep"), "w") as f:
            f.write("")
            
        return {"status": "ok", "message": f"Folder {request.path} created"}
    except Exception as e:
        return {"error": f"Failed to create folder: {str(e)}"}

class DeleteItemRequest(BaseModel):
    path: str

@app.post("/delete-item")
async def delete_item_endpoint(request: DeleteItemRequest):
    try:
        if ".." in request.path or request.path.startswith("/"):
             return {"error": "Invalid path"}
        
        workspace_dir = "/app/workspace"
        target_path = os.path.join(workspace_dir, request.path)
        
        if not os.path.exists(target_path):
             return {"error": "Item not found"}

        if os.path.isdir(target_path):
            import shutil
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
            
        return {"status": "ok", "message": f"Deleted {request.path}"}
    except Exception as e:
        return {"error": f"Failed to delete: {str(e)}"}

class RenameItemRequest(BaseModel):
    old_path: str
    new_path: str

@app.post("/rename-item")
async def rename_item_endpoint(request: RenameItemRequest):
    try:
        if ".." in request.old_path or request.old_path.startswith("/") or ".." in request.new_path or request.new_path.startswith("/"):
             return {"error": "Invalid path"}
        
        workspace_dir = "/app/workspace"
        old_target = os.path.join(workspace_dir, request.old_path)
        new_target = os.path.join(workspace_dir, request.new_path)
        
        if not os.path.exists(old_target):
             return {"error": "Item not found"}
        
        if os.path.exists(new_target):
             return {"error": "Destination already exists"}
             
        os.rename(old_target, new_target)
        
        return {"status": "ok", "message": f"Renamed {request.old_path} to {request.new_path}"}
    except Exception as e:
        return {"error": f"Failed to rename: {str(e)}"}

@app.post("/delete-all")
async def delete_all_items():
    workspace_dir = "/app/workspace"
    if not os.path.exists(workspace_dir):
        return {"status": "ok", "message": "Workspace already empty"}
        
    try:
        import shutil
        for item in os.listdir(workspace_dir):
            item_path = os.path.join(workspace_dir, item)
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        return {"status": "ok", "message": "Workspace cleared"}
    except Exception as e:
        return {"error": f"Failed to clear workspace: {str(e)}"}

class DuplicateItemRequest(BaseModel):
    source_path: str
    new_path: str

@app.post("/duplicate-item")
async def duplicate_item_endpoint(request: DuplicateItemRequest):
    try:
        if ".." in request.source_path or request.source_path.startswith("/") or ".." in request.new_path or request.new_path.startswith("/"):
             return {"error": "Invalid path"}
        
        workspace_dir = "/app/workspace"
        source_target = os.path.join(workspace_dir, request.source_path)
        new_target = os.path.join(workspace_dir, request.new_path)
        
        if not os.path.exists(source_target):
             return {"error": "Item not found"}
        
        if os.path.exists(new_target):
             return {"error": "Destination already exists"}
        
        import shutil
        if os.path.isdir(source_target):
            shutil.copytree(source_target, new_target)
        else:
            shutil.copy2(source_target, new_target)
            
        return {"status": "ok", "message": f"Duplicated {request.source_path} to {request.new_path}"}
    except Exception as e:
        return {"error": f"Failed to duplicate: {str(e)}"}

from fastapi.responses import FileResponse
import zipfile
import io

from fastapi.staticfiles import StaticFiles

os.makedirs("/app/workspace", exist_ok=True)
app.mount("/preview", StaticFiles(directory="/app/workspace", html=True), name="preview")

@app.get("/list-files")
async def list_files():
    workspace_dir = "/app/workspace"
    if not os.path.exists(workspace_dir):
        return {"files": {}}
        
    files_map = {}
    for root, dirs, files in os.walk(workspace_dir):
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, workspace_dir)
            rel_path = rel_path.replace("\\", "/")
            
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                files_map[rel_path] = content
            except UnicodeDecodeError:
                files_map[rel_path] = "" 
            except Exception as e:
                print(f"Error reading {rel_path}: {e}")
                
    return {"files": files_map}

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