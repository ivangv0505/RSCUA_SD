from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db import get_session
from .modelos import Usuario, UsuarioUpdate
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from datetime import datetime

router = APIRouter()
SECRET_KEY = "clave_secreta_super_segura"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    query = select(Usuario).where(Usuario.username == form_data.username)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    if not user or user.password != form_data.password:
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")
    
    token = jwt.encode({"sub": user.username}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

@router.post("/registrar", response_model=Usuario)
async def registrar(usuario: Usuario, session: AsyncSession = Depends(get_session)):
    if usuario.fecnac and isinstance(usuario.fecnac, str):
        try:
            dt = datetime.fromisoformat(usuario.fecnac.replace("Z", "+00:00"))
            usuario.fecnac = dt.replace(tzinfo=None)
        except ValueError:
            pass
    elif usuario.fecnac and isinstance(usuario.fecnac, datetime):
        usuario.fecnac = usuario.fecnac.replace(tzinfo=None)

    query = select(Usuario).where(Usuario.username == usuario.username)
    result = await session.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    session.add(usuario)
    await session.commit()
    await session.refresh(usuario)
    return usuario

async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    query = select(Usuario).where(Usuario.username == username)
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

@router.get("/me", response_model=Usuario)
async def read_users_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

# --- NUEVO: EDITAR PERFIL ---
@router.put("/me", response_model=Usuario)
async def update_user_me(
    datos: UsuarioUpdate, 
    current_user: Usuario = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    # Actualizamos solo lo que venga lleno
    if datos.descripcion is not None:
        current_user.descripcion = datos.descripcion
    if datos.nombre is not None:
        current_user.nombre = datos.nombre
    if datos.apellido is not None:
        current_user.apellido = datos.apellido
        
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user
