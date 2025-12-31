from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.db import get_session
from .modelos import Usuario, UsuarioUpdate, PasswordChange
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from datetime import datetime

router = APIRouter()

SECRET_KEY = "tu_clave_secreta_super_segura" 
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    query = select(Usuario).where(Usuario.username == form_data.username)
    user = (await session.execute(query)).scalar_one_or_none()
    
    if not user or user.password != form_data.password:
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")
    
    # INCLUIMOS LA VERSIÓN EN EL TOKEN (Estado del Cliente)
    token_data = {"sub": user.username, "version": user.token_version}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o expiradas",
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
    
    # VALIDACIÓN DE CONSISTENCIA: Si la versión no coincide, el token es revocado
    if token_ver != user.token_version:
        raise HTTPException(status_code=401, detail="Sesión invalidada. Reingresa.")
        
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

# ENDPOINT CAMBIO DE PASSWORD
@router.post("/change-password")
async def cambiar_password(
    datos: PasswordChange, 
    current_user: Usuario = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    if current_user.password != datos.old_password:
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    
    # 1. Actualizar Password
    current_user.password = datos.new_password
    
    # 2. INCREMENTAR VERSIÓN (Invalida todos los tokens existentes globalmente)
    current_user.token_version += 1
    
    session.add(current_user)
    await session.commit()
    
    return {"mensaje": "Contraseña actualizada. Sesiones cerradas por seguridad."}

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
