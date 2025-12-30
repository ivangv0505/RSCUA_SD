from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from app.modulos.autenticacion.modelos import Usuario

class Evento(SQLModel, table=True):
    __tablename__ = "eventos"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str
    descripcion: str
    fecha_evento: datetime
    
    creador_id: int = Field(foreign_key="usuarios.id")
    creador: Optional[Usuario] = Relationship(back_populates="eventos")
