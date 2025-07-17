import socketio
import pandas as pd
import io
import os
import json
import uuid
import base64
import shutil
import asyncio
import logging
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fpdf import FPDF
from app_logic import AppLogic
from auth import verify_token, get_current_user
from database import SessionLocal, User, LoginSession, ChatQuestionLog, FaultyCodeLog
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd
import pytz
from llm import periodic_cache_cleanup, cleanup_expired_cache
from config import (
    get_config_file_path, load_json_config, save_json_config,
    load_admins_config, load_features_config, load_knowledge_fields_config,
    save_admins_config, save_features_config, save_knowledge_fields_config
)

# --- App Initialization ---
# Define allowed origins for CORS
origins = [
    "https://localhost:5173",  # HTTPS Vite dev server
    "https://127.0.0.1:5173",  # HTTPS Vite dev server alternate
    "https://localhost:443",   # HTTPS production
    "https://localhost",       # HTTPS production without explicit port
    "https://127.0.0.1:443",   # HTTPS production alternate
    "https://127.0.0.1",       # HTTPS production alternate without explicit port
    "http://localhost:5173",   # HTTP fallback for local development
    "http://127.0.0.1:8002",   # HTTP fallback
    "*",  # Allow all origins for sub-path deployment
]

# Get base path from environment variable (only for production)
BASE_PATH = os.environ.get("BASE_PATH", "")
fastapi_app = FastAPI(root_path=BASE_PATH) if BASE_PATH else FastAPI()

# Add CORS middleware to the FastAPI app
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging for cache monitoring
logging.basicConfig(level=logging.INFO)

@fastapi_app.on_event("startup")
async def startup_event():
    """Initialize background tasks when the FastAPI app starts."""
    # Perform initial cache cleanup
    logging.info("Performing initial cache cleanup on startup...")
    try:
        await asyncio.to_thread(cleanup_expired_cache)
        logging.info("Initial cache cleanup completed successfully.")
    except Exception as e:
        logging.error(f"Initial cache cleanup failed: {e}")
    
    # Start the periodic cache cleanup background task
    logging.info("Starting periodic cache cleanup background task...")
    asyncio.create_task(periodic_cache_cleanup())
    logging.info("Background cache cleanup task started successfully.")

# This middleware will protect all routes except the root path
#@fastapi_app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Allow OPTIONS requests to pass through without authentication for CORS preflight
    if request.method == "OPTIONS":
        return await call_next(request)
        
    # Allow unauthenticated access to the root path for health checks
    if request.url.path == "/":
        return await call_next(request)
    
    try:
        # The verify_token function will raise an HTTPException if validation fails
        await verify_token(request)
        response = await call_next(request)
        return response
    except HTTPException as e:
        # Return a proper JSON response for authentication errors
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail}
        )

# Configure Socket.IO with sub-path support
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=origins,
    ping_timeout=120,  # Increased timeout to 120 seconds
    ping_interval=60   # Increased interval to 60 seconds
)

# Configure Socket.IO path based on BASE_PATH
socket_path = '/socket.io/'
if BASE_PATH:
    socket_path = f'{BASE_PATH}/socket.io/'

# The final ASGI app that combines FastAPI and Socket.IO
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path=socket_path)

logic = AppLogic()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class GroupCreate(BaseModel):
    name: str

class QuestionCreate(BaseModel):
    question: str
    group_id: int

class QuestionMove(BaseModel):
    question_id: int
    new_group_id: int
    new_order: int

class GroupOrderUpdate(BaseModel):
    ordered_ids: list[int]

class ChatHistoryCreate(BaseModel):
    title: str
    messages: List[dict]
    selected_fields: List[str]

class FeatureConfig(BaseModel):
    image_generation: bool
    image_upload: bool
    pdf_docx_upload: bool
    txt_sql_upload: bool
    xlsx_csv_analysis: bool
    web_search: bool

class KnowledgeFieldDomain(BaseModel):
    field_name: str
    domains: List[str]

class QuestionRating(BaseModel):
    question_id: int
    rating: str  # 'good' or 'poor'

@fastapi_app.get("/favorites/")
async def get_favorites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.get_favorites(db, user)

@fastapi_app.post("/favorites/groups")
async def create_group(group: GroupCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.create_favorite_group(db, user, group.name)

@fastapi_app.put("/favorites/groups/{group_id}")
async def rename_group(group_id: int, group: GroupCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.rename_favorite_group(db, user, group_id, group.name)

@fastapi_app.delete("/favorites/groups/{group_id}")
async def delete_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.delete_favorite_group(db, user, group_id)

@fastapi_app.post("/favorites/questions")
async def create_question(question: QuestionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.add_favorite_question(db, user, question.group_id, question.question)

@fastapi_app.delete("/favorites/questions/{question_id}")
async def delete_question(question_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.delete_favorite_question(db, user, question_id)

@fastapi_app.put("/favorites/questions/move")
async def move_question(move: QuestionMove, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.move_favorite_question(db, user, move.question_id, move.new_group_id, move.new_order)

@fastapi_app.put("/favorites/groups/order")
async def update_group_order(update: GroupOrderUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return logic.update_group_order(db, user, update.ordered_ids)

@fastapi_app.get("/knowledge_fields")
async def get_knowledge_fields(user: User = Depends(get_current_user)):
    """Get knowledge fields accessible to the current user based on domain permissions."""
    try:
        # Load features configuration using config module
        features = load_features_config()
        
        # Load knowledge fields using config module
        document_fields_data = load_json_config("knowledge_fields.json", {})
        
        if not document_fields_data:
            # If the file doesn't exist, maybe the update was never run.
            # Fallback to the old behavior to not break the app.
            documents_path = "Documents"
            if os.path.isdir(documents_path):
                # Create old format for backward compatibility
                document_fields_data = {}
                for d in os.listdir(documents_path):
                    if os.path.isdir(os.path.join(documents_path, d)) and not d.startswith('.'):
                        document_fields_data[d] = {"domains": []}  # Empty domains = admin only
        
        # Filter fields based on user's domain permissions
        accessible_fields = get_user_accessible_fields(user, document_fields_data)
        
        # Add "Web" only if web_search feature is enabled
        if features.get("web_search", True):
            accessible_fields.append("Web")
        
        return {"fields": accessible_fields}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.get("/check_admin")
async def check_admin(user: User = Depends(get_current_user)):
    """Checks if the current user is an administrator."""
    try:
        admins_data = load_admins_config()
        admin_list = admins_data.get("admins", [])
        
        # The user's email is stored in the 'username' attribute of the User model
        if hasattr(user, 'username') and user.username in admin_list:
            return {"is_admin": True}
    except Exception as e:
        # Log the error for debugging but don't expose details to the client
        print(f"Error checking admin status: {e}")
        # For security, default to not being an admin in case of an error
        return {"is_admin": False}
    
    return {"is_admin": False}

# --- Feature Management Endpoints ---
@fastapi_app.get("/admin/features")
async def get_features(user: User = Depends(get_current_user)):
    """Gets the current feature configuration (admin only)."""
    check_admin_access(user)
    
    try:
        features = load_features_config()
        return features
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading features: {str(e)}")

@fastapi_app.put("/admin/features")
async def update_features(features: FeatureConfig, user: User = Depends(get_current_user)):
    """Updates the feature configuration (admin only)."""
    check_admin_access(user)
    
    try:
        # Convert Pydantic model to dict
        features_dict = features.dict()
        
        # Save using config module
        if save_features_config(features_dict):
            return {"status": "success", "features": features_dict}
        else:
            raise HTTPException(status_code=500, detail="Failed to save features configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating features: {str(e)}")

# --- Knowledge Field Domain Management Endpoints ---
@fastapi_app.get("/admin/knowledge_field_domains")
async def get_knowledge_field_domains(user: User = Depends(get_current_user)):
    """Gets all knowledge fields and their domain permissions (admin only)."""
    check_admin_access(user)
    
    try:
        knowledge_fields_data = load_json_config("knowledge_fields.json", {})
        
        if not knowledge_fields_data:
            # If the file doesn't exist, scan Documents folder for existing fields
            documents_path = "Documents"
            if os.path.isdir(documents_path):
                for d in os.listdir(documents_path):
                    if os.path.isdir(os.path.join(documents_path, d)) and not d.startswith('.'):
                        knowledge_fields_data[d] = {"domains": []}
        
        # Convert to list format expected by frontend
        result = []
        for field_name, config in knowledge_fields_data.items():
            if isinstance(config, dict):
                domains = config.get("domains", [])
            else:
                domains = []  # Old format compatibility
            result.append({
                "field_name": field_name,
                "domains": domains
            })
        
        return {"knowledge_fields": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading knowledge field domains: {str(e)}")

@fastapi_app.post("/admin/knowledge_field_domains")
async def update_knowledge_field_domains(domains_data: List[KnowledgeFieldDomain], user: User = Depends(get_current_user)):
    """Updates knowledge field domain permissions (admin only)."""
    check_admin_access(user)
    
    try:
        # Load existing data using config module
        existing_data = load_json_config("knowledge_fields.json", {})
        
        # Update with new domain data
        updated_data = {}
        for domain_config in domains_data:
            field_name = domain_config.field_name
            domains = domain_config.domains
            
            # Only keep fields that actually exist in the Documents folder
            documents_path = "Documents"
            field_path = os.path.join(documents_path, field_name)
            if os.path.exists(field_path) and os.path.isdir(field_path):
                updated_data[field_name] = {"domains": domains}
        
        # Save updated data using config module
        if save_json_config("knowledge_fields.json", updated_data):
            return {"status": "success", "message": f"Updated {len(updated_data)} knowledge fields"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save knowledge fields configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating knowledge field domains: {str(e)}")

# --- Helper function for admin check ---
def check_admin_access(user: User):
    """Check if the current user has admin access."""
    try:
        admins_data = load_admins_config()
        admin_list = admins_data.get("admins", [])
        
        if not (hasattr(user, 'username') and user.username in admin_list):
            raise HTTPException(status_code=403, detail="Admin access required")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=403, detail="Admin access required")

def extract_domain_from_email(email: str) -> str:
    """Extract the domain from an email address."""
    if not email or "@" not in email:
        return ""
    return email.split("@")[1].lower()

def get_user_accessible_fields(user: User, knowledge_fields_data: dict) -> list:
    """Filter knowledge fields based on user's domain permissions."""
    if not hasattr(user, 'username') or not user.username:
        return []
    
    user_domain = extract_domain_from_email(user.username)
    if not user_domain:
        return []
    
    accessible_fields = []
    
    for field_name, field_config in knowledge_fields_data.items():
        # Handle both old format (list) and new format (dict with domains)
        if isinstance(field_config, dict):
            allowed_domains = field_config.get("domains", [])
            if user_domain in allowed_domains:
                accessible_fields.append(field_name)
        else:
            # Old format compatibility - if it's just a string, allow access for admins only
            # Check if user is admin using config module
            try:
                admins_data = load_admins_config()
                admin_list = admins_data.get("admins", [])
                
                if user.username in admin_list:
                    accessible_fields.append(field_name)
            except:
                pass  # If admin check fails, don't grant access
    
    return accessible_fields

# --- User Logging Endpoints ---
@fastapi_app.get("/admin/login_sessions")
async def get_login_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets login sessions for admin review."""
    check_admin_access(user)
    
    try:
        # Get all login sessions with user information
        sessions = db.query(LoginSession).join(User).order_by(desc(LoginSession.login_time)).all()
        
        result = []
        for session in sessions:
            duration = None
            if session.logout_time:
                # Calculate duration and format as HH:MM:SS
                delta = session.logout_time - session.login_time
                total_seconds = int(delta.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                duration = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            result.append({
                "id": session.id,
                "username": session.user.username,
                "login_time": session.login_time.isoformat(),
                "logout_time": session.logout_time.isoformat() if session.logout_time else None,
                "duration": duration,
                "session_id": session.session_id
            })
        
        return {"login_sessions": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching login sessions: {str(e)}")

@fastapi_app.get("/admin/chat_questions")
async def get_chat_questions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets chat questions for admin review."""
    check_admin_access(user)
    
    try:
        # Get all chat questions with user information
        questions = db.query(ChatQuestionLog).join(User).order_by(desc(ChatQuestionLog.timestamp)).all()
        
        result = []
        for question in questions:
            result.append({
                "id": question.id,
                "username": question.user.username,
                "question_text": question.question_text,
                "timestamp": question.timestamp.isoformat(),
                "session_id": question.session_id,
                "rating": question.rating if question.rating else "n/a"
            })
        
        return {"chat_questions": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat questions: {str(e)}")

@fastapi_app.get("/admin/user_summary")
async def get_user_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets user activity summary for admin review."""
    check_admin_access(user)
    
    try:
        # Get summary data for all users
        users = db.query(User).all()
        
        result = []
        for user_record in users:
            # Count login sessions
            login_count = db.query(LoginSession).filter(LoginSession.user_id == user_record.id).count()
            
            # Count chat questions
            question_count = db.query(ChatQuestionLog).filter(ChatQuestionLog.user_id == user_record.id).count()
            
            # Get last login
            last_login = db.query(LoginSession).filter(LoginSession.user_id == user_record.id).order_by(desc(LoginSession.login_time)).first()
            
            result.append({
                "username": user_record.username,
                "login_count": login_count,
                "question_count": question_count,
                "last_login": last_login.login_time.isoformat() if last_login else None
            })
        
        return {"user_summary": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user summary: {str(e)}")

@fastapi_app.get("/admin/faulty_code_logs")
async def get_faulty_code_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets faulty code logs for admin review."""
    check_admin_access(user)
    
    try:
        # Get all faulty code logs with user information
        code_logs = db.query(FaultyCodeLog).join(User).order_by(desc(FaultyCodeLog.timestamp)).all()
        
        result = []
        for log in code_logs:
            result.append({
                "id": log.id,
                "username": log.user.username,
                "original_question": log.original_question,
                "python_code": log.python_code,
                "security_failure_reason": log.security_failure_reason,
                "timestamp": log.timestamp.isoformat(),
                "session_id": log.session_id,
                "attempt_number": log.attempt_number
            })
        
        return {"faulty_code_logs": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching faulty code logs: {str(e)}")

@fastapi_app.post("/admin/export_faulty_code_logs")
async def export_faulty_code_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Exports faulty code logs to Excel."""
    check_admin_access(user)
    
    try:
        # Get all faulty code logs with user information
        code_logs = db.query(FaultyCodeLog).join(User).order_by(desc(FaultyCodeLog.timestamp)).all()
        
        if not code_logs:
            # Return empty Excel file if no data
            df = pd.DataFrame(columns=["User", "Time", "Cause", "Question", "Python Code", "Security Failure", "Attempt", "Session ID"])
        else:
            data = []
            german_tz = pytz.timezone('Europe/Berlin')
            
            for log in code_logs:
                try:
                    # Convert UTC time to German timezone
                    if log.timestamp.tzinfo is None:
                        # If timestamp is naive, assume it's UTC
                        timestamp_utc = log.timestamp.replace(tzinfo=pytz.UTC)
                    else:
                        timestamp_utc = log.timestamp.astimezone(pytz.UTC)
                    
                    timestamp_german = timestamp_utc.astimezone(german_tz)
                    
                    # Determine cause based on security_failure_reason
                    cause = 'insecure' if any(keyword in str(log.security_failure_reason).lower() for keyword in 
                                           ['sicherheit', 'security', 'risiko', 'verboten', 'forbidden']) else 'error'
                    
                    data.append({
                        "User": str(log.user.username),
                        "Time": timestamp_german.strftime("%d.%m.%Y %H:%M:%S"),
                        "Cause": cause,
                        "Question": str(log.original_question),
                        "Python Code": str(log.python_code),
                        "Security Failure": str(log.security_failure_reason),
                        "Attempt": str(log.attempt_number),
                        "Session ID": str(log.session_id)
                    })
                except Exception as item_error:
                    print(f"Error processing faulty code log {log.id}: {item_error}")
                    continue
            
            # Create DataFrame
            df = pd.DataFrame(data)
        
        # Create Excel file
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Faulty Code', index=False)
            
            # Format the Excel file
            workbook = writer.book
            worksheet = writer.sheets['Faulty Code']
            
            # Set column widths
            worksheet.set_column('A:A', 25)  # Benutzer
            worksheet.set_column('B:B', 20)  # Zeitpunkt
            worksheet.set_column('C:C', 15)  # Ursache
            worksheet.set_column('D:D', 40)  # Originalfrage
            worksheet.set_column('E:E', 60)  # Python Code
            worksheet.set_column('F:F', 40)  # Sicherheitsfehler
            worksheet.set_column('G:G', 10)  # Versuch
            worksheet.set_column('H:H', 25)  # Session ID
        
        excel_buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment;filename=faulty_code.xlsx"}
        )
    except Exception as e:
        import traceback
        print(f"Excel export error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error exporting faulty code logs: {str(e)}")

@fastapi_app.post("/admin/export_login_sessions")
async def export_login_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Exports login sessions to Excel."""
    check_admin_access(user)
    
    try:
        # Get all login sessions with user information
        sessions = db.query(LoginSession).join(User).order_by(desc(LoginSession.login_time)).all()
        
        data = []
        german_tz = pytz.timezone('Europe/Berlin')
        
        for session in sessions:
            duration = None
            if session.logout_time:
                # Calculate duration and format as HH:MM:SS
                delta = session.logout_time - session.login_time
                total_seconds = int(delta.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                duration = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            # Convert UTC times to German timezone
            login_time_german = session.login_time.replace(tzinfo=pytz.UTC).astimezone(german_tz)
            logout_time_german = None
            if session.logout_time:
                logout_time_german = session.logout_time.replace(tzinfo=pytz.UTC).astimezone(german_tz)
            
            data.append({
                "Benutzer": session.user.username,
                "Anmeldung": login_time_german.strftime("%d.%m.%Y %H:%M:%S"),
                "Abmeldung": logout_time_german.strftime("%d.%m.%Y %H:%M:%S") if logout_time_german else "Noch aktiv",
                "Dauer": duration if duration else "Noch aktiv",
                "Session ID": session.session_id
            })
        
        # Create DataFrame and Excel file
        df = pd.DataFrame(data)
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Anmeldungen', index=False)
            
            # Format the Excel file
            workbook = writer.book
            worksheet = writer.sheets['Anmeldungen']
            
            # Set column widths
            worksheet.set_column('A:A', 30)  # Benutzer
            worksheet.set_column('B:B', 20)  # Anmeldung
            worksheet.set_column('C:C', 20)  # Abmeldung
            worksheet.set_column('D:D', 15)  # Dauer
            worksheet.set_column('E:E', 40)  # Session ID
        
        excel_buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment;filename=anmeldungen.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting login sessions: {str(e)}")

@fastapi_app.post("/admin/export_chat_questions")
async def export_chat_questions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Exports chat questions to Excel."""
    check_admin_access(user)
    
    try:
        # Get all chat questions with user information
        questions = db.query(ChatQuestionLog).join(User).order_by(desc(ChatQuestionLog.timestamp)).all()
        
        if not questions:
            # Return empty Excel file if no data
            df = pd.DataFrame(columns=["Benutzer", "Zeitpunkt", "Frage", "Session ID"])
        else:
            data = []
            german_tz = pytz.timezone('Europe/Berlin')
            
            for question in questions:
                try:
                    # Convert UTC time to German timezone
                    if question.timestamp.tzinfo is None:
                        # If timestamp is naive, assume it's UTC
                        timestamp_utc = question.timestamp.replace(tzinfo=pytz.UTC)
                    else:
                        timestamp_utc = question.timestamp.astimezone(pytz.UTC)
                    
                    timestamp_german = timestamp_utc.astimezone(german_tz)
                    
                    data.append({
                        "Benutzer": str(question.user.username),
                        "Zeitpunkt": timestamp_german.strftime("%d.%m.%Y %H:%M:%S"),
                        "Frage": str(question.question_text),
                        "Session ID": str(question.session_id)
                    })
                except Exception as item_error:
                    print(f"Error processing question {question.id}: {item_error}")
                    continue
            
            # Create DataFrame
            df = pd.DataFrame(data)
        
        # Create Excel file
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Chat-Fragen', index=False)
            
            # Format the Excel file
            workbook = writer.book
            worksheet = writer.sheets['Chat-Fragen']
            
            # Set column widths
            worksheet.set_column('A:A', 30)  # Benutzer
            worksheet.set_column('B:B', 20)  # Zeitpunkt
            worksheet.set_column('C:C', 80)  # Frage
            worksheet.set_column('D:D', 40)  # Session ID
        
        excel_buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(excel_buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment;filename=chat_fragen.xlsx"}
        )
    except Exception as e:
        import traceback
        print(f"Excel export error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error exporting chat questions: {str(e)}")

@fastapi_app.delete("/admin/cleanup_old_data")
async def cleanup_old_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Deletes data older than 1 year."""
    check_admin_access(user)
    
    try:
        # Calculate cutoff date (1 year ago)
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        
        # Delete old login sessions
        deleted_sessions = db.query(LoginSession).filter(LoginSession.login_time < cutoff_date).delete()
        
        # Delete old chat questions
        deleted_questions = db.query(ChatQuestionLog).filter(ChatQuestionLog.timestamp < cutoff_date).delete()
        
        db.commit()
        
        return {
            "status": "success",
            "deleted_sessions": deleted_sessions,
            "deleted_questions": deleted_questions,
            "cutoff_date": cutoff_date.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error cleaning up old data: {str(e)}")

# --- Chat History Endpoints ---
@fastapi_app.get("/chat_history/")
async def get_chat_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets the last 10 chat histories for the user."""
    return logic.get_chat_history(db, user)

@fastapi_app.post("/chat_history/")
async def save_chat_history(chat: ChatHistoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Saves a new chat history."""
    return logic.save_chat_history(db, user, chat.title, chat.messages, chat.selected_fields)

@fastapi_app.get("/chat_history/{chat_id}")
async def get_chat_history_detail(chat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Gets the complete chat history with messages."""
    return logic.get_chat_history_detail(db, user, chat_id)

@fastapi_app.delete("/chat_history/{chat_id}")
async def delete_chat_history(chat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Deletes a chat history."""
    return logic.delete_chat_history(db, user, chat_id)

@fastapi_app.post("/chat_questions/rate")
async def rate_question(rating: QuestionRating, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Rate a chat question as good or poor."""
    try:
        # Find the question and verify it belongs to the user
        question = db.query(ChatQuestionLog).filter(
            ChatQuestionLog.id == rating.question_id,
            ChatQuestionLog.user_id == user.id
        ).first()
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Update the rating
        question.rating = rating.rating
        db.commit()
        
        return {"status": "success", "message": f"Question rated as {rating.rating}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error rating question: {str(e)}")

# --- Temporary File Handling ---
TEMP_UPLOADS_DIR = "temp_uploads"
if not os.path.exists(TEMP_UPLOADS_DIR):
    os.makedirs(TEMP_UPLOADS_DIR)

def is_markdown_table(content: str) -> bool:
    """Checks if the content is likely a markdown table."""
    lines = content.strip().split('\n')
    if len(lines) < 2:  # A header and separator line are minimum
        return False
    header = lines[0]
    separator = lines[1]
    # Check for typical markdown table structure
    return (
        header.strip().startswith('|') and
        header.strip().endswith('|') and
        separator.strip().startswith('|') and
        '---' in separator
    )

def convert_markdown_to_csv(markdown_content: str) -> str:
    """Converts a markdown table into a robust CSV string, handling quotes."""
    lines = markdown_content.strip().split('\n')
    
    header_line = lines[0]
    data_lines = lines[2:]  # Skip separator line

    header_cols = [h.strip() for h in header_line.strip().strip('|').split('|')]
    
    def escape_csv_field(field):
        """Quotes a field if it contains commas, quotes, or newlines."""
        if ',' in field or '"' in field or '\n' in field:
            escaped_field = field.replace('"', '""')
            return f'"{escaped_field}"'
        return field

    csv_lines = [",".join(map(escape_csv_field, header_cols))]
    
    for row in data_lines:
        row_cols = [c.strip() for c in row.strip().strip('|').split('|')]
        if len(row_cols) == len(header_cols):
            csv_lines.append(",".join(map(escape_csv_field, row_cols)))
        
    return "\n".join(csv_lines)

def load_features():
    """Helper function to load current feature configuration."""
    return load_features_config()

async def save_temp_file(content: str, original_filename: str) -> str:
    """
    Saves content to a temporary file. If the content is a markdown table,
    it's converted to a clean CSV format.
    """
    # Decision to convert is based on content structure, not just filename
    if is_markdown_table(content):
        saved_content = convert_markdown_to_csv(content)
        temp_filename = f"{uuid.uuid4()}.csv"  # Always save as csv for consistency
    else:
        saved_content = content
        file_extension = os.path.splitext(original_filename)[1]
        temp_filename = f"{uuid.uuid4()}{file_extension}"

    temp_file_path = os.path.join(TEMP_UPLOADS_DIR, temp_filename)
    with open(temp_file_path, "w", encoding="utf-8") as f:
        f.write(saved_content)
    return temp_file_path

@fastapi_app.post("/uploadfile/")
async def create_upload_file(file: UploadFile = File(...)):
    """
    Accepts a file upload (CSV, Excel, TXT, SQL, Image, PDF, DOCX), reads its content, and returns it.
    For CSV/Excel, content is returned as structured data.
    For TXT/SQL, content is returned as plain text.
    Images are handled client-side, but the endpoint allows the upload.
    PDF/DOCX are saved for RAG processing.
    """
    filename = file.filename
    features = load_features()
    
    # Check feature permissions based on file type
    if any(filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp"]):
        if not features.get("image_upload", True):
            raise HTTPException(status_code=403, detail="Image upload is disabled")
    elif any(filename.lower().endswith(ext) for ext in [".pdf", ".docx"]):
        if not features.get("pdf_docx_upload", True):
            raise HTTPException(status_code=403, detail="PDF/DOCX upload is disabled")
    elif any(filename.lower().endswith(ext) for ext in [".txt", ".sql"]):
        if not features.get("txt_sql_upload", True):
            raise HTTPException(status_code=403, detail="TXT/SQL upload is disabled")
    elif any(filename.lower().endswith(ext) for ext in [".csv", ".xlsx"]):
        if not features.get("xlsx_csv_analysis", True):
            raise HTTPException(status_code=403, detail="Excel/CSV analysis is disabled")
    
    allowed_extensions = [".csv", ".xlsx", ".txt", ".sql", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx"]
    if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Invalid file type.")

    # For image types, we don't need to process them here, just acknowledge.
    # The actual image data is handled by the frontend and sent via Socket.IO.
    if any(filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp"]):
        return {"filename": filename, "type": "image"}

    # --- New: Handle PDF/DOCX for RAG ---
    if any(filename.lower().endswith(ext) for ext in [".pdf", ".docx"]):
        try:
            # Save the file to a temporary location for processing
            temp_rag_dir = os.path.join(TEMP_UPLOADS_DIR, str(uuid.uuid4()))
            os.makedirs(temp_rag_dir, exist_ok=True)
            temp_file_path = os.path.join(temp_rag_dir, filename)
            
            with open(temp_file_path, "wb") as f:
                f.write(await file.read())
            
            # Return a new type to the frontend to trigger RAG processing
            return {"filename": filename, "type": "rag_document", "temp_path": temp_file_path}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save RAG file: {e}")

    try:
        contents = await file.read()
        
        if filename.endswith(".csv") or filename.endswith(".xlsx"):
            df = None
            if filename.endswith(".csv"):
                df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            elif filename.endswith(".xlsx"):
                df = pd.read_excel(io.BytesIO(contents))
            
            # Convert all data to strings to ensure proper JSON serialization
            df = df.astype(str).replace('nan', '')

            # For large files, sending raw data is more efficient than markdown
            return {
                "filename": filename,
                "type": "table_data", # New type for direct data handling
                "data": {
                    "columns": df.columns.tolist(),
                    "data": df.values.tolist()
                }
            }
        
        elif filename.endswith(".txt"):
            text_content = contents.decode('utf-8')
            return {"filename": filename, "type": "text", "content": text_content}
        
        elif filename.endswith(".sql"):
            text_content = contents.decode('utf-8')
            return {"filename": filename, "type": "sql", "content": text_content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {e}")

@fastapi_app.post("/export/pdf")
async def export_pdf(request: Request):
    """
    Exports the chat history to a PDF file, including text, tables, and images.
    """
    data = await request.json()
    messages = data.get("messages", [])

    pdf = FPDF()
    pdf.add_page()
    
    # Try to add Unicode support with available fonts
    try:
        # Try different font paths for different systems
        font_paths = [
            '/System/Library/Fonts/Supplemental/Arial.ttf',  # macOS
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux
            '/Windows/Fonts/arial.ttf',  # Windows
        ]
        
        font_loaded = False
        for font_path in font_paths:
            try:
                if os.path.exists(font_path):
                    pdf.add_font('Arial', '', font_path, uni=True)
                    font_loaded = True
                    break
            except:
                continue
        
        if font_loaded:
            pdf.set_font("Arial", size=12)
        else:
            # Fallback to built-in fonts
            pdf.set_font("Arial", size=12)
    except:
        # Ultimate fallback to built-in fonts
        pdf.set_font("Arial", size=12)
    
    pdf.set_fill_color(240, 240, 240)
    pdf.set_text_color(0, 0, 0)

    for message in messages:
        role = message.get("role", "unknown")
        content = message.get("content", "")
        
        # --- User Message ---
        if role == "user":
            pdf.set_font("Arial", 'B', 12)
            pdf.multi_cell(0, 10, f"User: {content}", 0, 'L')
            if message.get("imagePreview"):
                try:
                    # Handle base64 image preview
                    img_data_uri = message.get("imagePreview")
                    header, encoded = img_data_uri.split(",", 1)
                    img_data = base64.b64decode(encoded)
                    
                    with Image.open(io.BytesIO(img_data)) as img:
                        # Use a temporary file to handle various image formats for FPDF
                        temp_img_path = os.path.join(TEMP_UPLOADS_DIR, f"temp_export_{uuid.uuid4()}.{img.format.lower()}")
                        img.save(temp_img_path)

                        # Add image to PDF, respecting page boundaries
                        pdf.image(temp_img_path, w=pdf.w - 20) # width = page width - margins
                        os.remove(temp_img_path) # Clean up temp file

                except Exception as e:
                    pdf.set_font("Arial", 'I', 10)
                    pdf.multi_cell(0, 10, f"[Could not embed uploaded image: {e}]", 0, 'L')
            pdf.ln(5)
            continue

        # --- Assistant Message ---
        if role == "assistant":
            pdf.set_font("Arial", '', 12)
            if content:
                pdf.multi_cell(0, 10, f"Assistant: {content}", 0, 'L')

            # --- Handle Tables ---
            if message.get("table"):
                try:
                    table_data = message.get("table")
                    df = pd.DataFrame(table_data['data'], columns=table_data['columns'])
                    
                    # Dynamic font size and column width calculation
                    effective_page_width = pdf.w - 2 * pdf.l_margin
                    
                    # Start with a base font size and decrease if necessary
                    font_size = 10
                    while True:
                        pdf.set_font("Arial", size=font_size)
                        total_width = sum(pdf.get_string_width(str(col)) for col in df.columns)
                        if total_width < effective_page_width or font_size <= 4:
                            break
                        font_size -= 0.5

                    # Calculate column widths based on content
                    col_widths = {col: pdf.get_string_width(str(col)) + 2 for col in df.columns}
                    for index, row in df.iterrows():
                        for col in df.columns:
                            width = pdf.get_string_width(str(row[col])) + 2
                            if width > col_widths[col]:
                                col_widths[col] = width
                    
                    total_content_width = sum(col_widths.values())
                    width_ratio = effective_page_width / total_content_width if total_content_width > 0 else 1
                    
                    final_col_widths = {k: v * width_ratio for k, v in col_widths.items()}

                    # Header
                    pdf.set_font("Arial", 'B', font_size)
                    for col in df.columns:
                        pdf.cell(final_col_widths[col], 10, str(col), border=1, align='C')
                    pdf.ln()
                    
                    # Rows
                    pdf.set_font("Arial", '', font_size)
                    for index, row in df.iterrows():
                        for col in df.columns:
                            pdf.cell(final_col_widths[col], 10, str(row[col]), border=1)
                        pdf.ln()

                except Exception as e:
                    pdf.set_font("Arial", 'I', 10)
                    pdf.multi_cell(0, 10, f"[Could not render table: {e}]", 0, 'L')

            # --- Handle Base64 Images (e.g., from Matplotlib) ---
            if message.get("images"):
                for img_b64 in message.get("images"):
                    try:
                        img_data = base64.b64decode(img_b64)
                        with Image.open(io.BytesIO(img_data)) as img:
                            temp_img_path = os.path.join(TEMP_UPLOADS_DIR, f"temp_export_{uuid.uuid4()}.{img.format.lower()}")
                            img.save(temp_img_path)
                            pdf.image(temp_img_path, w=pdf.w - 20)
                            os.remove(temp_img_path)
                    except Exception as e:
                        pdf.set_font("Arial", 'I', 10)
                        pdf.multi_cell(0, 10, f"[Could not embed generated image: {e}]", 0, 'L')
            
            # --- Handle Plotly HTML plots (by referencing saved image paths) ---
            if message.get("html_plot_paths"):
                 for img_path in message.get("html_plot_paths"):
                    try:
                        if os.path.exists(img_path):
                            pdf.image(img_path, w=pdf.w - 20)
                        else:
                            pdf.set_font("Arial", 'I', 10)
                            pdf.multi_cell(0, 10, f"[Plot image not found at: {img_path}]", 0, 'L')
                    except Exception as e:
                        pdf.set_font("Arial", 'I', 10)
                        pdf.multi_cell(0, 10, f"[Could not embed plot image: {e}]", 0, 'L')

        pdf.ln(5)

    pdf_output = pdf.output(dest='S')
    
    return StreamingResponse(
        io.BytesIO(pdf_output),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment;filename=chat_export.pdf"}
    )

# In-memory session management for chat history
# In a production environment, you might want to use a more persistent storage like Redis.
sessions = {}

def cleanup_session_file(sid):
    """Safely removes all temporary files and directories associated with a session."""
    if sid not in sessions:
        return

    # Clean up standard uploaded file
    file_path = sessions[sid].get("uploaded_file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"Cleaned up temp file: {file_path}")
        except OSError as e:
            print(f"Error cleaning up temp file {file_path}: {e}")
    sessions[sid]["uploaded_file_path"] = None

    # Clean up RAG vector store directory
    rag_path = sessions[sid].get("rag_vector_store_path")
    if rag_path and os.path.exists(rag_path):
        try:
            # The vector store is a directory, so use shutil.rmtree
            shutil.rmtree(rag_path)
            print(f"Cleaned up RAG directory: {rag_path}")
        except OSError as e:
            print(f"Error cleaning up RAG directory {rag_path}: {e}")
    sessions[sid]["rag_vector_store_path"] = None
    
    # Clean up the initially uploaded RAG file
    rag_file_path = sessions[sid].get("uploaded_rag_file_path")
    if rag_file_path and os.path.exists(rag_file_path):
        try:
            # The file is inside the RAG directory which is already deleted,
            # but we can remove its parent if it's empty.
            parent_dir = os.path.dirname(rag_file_path)
            if os.path.exists(parent_dir) and not os.listdir(parent_dir):
                 shutil.rmtree(parent_dir)
                 print(f"Cleaned up parent RAG upload directory: {parent_dir}")
        except OSError as e:
            print(f"Error cleaning up parent RAG directory for {rag_file_path}: {e}")
    sessions[sid]["uploaded_rag_file_path"] = None

# --- Helper function to get user from session ---
async def get_user_from_session(sid):
    """Get the current user from the session."""
    try:
        if sid not in sessions:
            return None
        
        # Get the token from the session - we'll need to store this during connect
        token = sessions[sid].get("access_token")
        if not token:
            return None
        
        # Create a mock request to use the existing auth system
        mock_request = Request(scope={"type": "http", "headers": [
            (b"authorization", f"Bearer {token}".encode('utf-8'))
        ]})
        
        # Use the existing get_current_user function
        db = next(get_db())
        try:
            user = await get_current_user(mock_request, db)
            return user
        finally:
            db.close()
    except Exception as e:
        print(f"Error getting user from session {sid}: {e}")
        return None

# --- Helper function to log chat questions ---
async def log_chat_question(sid, question_text):
    """Log a chat question to the database and return the question ID."""
    try:
        if sid not in sessions:
            return None
        
        user_id = sessions[sid].get("user_id")
        if not user_id:
            return None
        
        # Create chat question log entry
        db = next(get_db())
        try:
            question_log = ChatQuestionLog(
                user_id=user_id,
                question_text=question_text,
                timestamp=datetime.utcnow(),
                session_id=sid
            )
            db.add(question_log)
            db.commit()
            
            # Store the question ID in the session for this message
            if sid in sessions:
                if "current_question_id" not in sessions[sid]:
                    sessions[sid]["current_question_id"] = None
                sessions[sid]["current_question_id"] = question_log.id
            
            print(f"Chat question logged for user {user_id}: {question_text[:50]}...")
            return question_log.id
        finally:
            db.close()
    except Exception as e:
        print(f"Error logging chat question: {e}")
        return None

# --- Socket.IO Event Handlers ---
@sio.event
async def connect(sid, environ, auth):
    """Handles new client connections with authentication."""
    print(f"Client connected: {sid}")
    
    # Initialize session
    sessions[sid] = {
        "messages": [],
        "source_mode": None,
        "uploaded_file_path": None,
        "rag_vector_store_path": None, # For RAG documents
        "uploaded_rag_file_path": None, # Path to the original PDF/DOCX
        "access_token": auth.get("token") if auth else None, # Store token for user lookup
        "user_id": None # Will be set after user lookup
    }
    
    # Log the login session
    try:
        user = await get_user_from_session(sid)
        if user:
            sessions[sid]["user_id"] = user.id
            
            # Handle login session tracking
            db = next(get_db())
            try:
                # First, close any existing active sessions for this user
                existing_sessions = db.query(LoginSession).filter(
                    LoginSession.user_id == user.id,
                    LoginSession.logout_time.is_(None)
                ).all()
                
                current_time = datetime.utcnow()
                for existing_session in existing_sessions:
                    existing_session.logout_time = current_time
                    print(f"Closed previous session {existing_session.session_id} for user {user.username}")
                
                # Create new login session record
                login_session = LoginSession(
                    user_id=user.id,
                    session_id=sid,
                    login_time=current_time
                )
                db.add(login_session)
                db.commit()
                print(f"New login session logged for user {user.username}")
            finally:
                db.close()
    except Exception as e:
        print(f"Error logging login session: {e}")
    
    await sio.emit("status", {"message": "Connected to server."}, to=sid)
    return True # Accept the connection

@sio.event
async def disconnect(sid):
    """Handles client disconnections."""
    print(f"Client disconnected: {sid}")
    
    # Log logout time
    try:
        if sid in sessions:
            user_id = sessions[sid].get("user_id")
            if user_id:
                # Update logout time for the most recent login session
                db = next(get_db())
                try:
                    login_session = db.query(LoginSession).filter(
                        LoginSession.user_id == user_id,
                        LoginSession.session_id == sid,
                        LoginSession.logout_time.is_(None)
                    ).first()
                    
                    if login_session:
                        login_session.logout_time = datetime.utcnow()
                        db.commit()
                        print(f"Logout time logged for user {user_id}")
                finally:
                    db.close()
    except Exception as e:
        print(f"Error logging logout time: {e}")
    
    cleanup_session_file(sid) # Clean up file on disconnect
    sessions.pop(sid, None)


@sio.event
async def new_dialog(sid):
    """Clears the conversation history and all session data for a new dialog."""
    if sid in sessions:
        cleanup_session_file(sid) # Clean up all temp files/dirs on new dialog
        sessions[sid] = {
            "messages": [],
            "source_mode": None,
            "uploaded_file_path": None,
            "rag_vector_store_path": None,
            "uploaded_rag_file_path": None,
        }
        print(f"New dialog started for session: {sid}")
        await sio.emit("status", {"message": "New dialog started."}, to=sid)

async def handle_python_request(sid, conversation_history, file_path=None, file_header=None):
    """Helper function to process python requests asynchronously."""
    try:
        assistant_response = {"role": "assistant", "content": ""}
        
        # Get user_id from session for logging
        user_id = sessions[sid].get("user_id") if sid in sessions else None
        
        async for result in logic.process_python_question(sid, conversation_history, file_path=file_path, file_header=file_header, user_id=user_id):
            status = result.get("status")
            code = result.get("code", "")

            if status == "generating_code":
                await sio.emit("python_status", {"status": "generating", "attempt": result.get("attempt")}, to=sid)
            
            elif status == "security_check":
                await sio.emit("python_status", {"status": "security_check"}, to=sid)

            elif status == "executing_code":
                await sio.emit("python_status", {"status": "executing", "code": code}, to=sid)
            
            elif status == "success":
                final_code = result.get("code", "")
                explanation = result.get("explanation", "") # Explanation extrahieren
                
                payload = {"code": final_code, "explanation": explanation}

                if "html_plots" in result and "html_plot_paths" in result:
                    payload["html_plots"] = result.get("html_plots")
                    payload["html_plot_paths"] = result.get("html_plot_paths") # Pass the paths to the frontend
                    assistant_response["html_plot_paths"] = result.get("html_plot_paths") # Also save paths in history
                    assistant_response["content"] = f"{len(payload['html_plots'])} chart(s) have been successfully generated."
                elif "table" in result:
                    payload["table"] = result.get("table")
                    assistant_response["content"] = "The table was successfully generated."
                elif "single_value" in result:
                    payload["single_value"] = result.get("single_value")
                    assistant_response["content"] = "The single value was successfully generated."
                else:
                    payload["output"] = result.get("output", "")
                    assistant_response["content"] = payload["output"]
                
                await sio.emit("python_result", payload, to=sid)
                
                sessions[sid]["messages"].append(assistant_response)
                return

            elif status == "error":
                error_message = result.get("error", "An unknown error occurred.")
                await sio.emit("python_error", {"error": error_message, "code": code}, to=sid)
                # Do not exit, allow for retries

            elif status == "failed":
                error_message = result.get("error", "Exceeded maximum retries.")
                await sio.emit("python_error", {"error": error_message, "code": code}, to=sid)
                return # Exit after final failure

    except Exception as e:
        error_message = f"An unexpected error occurred in handle_python_request: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

async def stream_and_process_response(sid, generator, conversation_history, **kwargs):
    """A generic function to handle the streaming and processing of a generator's response."""
    assistant_response = {"role": "assistant", "content": ""}
    question_id = kwargs.get("question_id")  # Get the question ID from kwargs
    try:
        # Validate inputs
        if not sid:
            print("Error: No session ID provided to stream_and_process_response")
            return
        
        if not generator:
            print("Error: No generator provided to stream_and_process_response")
            await sio.emit("error", {"message": "Internal error: No response generator"}, to=sid)
            return
            
        if not isinstance(conversation_history, list):
            print(f"Error: conversation_history is not a list: {type(conversation_history)}")
            await sio.emit("error", {"message": "Internal error: Invalid conversation history"}, to=sid)
            return

        async for result in generator:
            try:
                if not isinstance(result, dict) or "type" not in result:
                    print(f"Warning: Invalid result format: {result}")
                    continue

                event_type = result.get("type")
                
                if event_type == "python_required":
                    file_path = None
                    document_content = kwargs.get("document_content")
                    original_filename = kwargs.get("original_filename", "data.txt")
                    file_header = kwargs.get("file_header")

                    if document_content:
                        # Clean up any old file before creating a new one for the same session
                        cleanup_session_file(sid)
                        file_path = await save_temp_file(document_content, original_filename)
                        # Store the new file path in the session
                        if sid in sessions:
                            sessions[sid]["uploaded_file_path"] = file_path
                    
                    await handle_python_request(sid, conversation_history, file_path=file_path, file_header=file_header)
                    return
                
                # Special handling for the 'image' event type, which has a different structure
                elif event_type == "image":
                    # The result now contains the URL and the raw bytes of the new image
                    image_url = result.get('url')
                    image_bytes = result.get('bytes')
                    extended_prompt = result.get('extended_prompt') # Get the new field
                    
                    # Prepare the payload for the client
                    client_payload = {'url': image_url, 'extended_prompt': extended_prompt}
                    if image_bytes:
                        # If we have the bytes, encode them to base64 for the client to cache
                        new_image_b64 = base64.b64encode(image_bytes).decode('utf-8')
                        client_payload['image_b64'] = new_image_b64
                        # Also store it in the assistant's response for history
                        assistant_response['image_b64'] = new_image_b64

                    assistant_response['imageUrl'] = image_url
                    assistant_response['extended_prompt'] = extended_prompt # Also store in history
                    await sio.emit("image", client_payload, to=sid)
                    continue # Skip the rest of the loop for this event

                elif event_type == "status":
                    payload = result.get("data", "")
                    await sio.emit("status", {"message": payload}, to=sid)
                    
                elif event_type == "meta":
                    payload = result.get("data", {})
                    if isinstance(payload, dict):
                        assistant_response.update(payload)
                        # Always update source_mode in the session, even if it's null.
                        # This ensures that after a direct answer, the mode is reset.
                        if sid in sessions:
                            sessions[sid]["source_mode"] = payload.get("source_mode")
                            # Add the current question_id to the payload
                            if "current_question_id" in sessions[sid]:
                                payload["question_id"] = sessions[sid]["current_question_id"]
                        
                        # Add the question_id to the assistant response for rating
                        if question_id:
                            assistant_response["questionId"] = question_id
                            payload["question_id"] = question_id
                        
                        await sio.emit("answer_meta", payload, to=sid)
                    else:
                        print(f"Warning: meta payload is not a dict: {payload}")
                        
                elif event_type == "chunk":
                    payload = result.get("data", "")
                    if isinstance(payload, str):
                        assistant_response["content"] += payload
                        await sio.emit("answer_chunk", payload, to=sid)
                    else:
                        print(f"Warning: chunk payload is not a string: {payload}")
                        
                elif event_type == "clarification":
                    payload = result.get("data", {})
                    await sio.emit("clarification", {"data": payload}, to=sid)
                    # Do not break, as the logic in get_answer already returns after yielding clarification
                    
                elif event_type == "end":
                    await sio.emit("answer_end", to=sid)
                    break
                    
                else:
                    print(f"Warning: Unknown event type: {event_type}")
                    
            except Exception as inner_e:
                print(f"Error processing individual result in stream_and_process_response: {inner_e}")
                import traceback
                traceback.print_exc()
                continue  # Continue with next result
        
        # Only add to conversation history if we have meaningful content
        if assistant_response.get("content") or assistant_response.get("imageUrl"):
            try:
                conversation_history.append(assistant_response)
                # Also update the session messages
                if sid in sessions:
                    sessions[sid]["messages"] = conversation_history.copy()
            except Exception as history_e:
                print(f"Error updating conversation history: {history_e}")
                import traceback
                traceback.print_exc()

    except Exception as e:
        error_message = f"An error occurred in stream_and_process_response: {e}"
        print(f"Error in stream_and_process_response for session {sid}: {e}")
        import traceback
        traceback.print_exc()
        try:
            await sio.emit("error", {"message": "An error occurred while processing the response."}, to=sid)
        except Exception as emit_e:
            print(f"Failed to emit error message: {emit_e}")

@sio.event
async def chat_message(sid, data):
    """Handles general chat messages (knowledge base or web search)."""
    try:
        if sid not in sessions:
            await sio.emit("error", {"message": "Session not found. Please refresh the page."}, to=sid)
            return

        prompt = data.get("message")
        selected_fields = data.get("selected_fields") # Get selected fields
        image_b64 = data.get("image_b64") # Get the last image's b64 data

        if not prompt:
            await sio.emit("error", {"message": "No message provided."}, to=sid)
            return

        # Log the chat question and get the question ID
        question_id = await log_chat_question(sid, prompt)

        sessions[sid]["messages"].append({"role": "user", "content": prompt})
        
        # Get user information for domain-based access control
        user = await get_user_from_session(sid)
        
        generator = logic.process_new_question(
            sid=sid,
            conversation_history=sessions[sid]["messages"].copy(),  # Pass a copy to avoid reference issues
            source_mode=sessions[sid].get("source_mode"),
            selected_fields=selected_fields,
            image_b64=image_b64, # Pass the image data to the logic layer
            user=user  # Pass user information for domain-based access control
        )
        
        await stream_and_process_response(sid, generator, sessions[sid]["messages"], question_id=question_id)
    except Exception as e:
        error_message = f"An error occurred in chat_message: {e}"
        print(f"Error in chat_message for session {sid}: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit("error", {"message": "An error occurred while processing your message."}, to=sid)

@sio.event
async def clarification(sid, data):
    """
    Handles the user's response to a clarification question.
    This handler routes the request to the existing chat_message handler.
    """
    print("INFO: Received 'clarification' event, routing to 'chat_message' handler.")
    await chat_message(sid, data)

@sio.event
async def document_question(sid, data):
    """Handles questions specifically about an uploaded document (text, table, image, or RAG)."""
    try:
        if sid not in sessions:
            await sio.emit("error", {"message": "Session not found. Please refresh the page."}, to=sid)
            return

        prompt = data.get("message")
        if not prompt:
            await sio.emit("error", {"message": "No message provided."}, to=sid)
            return
        
        # Log the chat question
        await log_chat_question(sid, prompt)
        
        sessions[sid]["messages"].append({"role": "user", "content": prompt})

        # --- RAG Question Handling ---
        rag_store_path = sessions[sid].get("rag_vector_store_path")
        if rag_store_path:
            # Intelligent RAG processing with automatic full-text/chunking decision
            generator = logic.process_rag_question(
                sid=sid,
                conversation_history=sessions[sid]["messages"].copy(),
                vector_store_path=rag_store_path
            )
            # RAG responses are streamed directly
            await stream_and_process_response(sid, generator, sessions[sid]["messages"])

        # --- Standard Document Question Handling ---
        else:
            document_content = data.get("documentContent")
            original_filename = data.get("documentName", "data.txt")
            file_header = data.get("documentHeader")
            file_type = data.get("fileType")

            if not document_content:
                await sio.emit("error", {"message": "No document content provided for non-RAG question."}, to=sid)
                return

            generator = logic.process_document_question(
                sid=sid,
                conversation_history=sessions[sid]["messages"].copy(),
                document_content=document_content,
                file_type=file_type
            )

            await stream_and_process_response(
                sid,
                generator,
                sessions[sid]["messages"],
                document_content=document_content,
                original_filename=original_filename,
                file_header=file_header
            )
    except Exception as e:
        error_message = f"An error occurred in document_question: {e}"
        print(f"Error in document_question for session {sid}: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit("error", {"message": "An error occurred while processing your document question."}, to=sid)

@sio.event
async def process_document_for_rag(sid, data):
    """Handles the processing of a PDF/DOCX file to create a vector store."""
    try:
        if sid not in sessions:
            return

        file_path = data.get("temp_path")
        if not file_path or not os.path.exists(file_path):
            await sio.emit("error", {"message": f"RAG file not found at path: {file_path}"}, to=sid)
            return
        
        # Store the path to the originally uploaded file for later cleanup
        sessions[sid]["uploaded_rag_file_path"] = file_path
        
        # The vector store will be created in the same temporary directory
        vector_store_path = os.path.dirname(file_path)

        # Use a generator to get status updates from the logic layer
        async for result in logic.create_vector_store_for_document(sid, file_path, vector_store_path):
            status = result.get("status")
            message = result.get("message")
            
            await sio.emit("status", {"message": message}, to=sid)

            if status == "complete":
                # Store the path to the vector store in the session
                sessions[sid]["rag_vector_store_path"] = vector_store_path
                await sio.emit("rag_status", {"status": "ready"}, to=sid)
            elif status == "error":
                await sio.emit("error", {"message": message}, to=sid)
                break # Stop processing on error

    except Exception as e:
        error_message = f"An error occurred during RAG processing: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)


@sio.event
async def update_knowledge_base(sid, data):
    """Handles request to update the knowledge base."""
    print(f"Knowledge base update requested by {sid}")
    try:
        # The logic's generator yields progress updates
        for message in logic.update_knowledge_base():
            await sio.emit("status", {"message": message}, to=sid)
            await asyncio.sleep(0.05)  # Add a small delay to allow UI to update
        await sio.emit("status", {"message": "Knowledge base update complete."}, to=sid)
    except Exception as e:
        error_message = f"An error occurred during knowledge base update: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

@sio.event
async def python_code_request(sid, data):
    """
    Handles an explicit request from the user to generate and execute Python code
    when no document has been uploaded.
    """
    try:
        if sid not in sessions:
            return

        prompt = data.get("message")
        if not prompt:
            return

        # Log the chat question
        await log_chat_question(sid, prompt)

        # Add the user's message to the history before processing
        sessions[sid]["messages"].append({"role": "user", "content": prompt})

        # No document context is passed here
        await handle_python_request(sid, sessions[sid]["messages"])
    except Exception as e:
        error_message = f"An error occurred in python_code_request: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

@sio.event
async def cancel_generation(sid):
    """Handles a request to cancel the current generation."""
    print(f"Cancellation request from {sid}")
    try:
        # Set the cancellation flag immediately
        logic.cancel_generation(sid)
        
        # Send immediate status update
        await sio.emit("status", {"message": "Cancelling generation..."}, to=sid)
        
        # Send a special cancel event to distinguish from normal end
        await sio.emit("generation_cancelled", to=sid)
        
        # Wait a brief moment for ongoing operations to check the flag
        await asyncio.sleep(0.1)
        
        # Send final status and end event
        await sio.emit("status", {"message": "Generation cancelled."}, to=sid)
        await sio.emit("answer_end", to=sid)
        
    except Exception as e:
        error_message = f"An error occurred during cancellation: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

@sio.event
async def load_conversation_history(sid, data):
    """Handles loading of conversation history from the frontend when a chat is loaded from history."""
    try:
        if sid not in sessions:
            await sio.emit("error", {"message": "Session not found. Please refresh the page."}, to=sid)
            return

        messages = data.get("messages", [])
        selected_fields = data.get("selected_fields", [])
        
        # Filter and store only valid messages (user and assistant roles)
        filtered_messages = []
        for msg in messages:
            if isinstance(msg, dict) and msg.get("role") in ["user", "assistant"] and msg.get("content"):
                # Only store essential content, filter out UI-specific fields
                clean_message = {
                    "role": msg["role"],
                    "content": msg["content"]
                }
                filtered_messages.append(clean_message)
        
        # Update session with the loaded conversation history
        sessions[sid]["messages"] = filtered_messages
        await sio.emit("status", {"message": f"Conversation history loaded ({len(filtered_messages)} messages)"}, to=sid)
        
    except Exception as e:
        error_message = f"An error occurred while loading conversation history: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

@sio.event
async def clear_chat_display(sid):
    """Clears only the chat messages but keeps uploaded files and session state intact."""
    try:
        if sid not in sessions:
            await sio.emit("error", {"message": "Session not found. Please refresh the page."}, to=sid)
            return

        # Clear only the messages array - keep all file-related data intact
        sessions[sid]["messages"] = []
        
        print(f"Chat display cleared for session: {sid} (keeping uploaded files intact)")
        await sio.emit("status", {"message": "Chat cleared. Ready for new conversation."}, to=sid)
        
    except Exception as e:
        error_message = f"An error occurred while clearing chat display: {e}"
        print(error_message)
        await sio.emit("error", {"message": error_message}, to=sid)

# --- Static File Serving for React Frontend ---
# Mount the built React frontend when running in production (Docker)
FRONTEND_PATH = os.environ.get("FRONTEND_PATH", "frontend/dist")
if os.path.exists(FRONTEND_PATH):
    # Mount static files at /assets to match the frontend build output
    fastapi_app.mount("/assets", StaticFiles(directory=f"{FRONTEND_PATH}/assets"), name="assets")
    
    # Mount the entire frontend directory to serve all static files including logos, etc.
    fastapi_app.mount("/static", StaticFiles(directory=FRONTEND_PATH), name="static")
    
    # Serve the React app for all non-API routes
    @fastapi_app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve the React SPA for all routes not handled by API endpoints.
        This enables client-side routing to work properly.
        """
        # Don't serve SPA for API routes, Socket.IO, or other backend paths
        if (full_path.startswith(("api/", "socket.io/", "uploadfile/", "export/", "favorites/", 
                                 "knowledge_fields", "check_admin", "admin/", "chat_history/")) or 
            full_path.startswith(("static/", "assets/"))):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Check if the requested file exists in the frontend directory first
        requested_file = os.path.join(FRONTEND_PATH, full_path)
        if os.path.exists(requested_file) and os.path.isfile(requested_file):
            return FileResponse(requested_file)
        
        # For the root path and any other path that doesn't exist, serve the React app
        index_file = os.path.join(FRONTEND_PATH, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")
else:
    print(f"Frontend path '{FRONTEND_PATH}' does not exist. Static file serving disabled.")
    print("This is normal in development mode when using Vite dev server.")
