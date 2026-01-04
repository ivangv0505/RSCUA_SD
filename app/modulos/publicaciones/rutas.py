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
from .modelos import Publicacion, PublicacionCreate, PublicacionReadWithUser, PublicacionUpdate, Reaccion, Comentario, ComentarioRead
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario

router = APIRouter()

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
    except Exception:
        raise HTTPException(status_code=500, detail="Error subiendo imagen")

@router.post("/", response_model=PublicacionReadWithUser)
async def crear_publicacion(post_in: PublicacionCreate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    nueva_pub = Publicacion(**post_in.model_dump(), usuario_id=user.id)
    session.add(nueva_pub)
    await session.commit()
    await session.refresh(nueva_pub)
    return nueva_pub

@router.get("/", response_model=List[PublicacionReadWithUser])
async def obtener_feed(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Publicacion).options(selectinload(Publicacion.usuario)).order_by(Publicacion.fecha.desc())
    result = await session.execute(query)
    posts = result.scalars().all()
    
    feed_response = []
    for p in posts:
        # Contar likes
        q_likes = select(func.count()).select_from(Reaccion).where(Reaccion.publicacion_id == p.id)
        likes_count = (await session.execute(q_likes)).one()[0]
        
        # Contar comentarios
        q_coms = select(func.count()).select_from(Comentario).where(Comentario.publicacion_id == p.id)
        coms_count = (await session.execute(q_coms)).one()[0]
        
        # Estado Like
        q_me = select(Reaccion).where(Reaccion.publicacion_id == p.id, Reaccion.usuario_id == user.id)
        me_like = (await session.execute(q_me)).scalar_one_or_none()
        
        dto = PublicacionReadWithUser(
            id=p.id, fecha=p.fecha, texto=p.texto, imagen_url=p.imagen_url, privacidad=p.privacidad,
            usuario=p.usuario,
            likes=likes_count,
            comentarios=coms_count,
            ya_di_like=bool(me_like)
        )
        feed_response.append(dto)
    return feed_response

@router.post("/{id}/like")
async def toggle_like(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Reaccion).where(Reaccion.publicacion_id == id, Reaccion.usuario_id == user.id)
    result = await session.execute(query)
    existing_like = result.scalar_one_or_none()
    
    if existing_like:
        await session.delete(existing_like)
        await session.commit()
        accion = "DISLIKE"
    else:
        nuevo_like = Reaccion(publicacion_id=id, usuario_id=user.id)
        session.add(nuevo_like)
        await session.commit()
        accion = "LIKE"
    return {"accion": accion}

# --- NUEVOS ENDPOINTS COMENTARIOS ---

@router.post("/{id}/comentar")
async def crear_comentario(id: int, payload: dict, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    texto = payload.get("texto")
    if not texto: raise HTTPException(status_code=400, detail="Texto vacío")
    
    nuevo_comentario = Comentario(texto=texto, usuario_id=user.id, publicacion_id=id)
    session.add(nuevo_comentario)
    await session.commit()
    await session.refresh(nuevo_comentario)
    
    return {"ok": True, "id": nuevo_comentario.id}

@router.get("/{id}/comentarios", response_model=List[ComentarioRead])
async def listar_comentarios(id: int, session: AsyncSession = Depends(get_session)):
    # Traemos comentarios + datos de usuario (join manual o selectinload si configurado)
    query = select(Comentario).where(Comentario.publicacion_id == id).order_by(Comentario.fecha.asc())
    comentarios = (await session.execute(query)).scalars().all()
    
    res = []
    for c in comentarios:
        user = await session.get(Usuario, c.usuario_id)
        res.append(ComentarioRead(
            id=c.id, texto=c.texto, fecha=c.fecha,
            usuario_id=c.usuario_id,
            nombre_usuario=f"{user.nombre} {user.apellido}",
            username=user.username
        ))
    return res

@router.delete("/{id}")
async def eliminar_publicacion(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    post = await session.get(Publicacion, id)
    if not post: raise HTTPException(status_code=404)
    if post.usuario_id != user.id: raise HTTPException(status_code=403)
    
    # Borrar dependencias
    await session.execute(delete(Reaccion).where(Reaccion.publicacion_id == id))
    await session.execute(delete(Comentario).where(Comentario.publicacion_id == id)) # Borrar comentarios también
    
    await session.delete(post)
    await session.commit()
    return {"ok": True}

@router.put("/{id}")
async def editar_publicacion(id: int, up: PublicacionUpdate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    post = await session.get(Publicacion, id)
    if not post or post.usuario_id != user.id: raise HTTPException(status_code=403)
    if up.texto: post.texto = up.texto
    session.add(post)
    await session.commit()
    return post
