from sqlmodel import Session, create_engine, SQLModel
from pathlib import Path

# Ensure the data directory exists
data_dir = Path("data")
data_dir.mkdir(exist_ok=True)

sqlite_file_name = data_dir / "sdr_studio.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
