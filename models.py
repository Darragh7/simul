from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class Event(Base):
    __tablename__ = 'events'
    id = Column(Integer, primary_key=True)
    google_event_id = Column(String, unique=True)
    summary = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    user_email = Column(String)

engine = create_engine('sqlite:///events.db', echo=True)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    """Creates the database tables if they do not already exist."""
    Base.metadata.create_all(engine)
