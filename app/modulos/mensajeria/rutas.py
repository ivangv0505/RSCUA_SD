from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, or_, and_
from app.db import get_session
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario
from .modelos import Mensaje
from app.modulos.mensajeria.socket import sio
from pydantic import BaseModel

router = APIRouter()

class MensajeEdit(BaseModel):
    contenido: str

# --- ORIGINAL DEL REPO (Para que funcione la carga) ---
@router.get("/historial/{otro_username}")
async def obtener_historial(otro_username: str, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    q_otro = select(Usuario).where(Usuario.username == otro_username)
    res_otro = await session.execute(q_otro)
    otro_user = res_otro.scalar_one_or_none()
    
    if not otro_user:
        return []

    query = select(Mensaje).where(
        or_(
            and_(Mensaje.remitente_id == user.id, Mensaje.destinatario_id == otro_user.id),
            and_(Mensaje.remitente_id == otro_user.id, Mensaje.destinatario_id == user.id)
        )
    ).order_by(Mensaje.fecha.asc())
    
    mensajes = await session.execute(query)
    return mensajes.scalars().all()

@router.get("/contactos")
async def obtener_contactos(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Devuelve usuarios simples, tal como espera tu JS original
    query = select(Usuario).where(Usuario.id != user.id)
    result = await session.execute(query)
    return result.scalars().all()

# --- AGREGADOS PARA FUNCIONALIDAD (Sin romper lo anterior) ---
@router.delete("/{mensaje_id}")
async def eliminar_mensaje(mensaje_id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    mensaje = await session.get(Mensaje, mensaje_id)
    if not mensaje or mensaje.remitente_id != user.id:
        raise HTTPException(status_code=403, detail="No permitido")
    
    await session.delete(mensaje)
    await session.commit()
    await sio.emit("mensaje_eliminado", {"id": mensaje_id})
    return {"ok": True}

@router.put("/{mensaje_id}")
async def editar_mensaje(mensaje_id: int, datos: MensajeEdit, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    mensaje = await session.get(Mensaje, mensaje_id)
    if not mensaje or mensaje.remitente_id != user.id:
        raise HTTPException(status_code=403, detail="No permitido")
    
    mensaje.contenido = datos.contenido
    session.add(mensaje)
    await session.commit()
    await sio.emit("mensaje_editado", {"id": mensaje_id, "contenido": datos.contenido})
    return {"ok": True}
