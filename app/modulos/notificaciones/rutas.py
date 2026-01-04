"""
Rutas para gestión de notificaciones.

Incluye operaciones para listar notificaciones del usuario, marcar una notificación
como leída y eliminarla. La eliminación permite al usuario limpiar su lista de
notificaciones de forma permanente.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
#API ROUTER es para crear un conjunto de rutas agrupadas
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


class UsuarioMini(BaseModel):
    """DTO que expone un subconjunto del modelo Usuario."""
    username: str
    nombre: str
    apellido: str


class NotificacionRead(BaseModel):
    """
    DTO utilizado para serializar notificaciones. Incluye información del
    usuario origen de la notificación y permite exponerla en la respuesta.
    """
    id: int
    tipo: str
    contenido: str
    fecha: datetime
    leido: bool
    referencia_id: Optional[int] = None
    usuario_origen: Optional[UsuarioMini] = None


@router.get("/", response_model=List[NotificacionRead])
async def obtener_notificaciones(
    user: Usuario = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Devuelve todas las notificaciones del usuario autenticado ordenadas por
    fecha descendente. Se carga de forma anticipada el usuario de origen
    para evitar consultas adicionales.
    """
    query = (
        select(Notificacion)
        .where(Notificacion.usuario_destino_id == user.id)
        .options(selectinload(Notificacion.usuario_origen))
        .order_by(desc(Notificacion.fecha))
    )
    result = await session.execute(query)
    notis = result.scalars().all()
    return notis


@router.put("/leer/{id}")
async def marcar_leida(
    id: int,
    user: Usuario = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Marca una notificación como leída. Si la notificación no pertenece al
    usuario autenticado no se realiza ninguna modificación.
    """
    noti = await session.get(Notificacion, id)
    if noti and noti.usuario_destino_id == user.id:
        noti.leido = True
        session.add(noti)
        await session.commit()
    return {"ok": True}


@router.delete("/{id}")
async def eliminar_notificacion(
    id: int,
    user: Usuario = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Elimina permanentemente una notificación. El usuario sólo puede borrar
    notificaciones propias; en caso contrario no se realiza ninguna acción.
    """
    noti = await session.get(Notificacion, id)
    if noti and noti.usuario_destino_id == user.id:
        await session.delete(noti)
        await session.commit()
    return {"ok": True}