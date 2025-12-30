from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete, func
from sqlalchemy.orm import selectinload
import shutil
import os
from pathlib import Path
import uuid

from app.db import get_session
from .modelos import Publicacion, PublicacionCreate, PublicacionReadWithUser, PublicacionUpdate, Reaccion
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario

router = APIRouter()

# Configuración de uploads (Mantenemos lo que ya funcionaba)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = BASE_DIR / "static" / "imagenes" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/subir-imagen")
async def subir_imagen(file: UploadFile = File(...)):
    try:
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"url": f"imagenes/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error subiendo imagen")

@router.post("/", response_model=PublicacionReadWithUser)
async def crear_publicacion(post_in: PublicacionCreate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    nueva_pub = Publicacion(**post_in.dict(), usuario_id=user.id)
    session.add(nueva_pub)
    await session.commit()
    await session.refresh(nueva_pub)
    return nueva_pub

# --- FEED MEJORADO (Con conteo de likes y estado) ---
@router.get("/", response_model=List[PublicacionReadWithUser])
async def obtener_feed(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Traemos las publicaciones
    query = select(Publicacion).options(selectinload(Publicacion.usuario)).order_by(Publicacion.fecha.desc())
    result = await session.execute(query)
    posts = result.scalars().all()
    
    # Enriquecemos con likes (Esto podría optimizarse con JOINs, pero lo haremos simple por ahora)
    feed_response = []
    for p in posts:
        # Contar likes
        q_count = select(func.count()).select_from(Reaccion).where(Reaccion.publicacion_id == p.id)
        count = (await session.execute(q_count)).one()[0]
        
        # Saber si YO di like
        q_me = select(Reaccion).where(Reaccion.publicacion_id == p.id, Reaccion.usuario_id == user.id)
        me_like = (await session.execute(q_me)).scalar_one_or_none()
        
        # Convertir a DTO manualmente porque Pydantic no lo hace mágico con campos extra
        dto = PublicacionReadWithUser(
            id=p.id, fecha=p.fecha, texto=p.texto, imagen_url=p.imagen_url, privacidad=p.privacidad,
            usuario=p.usuario,
            likes=count,
            ya_di_like=bool(me_like)
        )
        feed_response.append(dto)
        
    return feed_response

# --- NUEVO: DAR/QUITAR LIKE (TOGGLE) ---
@router.post("/{id}/like")
async def toggle_like(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Verificar si ya existe
    query = select(Reaccion).where(Reaccion.publicacion_id == id, Reaccion.usuario_id == user.id)
    result = await session.execute(query)
    existing_like = result.scalar_one_or_none()
    
    if existing_like:
        # Si existe, lo borramos (Dislike)
        await session.delete(existing_like)
        await session.commit()
        accion = "DISLIKE"
    else:
        # Si no existe, lo creamos (Like)
        nuevo_like = Reaccion(publicacion_id=id, usuario_id=user.id)
        session.add(nuevo_like)
        await session.commit()
        accion = "LIKE"
        
    return {"accion": accion}

# --- ENDPOINTS RESTANTES (Get Usuario, Delete, Put) ---
@router.get("/usuario/{username}", response_model=List[PublicacionReadWithUser])
async def obtener_posts_usuario(username: str, session: AsyncSession = Depends(get_session)):
    q_user = select(Usuario).where(Usuario.username == username)
    user_target = (await session.execute(q_user)).scalar_one_or_none()
    if not user_target: return []

    query = select(Publicacion).where(Publicacion.usuario_id == user_target.id).options(selectinload(Publicacion.usuario)).order_by(Publicacion.fecha.desc())
    posts = (await session.execute(query)).scalars().all()
    
    # Nota: Aquí no estamos calculando 'ya_di_like' correctamente porque no inyectamos el usuario logueado en este endpoint público
    # Para simplificar, devolvemos sin likes o asumimos 0
    return [PublicacionReadWithUser(id=p.id, fecha=p.fecha, texto=p.texto, imagen_url=p.imagen_url, privacidad=p.privacidad, usuario=p.usuario) for p in posts]

@router.delete("/{id}")
async def eliminar_publicacion(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # 1. Buscar la publicación
    post = await session.get(Publicacion, id)
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
        
    # 2. Verificar que soy el dueño
    if post.usuario_id != user.id: 
        raise HTTPException(status_code=403, detail="No puedes borrar esto")
    
    #BORRAR REACCIONES PRIMERO para evitar errores de FK
    # Ejecutamos una sentencia DELETE directa para borrar los likes de este post
    statement = delete(Reaccion).where(Reaccion.publicacion_id == id)
    await session.execute(statement)
    
    # 4. Ahora sí, borrar la publicación
    await session.delete(post)
    await session.commit()
    return {"ok": True}

@router.put("/{id}", response_model=PublicacionReadWithUser)
async def editar_publicacion(id: int, up: PublicacionUpdate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    post = await session.get(Publicacion, id)
    if not post or post.usuario_id != user.id: raise HTTPException(status_code=403)
    if up.texto: post.texto = up.texto
    session.add(post)
    await session.commit()
    return post
