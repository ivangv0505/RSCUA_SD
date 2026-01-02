"""
Docstring para app.modulos.autenticacion.rutas
Módulo de rutas para autenticación de usuarios, incluyendo login con
credenciales propias y con Google OAuth2.
rutas significa que contiene endpoints (rutas) de la API.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db import get_session
from .modelos import Usuario, UsuarioUpdate, PasswordChange
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from datetime import datetime
from pydantic import BaseModel
import urllib.request
import json
import secrets

router = APIRouter()

SECRET_KEY = "tu_clave_secreta_super_segura" 
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class TokenGoogle(BaseModel):
    token: str

# Función auxiliar para crear tokens nuestros
def create_jwt(user: Usuario):
    token_data = {"sub": user.username, "version": user.token_version}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    query = select(Usuario).where(Usuario.username == form_data.username)
    user = (await session.execute(query)).scalar_one_or_none()
    
    if not user or user.password != form_data.password:
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")
    
    return create_jwt(user)

# NUEVO: LOGIN CON GOOGLE
@router.post("/google")
async def login_google(data: TokenGoogle, session: AsyncSession = Depends(get_session)):
    # 1. Validar token directamente con Google
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={data.token}"
        with urllib.request.urlopen(url) as response:
            if response.getcode() != 200:
                raise Exception("Token inválido")
            google_data = json.loads(response.read())
    except Exception as e:
        raise HTTPException(status_code=400, detail="Token de Google inválido")

    email = google_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google no retornó email")

    # 2. Buscar si ya existe el usuario por email
    query = select(Usuario).where(Usuario.email == email)
    user = (await session.execute(query)).scalar_one_or_none()

    # 3. Si no existe, lo registramos automáticamente
    if not user:
        nombre = google_data.get("given_name", "Usuario")
        apellido = google_data.get("family_name", "Google")
        base_username = email.split("@")[0]
        
        # Generar username único si ya existe
        username = base_username
        counter = 1
        while (await session.execute(select(Usuario).where(Usuario.username == username))).scalar_one_or_none():
            username = f"{base_username}{counter}"
            counter += 1
            
        user = Usuario(
            nombre=nombre,
            apellido=apellido,
            username=username,
            email=email,
            password=secrets.token_urlsafe(16), # Password aleatoria interna
            token_version=1
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    # 4. Devolver nuestro JWT
    return create_jwt(user) #jason web token


async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)):
    """
    Decodifica el JWT y obtiene el usuario actual. Verifica la versión del
    token para validación distribuida.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_ver: int = payload.get("version", 0)
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
        
    query = select(Usuario).where(Usuario.username == username)
    user = (await session.execute(query)).scalar_one_or_none()
    
    if user is None: raise credentials_exception
    
    # Validación distribuida
    if getattr(user, "token_version", 1) != token_ver:
        raise HTTPException(status_code=401, detail="Sesión expirada")
        
    return user

@router.get("/me", response_model=Usuario)
async def read_users_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=Usuario)
async def update_user_me(datos: UsuarioUpdate, current_user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    if datos.descripcion is not None: current_user.descripcion = datos.descripcion
    if datos.nombre is not None: current_user.nombre = datos.nombre
    if datos.apellido is not None: current_user.apellido = datos.apellido
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user

@router.post("/change-password")
async def cambiar_password(datos: PasswordChange, current_user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    if current_user.password != datos.old_password:
        raise HTTPException(status_code=400, detail="Password incorrecto")
    current_user.password = datos.new_password
    current_user.token_version += 1
    session.add(current_user)
    await session.commit()
    return {"mensaje": "Contraseña actualizada"}

@router.post("/registrar", response_model=Usuario)
async def registrar(usuario: Usuario, session: AsyncSession = Depends(get_session)):
    if usuario.fecnac and isinstance(usuario.fecnac, str):
        try:
            dt = datetime.fromisoformat(usuario.fecnac.replace("Z", "+00:00"))
            usuario.fecnac = dt.replace(tzinfo=None)
        except ValueError: pass

    query = select(Usuario).where(Usuario.username == usuario.username)
    if (await session.execute(query)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    session.add(usuario)
    await session.commit()
    await session.refresh(usuario)
    return usuario
