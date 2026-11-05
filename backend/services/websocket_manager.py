import json
from typing import Dict, List, Any
from fastapi import WebSocket

class WebSocketConnectionManager:
    def __init__(self):
        # Maps user_id or role / org_id to list of active WebSockets
        self.active_connections: List[WebSocket] = []
        self.role_connections: Dict[str, List[WebSocket]] = {}
        self.org_connections: Dict[str, List[WebSocket]] = {}
        self.uhid_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, role: str = "GUEST", org_id: str = None, uhid: str = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if role not in self.role_connections:
            self.role_connections[role] = []
        self.role_connections[role].append(websocket)

        if org_id:
            if org_id not in self.org_connections:
                self.org_connections[org_id] = []
            self.org_connections[org_id].append(websocket)

        if uhid:
            if uhid not in self.uhid_connections:
                self.uhid_connections[uhid] = []
            self.uhid_connections[uhid].append(websocket)

    def disconnect(self, websocket: WebSocket, role: str = "GUEST", org_id: str = None, uhid: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if role in self.role_connections and websocket in self.role_connections[role]:
            self.role_connections[role].remove(websocket)
        if org_id and org_id in self.org_connections and websocket in self.org_connections[org_id]:
            self.org_connections[org_id].remove(websocket)
        if uhid and uhid in self.uhid_connections and websocket in self.uhid_connections[uhid]:
            self.uhid_connections[uhid].remove(websocket)

    async def broadcast_all(self, event_type: str, data: Any):
        payload = json.dumps({"event": event_type, "data": data})
        for conn in list(self.active_connections):
            try:
                await conn.send_text(payload)
            except Exception:
                pass

    async def broadcast_role(self, role: str, event_type: str, data: Any):
        payload = json.dumps({"event": event_type, "data": data})
        for conn in list(self.role_connections.get(role, [])):
            try:
                await conn.send_text(payload)
            except Exception:
                pass

    async def broadcast_org(self, org_id: str, event_type: str, data: Any):
        payload = json.dumps({"event": event_type, "data": data})
        for conn in list(self.org_connections.get(org_id, [])):
            try:
                await conn.send_text(payload)
            except Exception:
                pass

    async def broadcast_uhid(self, uhid: str, event_type: str, data: Any):
        payload = json.dumps({"event": event_type, "data": data})
        for conn in list(self.uhid_connections.get(uhid, [])):
            try:
                await conn.send_text(payload)
            except Exception:
                pass

ws_manager = WebSocketConnectionManager()
