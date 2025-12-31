from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

if TYPE_CHECKING:
    from app.modulos.publicaciones.modelos import Publicacion
    from app.modulos.eventos.modelos import Evento

class UsuarioBase(SQLModel):
    nombre: str
    apellido: str
    username: str = Field(index=True, unique=True)
    email: str = Field(unique=True)
    phone: Optional[str] = None
    fecnac: Optional[datetime] = None
    sexo: Optional[str] = None
    descripcion: Optional[str] = None

class Usuario(UsuarioBase, table=True):
    __tablename__ = "usuarios"
    id: Optional[int] = Field(default=None, primary_key=True)
    password: str
    
    #para invalidación global de sesiones
    #esto se incrementa cada vez que el usuario cambia su contraseña
    token_version: int = Field(default=1) 
    
    publicaciones: List["Publicacion"] = Relationship(back_populates="usuario")
    eventos: List["Evento"] = Relationship(back_populates="organizador")

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioUpdate(SQLModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    descripcion: Optional[str] = None

class PasswordChange(SQLModel):
    old_password: str
    new_password: str
