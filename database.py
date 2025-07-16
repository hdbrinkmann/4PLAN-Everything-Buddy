from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./favorites.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    
    favorite_groups = relationship("FavoriteGroup", back_populates="user")
    chat_histories = relationship("ChatHistory", back_populates="user")
    login_sessions = relationship("LoginSession", back_populates="user")
    chat_questions = relationship("ChatQuestionLog", back_populates="user")

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

Base.metadata.create_all(bind=engine)
