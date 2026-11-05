import os
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from seed import seed_database
from services.websocket_manager import ws_manager

# Import Routers
from routers import (
    auth, super_admin, hospital_admin, hospital_mgmt,
    doctor, lab_tech, patient, external
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & Seed Data on startup
    print("🚀 Initializing ArogyaFlow Database...")
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield
    print("🛑 ArogyaFlow Backend Shutting Down...")

app = FastAPI(
    title="ArogyaFlow API",
    description="Integrated Healthcare, Emergency Triage & Resource Management Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router)
app.include_router(super_admin.router)
app.include_router(hospital_admin.router)
app.include_router(hospital_mgmt.router)
app.include_router(doctor.router)
app.include_router(lab_tech.router)
app.include_router(patient.router)
app.include_router(external.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ArogyaFlow Backend",
        "version": "1.0.0",
        "database": "SQLite / PostgreSQL Ready"
    }

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    role: str = Query("GUEST"),
    org_id: str = Query(None),
    uhid: str = Query(None)
):
    await ws_manager.connect(websocket, role=role, org_id=org_id, uhid=uhid)
    try:
        while True:
            # Keep socket alive and accept ping / messages from clients
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, role=role, org_id=org_id, uhid=uhid)
    except Exception:
        ws_manager.disconnect(websocket, role=role, org_id=org_id, uhid=uhid)

# Production Static Files (Serve React Vite build if present)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = "/app/frontend/dist"

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
