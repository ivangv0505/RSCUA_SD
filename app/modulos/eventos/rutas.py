from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db import get_session
from .modelos import Evento
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario

router = APIRouter()

@router.post("/", response_model=Evento)
async def crear_evento(
    evento: Evento, 
    user: Usuario = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    evento.creador_id = user.id
    session.add(evento)
    await session.commit()
    await session.refresh(evento)
    return evento

@router.get("/", response_model=List[Evento])
async def listar_eventos(session: AsyncSession = Depends(get_session)):
    query = select(Evento).order_by(Evento.fecha_evento.desc())
    result = await session.execute(query)
    return result.scalars().all()
