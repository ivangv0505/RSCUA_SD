import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import socketio

from app.db import init_db
from app.modulos.autenticacion.rutas import router as auth_router
from app.modulos.publicaciones.rutas import router as posts_router
from app.modulos.eventos.rutas import router as events_router
from app.modulos.mensajeria.socket import sio
from app.modulos.directorios.rutas import router as dir_router
from app.modulos.mensajeria.rutas import router as chat_router
from app.modulos.notificaciones.rutas import router as noti_router

current_file_path = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_file_path)
static_path = os.path.join(project_root, "static")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

socket_app = socketio.ASGIApp(sio)
app = FastAPI(title="RSCUA Modular API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def raiz():
    return RedirectResponse(url="/ui/login.html")

app.include_router(auth_router, prefix="/auth", tags=["Autenticación"])
app.include_router(posts_router, prefix="/publicaciones", tags=["Publicaciones"])
app.include_router(events_router, prefix="/eventos", tags=["Eventos"])
app.include_router(dir_router, prefix="/directorios", tags=["Servicio de Nombres"])
app.include_router(chat_router, prefix="/chat", tags=["Mensajería"])
app.include_router(noti_router, prefix="/notificaciones", tags=["Notificaciones"])

if os.path.exists(static_path):
    app.mount("/ui", StaticFiles(directory=static_path, html=True), name="static")

app.mount("/", socket_app)