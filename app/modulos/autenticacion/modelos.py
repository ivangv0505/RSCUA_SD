from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

if TYPE_CHECKING:
    from app.modulos.publicaciones.modelos import Publicacion
    from app.modulos.eventos.modelos import Evento

# Modelo Base
class UsuarioBase(SQLModel):
    nombre: str
    apellido: str
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = None
    fecnac: Optional[datetime] = None
    sexo: Optional[str] = None
    descripcion: Optional[str] = None

# Tabla BB
class Usuario(UsuarioBase, table=True):
    __tablename__ = "usuarios"
    id: Optional[int] = Field(default=None, primary_key=True)
    password: str
    
    # Relaciones
    publicaciones: List["Publicacion"] = Relationship(back_populates="usuario")
    eventos: List["Evento"] = Relationship(back_populates="creador") 

# Para Actualizar
class UsuarioUpdate(SQLModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    descripcion: Optional[str] = None
