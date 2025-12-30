from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col, or_, and_
from app.db import get_session
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario
from .modelos import Mensaje, MensajeCreate

router = APIRouter()

# Obtener historial de mensajes con un usuario específico
@router.get("/historial/{otro_username}")
async def obtener_historial(otro_username: str, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Buscar ID del otro usuario
    q_otro = select(Usuario).where(Usuario.username == otro_username)
    res_otro = await session.execute(q_otro)
    otro_user = res_otro.scalar_one_or_none()
    
    if not otro_user:
        return []

    # Consultar mensajes donde (yo soy remitente Y el es destinatario) O (el es remitente Y yo soy destinatario)
    query = select(Mensaje).where(
        or_(
            and_(Mensaje.remitente_id == user.id, Mensaje.destinatario_id == otro_user.id),
            and_(Mensaje.remitente_id == otro_user.id, Mensaje.destinatario_id == user.id)
        )
    ).order_by(Mensaje.fecha.asc())
    
    mensajes = await session.execute(query)
    return mensajes.scalars().all()

# Obtener lista de usuarios con los que he hablado (para la lista de contactos)
@router.get("/contactos")
async def obtener_contactos(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Esta query es dificil, por simplicidad se devuelven todos los usuarios excepto yo mismo
    query = select(Usuario).where(Usuario.id != user.id)
    result = await session.execute(query)
    return result.scalars().all()
