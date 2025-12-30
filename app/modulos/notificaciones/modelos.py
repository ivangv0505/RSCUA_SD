from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

# Evitar import circular
# import circular significa que dos módulos se importan mutuamente
# lo que puede causar errores en tiempo de ejecución
if TYPE_CHECKING:
    from app.modulos.autenticacion.modelos import Usuario

class Notificacion(SQLModel, table=True):
    __tablename__ = "notificaciones"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    usuario_destino_id: int = Field(foreign_key="usuarios.id")
    usuario_origen_id: int = Field(foreign_key="usuarios.id")
    
    tipo: str # "LIKE", "COMENTARIO"
    contenido: str
    referencia_id: Optional[int] = None
    leido: bool = False
    fecha: datetime = Field(default_factory=datetime.now)
    # Esto le dice a la BD: "Usa el campo usuario_origen_id para traer el Objeto Usuario completo"
    usuario_origen: Optional["Usuario"] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "Notificacion.usuario_origen_id==Usuario.id",
            "lazy": "selectin" # Cargar automáticamente
        }
    )
