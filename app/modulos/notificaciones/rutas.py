from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario
from .modelos import Notificacion
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# DTOs para que la respuesta JSON incluya el usuario anidado
class UsuarioMini(BaseModel):
    username: str
    nombre: str
    apellido: str

class NotificacionRead(BaseModel):
    id: int
    tipo: str
    contenido: str
    fecha: datetime
    leido: bool
    referencia_id: Optional[int] = None
    usuario_origen: Optional[UsuarioMini] = None 

@router.get("/", response_model=List[NotificacionRead])
async def obtener_notificaciones(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Solicitamos las notificaciones Y cargamos la relación 'usuario_origen'
    query = select(Notificacion).where(Notificacion.usuario_destino_id == user.id).options(selectinload(Notificacion.usuario_origen)).order_by(desc(Notificacion.fecha))
    
    result = await session.execute(query)
    notis = result.scalars().all()
    return notis

@router.put("/leer/{id}")
async def marcar_leida(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    noti = await session.get(Notificacion, id)
    if noti and noti.usuario_destino_id == user.id:
        noti.leido = True
        session.add(noti)
        await session.commit()
    return {"ok": True}
