import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Room mappings: room_name -> Set[WebSocket]
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(websocket)
        logger.info(f"WebSocket client connected to {room}. Total clients: {len(self.rooms[room])}")

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.rooms and websocket in self.rooms[room]:
            self.rooms[room].remove(websocket)
            if len(self.rooms[room]) == 0:
                del self.rooms[room]
            logger.info(f"WebSocket client disconnected from {room}")

    async def broadcast_to_room(self, room: str, message: dict):
        if room not in self.rooms:
            return
            
        payload = json.dumps(message)
        dead_connections = set()
        
        for connection in self.rooms[room]:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Error broadcasting to client in {room}: {e}")
                dead_connections.add(connection)
                
        for dead in dead_connections:
            self.disconnect(dead, room)


manager = ConnectionManager()
