from typing import List, Union
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col
from app.db import get_session
from app.modulos.autenticacion.modelos import Usuario
from app.modulos.publicaciones.modelos import Publicacion
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# DTO para resultados unificados
class ResultadoBusqueda(BaseModel):
    tipo: str # "USUARIO" o "POST"
    id: int
    titulo: str # Nombre usuario o Texto corto del post
    subtitulo: str # Username o Fecha
    imagen: str = "imagenes/perfil.jpg" 

@router.get("/buscar", response_model=List[ResultadoBusqueda])
async def buscar_entidad(q: str, session: AsyncSession = Depends(get_session)):
    if not q: return []
    
    resultados = []
    
    # 1. Buscar Usuarios (Coincidencia en nombre o username)
    q_users = select(Usuario).where(
        (col(Usuario.username).ilike(f"%{q}%")) |
        (col(Usuario.nombre).ilike(f"%{q}%"))
    ).limit(5)
    users = (await session.execute(q_users)).scalars().all()
    
    for u in users:
        resultados.append(ResultadoBusqueda(
            tipo="USUARIO",
            id=u.id,
            titulo=f"{u.nombre} {u.apellido}",
            subtitulo=f"@{u.username}",
            imagen="imagenes/perfil.jpg"
        ))

    # 2. Buscar Publicaciones (Coincidencia de patrones en texto - Concepto Tuplas)
    q_posts = select(Publicacion).where(
        col(Publicacion.texto).ilike(f"%{q}%")
    ).limit(5)
    posts = (await session.execute(q_posts)).scalars().all()
    
    for p in posts:
        # Cortar texto si es muy largo
        texto_corto = (p.texto[:40] + '...') if len(p.texto) > 40 else p.texto
        resultados.append(ResultadoBusqueda(
            tipo="POST",
            id=p.id,
            titulo=texto_corto,
            subtitulo="Publicación",
            imagen=p.imagen_url if p.imagen_url else "imagenes/inicio.jpg"
        ))
    
    return resultados
