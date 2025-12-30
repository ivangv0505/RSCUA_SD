from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db import get_session
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario
from .modelos import Configuracion, ConfiguracionUpdate, PrivacidadEnum

router = APIRouter()

@router.get("/", response_model=Configuracion)
async def get_config(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Configuracion).where(Configuracion.usuario_id == user.id)
    config = (await session.execute(query)).scalar_one_or_none()
    
    if not config:
        # Al crear, se usarán los defaults del modelo (incluida privacidad=MEDIA)
        config = Configuracion(usuario_id=user.id)
        session.add(config)
        await session.commit()
        await session.refresh(config)
    return config

@router.put("/", response_model=Configuracion)
async def update_config(data: ConfiguracionUpdate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Configuracion).where(Configuracion.usuario_id == user.id)
    config = (await session.execute(query)).scalar_one_or_none()
    
    if not config:
        config = Configuracion(usuario_id=user.id)
        session.add(config)
    
    if data.tema: config.tema = data.tema
    if data.idioma: config.idioma = data.idioma
    if data.privacidad: config.privacidad = data.privacidad
    
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config
