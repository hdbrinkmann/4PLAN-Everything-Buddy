from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Text, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.exc import OperationalError, DisconnectionError
from datetime import datetime
import os
import logging

# Use environment variable for database path, fallback to default
DB_PATH = os.getenv("DB_PATH", "./favorites.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine with connection pooling and reconnection settings
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,   # Recycle connections every hour
    echo=False  # Set to True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db_with_retry():
    """Get database session with automatic retry on connection failure."""
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            db = SessionLocal()
            # Test the connection
            db.execute(text("SELECT 1"))
            return db
        except (OperationalError, DisconnectionError) as e:
            retry_count += 1
            logging.warning(f"Database connection failed (attempt {retry_count}/{max_retries}): {e}")
            
            if retry_count < max_retries:
                # Close the failed session
                try:
                    db.close()
                except:
                    pass
                
                # Recreate the engine to force new connections
                global engine
                engine = create_engine(
                    DATABASE_URL, 
                    connect_args={"check_same_thread": False},
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    echo=False
                )
                SessionLocal.configure(bind=engine)
                
                # Wait a bit before retrying
                import time
                time.sleep(0.5)
            else:
                logging.error(f"Failed to connect to database after {max_retries} attempts")
                raise
        except Exception as e:
            logging.error(f"Unexpected database error: {e}")
            try:
                db.close()
            except:
                pass
            raise
    
    raise Exception("Failed to establish database connection")

def test_db_connection():
    """Test database connection and return status."""
    try:
        db = get_db_with_retry()
        try:
            db.execute(text("SELECT 1"))
            return True, "Database connection OK"
        finally:
            db.close()
    except Exception as e:
        return False, f"Database connection failed: {str(e)}"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    
    favorite_groups = relationship("FavoriteGroup", back_populates="user")
    chat_histories = relationship("ChatHistory", back_populates="user")
    login_sessions = relationship("LoginSession", back_populates="user")
    chat_questions = relationship("ChatQuestionLog", back_populates="user")
    faulty_code_logs = relationship("FaultyCodeLog", back_populates="user")
    feedback_entries = relationship("FeedbackEntry", back_populates="user")

class FavoriteGroup(Base):
    __tablename__ = "favorite_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    order = Column(Integer, default=0)
    
    user = relationship("User", back_populates="favorite_groups")
    questions = relationship("FavoriteQuestion", back_populates="group", cascade="all, delete-orphan")

class FavoriteQuestion(Base):
    __tablename__ = "favorite_questions"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(String, index=True)
    group_id = Column(Integer, ForeignKey("favorite_groups.id"))
    order = Column(Integer, default=0)
    
    group = relationship("FavoriteGroup", back_populates="questions")

class ChatHistory(Base):
    __tablename__ = "chat_histories"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    selected_fields = Column(Text)  # JSON string of selected knowledge fields
    
    user = relationship("User", back_populates="chat_histories")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chat_histories.id"))
    role = Column(String)  # 'user' or 'assistant'
    content = Column(Text)
    order = Column(Integer)
    
    chat = relationship("ChatHistory", back_populates="messages")

class LoginSession(Base):
    __tablename__ = "login_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    login_time = Column(DateTime, default=datetime.utcnow)
    logout_time = Column(DateTime, nullable=True)
    session_id = Column(String, index=True)  # Socket.IO session ID
    
    user = relationship("User", back_populates="login_sessions")

class ChatQuestionLog(Base):
    __tablename__ = "chat_question_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_text = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session_id = Column(String, nullable=True)  # Socket.IO session ID
    rating = Column(String, nullable=True)  # 'good', 'poor', or null
    
    user = relationship("User", back_populates="chat_questions")

class FaultyCodeLog(Base):
    __tablename__ = "faulty_code_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    python_code = Column(Text)
    security_failure_reason = Column(Text)
    original_question = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session_id = Column(String, nullable=True)  # Socket.IO session ID
    attempt_number = Column(Integer, default=1)  # Which attempt this was in the retry sequence
    
    user = relationship("User", back_populates="faulty_code_logs")

class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    feedback_type = Column(String, nullable=False)  # "Issue", "Idea", "Other"
    feedback_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="feedback_entries")

Base.metadata.create_all(bind=engine)
