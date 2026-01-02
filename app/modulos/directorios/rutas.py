"""
Docstring para app.modulos.directorios.rutas
Este archivo contiene las rutas (endpoints) relacionadas con el
servicio de directorios de usuarios, permitiendo buscar usuarios
y obtener perfiles públicos.
Es muy importante, ya que facilita la interacción entre usuarios
al permitirles encontrarse y ver información básica de otros usuarios.
"""

from typing import List, Union, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col
from app.db import get_session
from app.modulos.autenticacion.modelos import Usuario
from app.modulos.publicaciones.modelos import Publicacion
from pydantic import BaseModel

router = APIRouter()

# DTO para resultados de búsqueda
class ResultadoBusqueda(BaseModel):
    tipo: str
    id: int
    titulo: str
    subtitulo: str
    imagen: str = "imagenes/perfil.jpg"

# DTO para Perfil Público. 
class PerfilPublico(BaseModel):
    username: str
    nombre: str
    apellido: str
    descripcion: Optional[str] = None
    seguidores: int = 0
    seguidos: int = 0
    posts_count: int = 0

@router.get("/buscar", response_model=List[ResultadoBusqueda])
async def buscar_entidad(q: str, session: AsyncSession = Depends(get_session)):
    if not q: return []
    resultados = []
    # Usuarios
    q_users = select(Usuario).where((col(Usuario.username).ilike(f"%{q}%")) | (col(Usuario.nombre).ilike(f"%{q}%"))).limit(5)
    users = (await session.execute(q_users)).scalars().all()
    for u in users:
        resultados.append(ResultadoBusqueda(tipo="USUARIO", id=u.id, titulo=f"{u.nombre} {u.apellido}", subtitulo=f"@{u.username}"))
    # Posts
    q_posts = select(Publicacion).where(col(Publicacion.texto).ilike(f"%{q}%")).limit(5)
    posts = (await session.execute(q_posts)).scalars().all()
    for p in posts:
        txt = (p.texto[:40] + '...') if len(p.texto)>40 else p.texto
        resultados.append(ResultadoBusqueda(tipo="POST", id=p.id, titulo=txt, subtitulo="Publicación"))
    return resultados

# --- NUEVO: Obtener datos de perfil público ---
@router.get("/perfil/{username}", response_model=PerfilPublico)
async def obtener_perfil_publico(username: str, session: AsyncSession = Depends(get_session)):
    # Buscar usuario
    query = select(Usuario).where(Usuario.username == username)
    user = (await session.execute(query)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Contar publicaciones
    q_posts = select(Publicacion).where(Publicacion.usuario_id == user.id)
    posts = (await session.execute(q_posts)).scalars().all()
    
    return PerfilPublico(
        username=user.username,
        nombre=user.nombre,
        apellido=user.apellido,
        descripcion=user.descripcion,
        posts_count=len(posts),
        seguidores=0, # Pendiente implementar seguidores
        seguidos=0
    )
