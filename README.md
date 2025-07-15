# 4PLAN Everything Buddy - Technical Specification

## IMPORTANT NOTICE
This app was written 100% AI based - no single line of code was written by me

IDE was visual studio code and CLINE

I used gemeni-2.5-pro and claude-4-sonnet to build it 


## System Overview

**4PLAN Everything Buddy** is an enterprise-grade AI assistant platform designed for knowledge management, document analysis, and intelligent conversation capabilities. The system integrates multiple AI models for text generation, image analysis, and document processing within a secure, scalable architecture.

### Key Features
- **Multi-modal AI Chat**: Text, image, and document-based conversations
- **RAG (Retrieval Augmented Generation)**: Intelligent document search and analysis
- **Knowledge Base Management**: Organized document collections with vector search
- **Image Generation & Analysis**: AI-powered image creation and interpretation
- **Python Code Execution**: Secure data analysis and visualization
- **Enterprise Authentication**: Azure AD integration with role-based access
- **Real-time Communication**: WebSocket-based streaming responses
- **Multi-format Document Support**: PDF, DOCX, Excel, CSV, TXT, SQL files

## Architecture

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   AI Services   │
│   (React)       │◄──►│   (FastAPI)      │◄──►│   (Together AI) │
│                 │    │                  │    │                 │
│ - Authentication│    │ - API Layer      │    │ - LLM Models    │
│ - Real-time UI  │    │ - Socket.IO      │    │ - Embeddings    │
│ - File Upload   │    │ - Business Logic │    │ - Image Gen     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │    Data Layer    │
                       │                  │
                       │ - SQLite DB      │
                       │ - Vector Stores  │
                       │ - File Storage   │
                       └──────────────────┘
```

### Technology Stack

**Backend**
- **Framework**: FastAPI 
- **Real-time**: Socket.IO (python-socketio)
- **Database**: SQLite with SQLAlchemy ORM
- **AI Integration**: Together AI API
- **Vector Search**: FAISS (Facebook AI Similarity Search)
- **Document Processing**: Unstructured, PyMuPDF, pdfplumber
- **Authentication**: Azure AD (Microsoft Authentication Library)
- **Security**: Multi-layer code execution sandbox

**Frontend**
- **Framework**: React 19.1.0
- **Build Tool**: Vite
- **Authentication**: Azure MSAL (Microsoft Authentication Library)
- **Real-time**: Socket.IO Client
- **UI Components**: Material-UI, Custom Components
- **Markdown Rendering**: react-markdown with syntax highlighting

**AI & ML**
- **Primary LLM**: Meta Llama-4-Maverick-17B-128E-Instruct-FP8
- **Image Model**: Meta Llama-4-Maverick-17B-128E-Instruct-FP8
- **Image Generation**: FLUX.1-kontext-max
- **Embeddings**: BAAI/bge-base-en-v1.5
- **Re-ranking**: BAAI/bge-reranker-large
- **Vector Store**: FAISS with optimized batching

## Core Components

### 1. Application Logic Layer (`app_logic.py`)

**Purpose**: Central orchestrator for all business logic operations.

**Key Responsibilities**:
- Conversation flow management
- Document processing coordination
- User preference management (favorites, chat history)
- Session state management
- Cancellation handling

**Critical Methods**:
- `process_new_question()`: Handles general chat queries with intelligent routing
- `process_document_question()`: Manages document-specific queries
- `process_rag_question()`: Coordinates RAG-based document analysis
- `process_python_question()`: Secure Python code generation and execution
- `create_vector_store_for_document()`: Document vectorization pipeline

### 2. Language Model Interface (`llm.py`)

**Purpose**: Abstraction layer for all AI model interactions.

**Key Features**:
- **Intelligent Query Routing**: Automatically determines optimal information source
- **Multi-language Support**: German/English query processing
- **Abbreviation Expansion**: Automatic expansion of business terminology (GuV → Gewinn- und Verlustrechnung)
- **Context-Aware Search**: Conversation history integration for better results
- **Streaming Responses**: Real-time response generation
- **Robust Error Handling**: Retry mechanisms with exponential backoff

**Core Functions**:
- `get_answer()`: Master orchestrator for all query types
- `get_answer_from_document()`: Document-specific analysis
- `get_answer_from_rag()`: RAG pipeline execution
- `generate_image()`: AI image generation with refinement
- `get_python_code()`: Secure code generation

### 3. API Layer (`api.py`)

**Purpose**: RESTful API and WebSocket endpoint management.

**Endpoints Structure**:
```python
# Authentication & User Management
GET  /check_admin           # Admin status verification
GET  /admin/features        # Feature configuration (admin only)
PUT  /admin/features        # Update features (admin only)

# Knowledge Base
GET  /knowledge_fields      # Available knowledge domains
POST /uploadfile/           # Multi-format file upload

# Favorites Management
GET  /favorites/            # User's favorite questions
POST /favorites/groups      # Create question groups
PUT  /favorites/groups/{id} # Update groups
DELETE /favorites/groups/{id} # Delete groups
POST /favorites/questions   # Add questions
DELETE /favorites/questions/{id} # Remove questions

# Chat History
GET  /chat_history/         # User's chat sessions
POST /chat_history/         # Save chat session
GET  /chat_history/{id}     # Load specific chat
DELETE /chat_history/{id}   # Delete chat

# Export
POST /export/pdf            # Generate PDF reports
```

**WebSocket Events**:
```python
# Client → Server
'chat_message'              # General conversation
'document_question'         # Document-specific query
'python_code_request'       # Code generation request
'new_dialog'               # Reset conversation
'cancel_generation'        # Stop current operation

# Server → Client  
'answer_meta'              # Response metadata
'answer_chunk'             # Streaming text chunks
'answer_end'               # Response completion
'python_result'            # Code execution results
'image'                    # Generated images
'status'                   # System status updates
```

## AI Engine

### Model Configuration

**Primary Models**:
- **Main LLM**: `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`
- **Image Analysis**: `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`
- **Image Generation**: `black-forest-labs/FLUX.1-kontext-max`
- **Embeddings**: `intfloat/multilingual-e5-large-instruct` (Enhanced multilingual model)
- **Fast Model**: `meta-llama/Llama-3.2-3B-Instruct-Turbo` (For analysis and translation)

### Query Routing Intelligence

The system employs sophisticated query routing to determine the optimal information source:

```python
def route_query(client, conversation_history: list) -> str:
    """
    Routes queries to:
    - 'vector_store': Internal knowledge base search
    - 'web_search': Real-time web information
    - 'direct_answer': General knowledge responses
    - 'image_generation': AI image creation
    """
```

**Routing Logic**:
1. **Context Analysis**: Examines conversation history for follow-up patterns
2. **Term Recognition**: Identifies proprietary terminology requiring internal search
3. **Temporal Requirements**: Detects need for current information
4. **Intent Classification**: Recognizes image generation requests

### Vector Store Management

**Architecture**:
- **Multi-Domain Storage**: Separate vector stores per knowledge field
- **Enhanced Chunking Strategy**: Adaptive chunking based on document size and complexity
- **Batch Processing**: 64-document batches for embedding efficiency
- **Dynamic Re-ranking**: Cross-encoder models for relevance optimization
- **Multilingual Embeddings**: `intfloat/multilingual-e5-large-instruct` for German/English support

**Enhanced Chunking Parameters**:
```python
# Adaptive chunking based on document characteristics
SMALL_DOC_THRESHOLD = 100000   # 100k chars - use 1500 char chunks
MEDIUM_DOC_THRESHOLD = 500000  # 500k chars - use 2000 char chunks  
LARGE_CHUNK_SIZE = 2500        # For large documents
MEDIUM_CHUNK_SIZE = 2000       # For medium documents
SMALL_CHUNK_SIZE = 1500        # For small documents
MAX_CHUNK_SIZE = 4000          # Absolute maximum for embedding model
```

**Knowledge Fields**:
```python
# Example structure
vector_stores = {
    "4PLAN Deutsch": FAISS_Store,
    "S4U intern": FAISS_Store,
    "S4U & 4PLAN": FAISS_Store,
    "Web": Web_Search_Handler
}
```

### Document Intelligence

**Enhanced RAG Pipeline**:
1. **Document Analysis**: Complexity assessment and structure extraction with LLM
2. **Intelligent Chunking**: Adaptive chunking preserving document structure
3. **Full-text vs. Chunked**: Automatic decision based on document size (200K threshold)
4. **Multi-stage Retrieval**: Initial search + re-ranking for optimal results
5. **Quality Evaluation**: Result quality assessment with web search fallback

**Smart PDF Processing Strategy**:
```python
# Intelligent extraction hierarchy with complexity analysis
1. Complexity Analysis → Determine optimal strategy
2. PyMuPDF (fast) → Simple documents, good extraction
3. pdfplumber (tables) → Table-heavy documents, preserves structure
4. unstructured (comprehensive) → Complex layouts, hi-res processing
```

**Full-text vs RAG Decision**:
```python
# Intelligent processing decision for uploaded documents
FULLTEXT_THRESHOLD = 200000  # 200k characters

if len(document_text) < FULLTEXT_THRESHOLD:
    # Full-text analysis - optimal for tables and structured data
    save_fulltext_marker(document_text)
else:
    # RAG processing - chunked approach for large documents
    create_vector_embeddings(adaptive_chunks)
```

## Document Processing

### Supported Formats

**File Type Support**:
- **Office Documents**: PDF, DOCX
- **Data Files**: CSV, XLSX  
- **Text Files**: TXT, SQL
- **Images**: PNG, JPG, JPEG, GIF, WEBP

### Processing Workflows

**Image Processing**:
```python
# Client-side optimization
MAX_DIMENSION = 2048  # Automatic resize
canvas.drawImage(img, 0, 0, width, height)
base64_data = canvas.toDataURL(file.type)
```

**Document Vectorization**:
```python
# Intelligent processing decision
if len(document_text) < 200000:
    # Full-text analysis for optimal table handling
    save_fulltext_marker(document_text)
else:
    # RAG processing for large documents
    create_vector_embeddings(chunks)
```

**Table Processing**:
```python
# Markdown table detection and conversion
def is_markdown_table(content: str) -> bool:
    return (header.startswith('|') and 
            '---' in separator_line)

def convert_to_csv(markdown_table) -> str:
    # Robust CSV conversion with quote escaping
```

### Python Code Execution

**Security Framework**:
- **Static Analysis**: Blacklist scanning for dangerous imports/functions
- **LLM Security Audit**: AI-powered code review for malicious patterns
- **Sandboxed Execution**: Isolated execution environment
- **Resource Limits**: 30-second timeout, memory constraints

**Execution Pipeline**:
1. **Code Generation**: LLM creates analysis script
2. **Security Validation**: Multi-layer security checks
3. **Safe Execution**: Subprocess with strict limits
4. **Result Processing**: JSON/HTML output handling

**Supported Outputs**:
- **Data Tables**: JSON format with pandas integration
- **Visualizations**: Plotly charts saved as HTML
- **Single Values**: Numeric/text results
- **Error Handling**: Retry mechanism (max 3 attempts)

## Security Framework

### Multi-Layer Protection

**Layer 1: Static Code Analysis**
```python
BLACKLISTED_MODULES = [
    "os", "subprocess", "shutil", "sys", "glob", 
    "socket", "requests", "urllib", "http", "ctypes"
]
BLACKLISTED_FUNCTIONS = ["eval", "exec"]
```

**Layer 2: LLM Security Audit**
- AI-powered code review for malicious patterns
- Pattern recognition for data exfiltration attempts
- Network access detection
- File system modification prevention

**Layer 3: Execution Sandbox**
- Process isolation
- Resource limitations
- Timeout enforcement
- Output sanitization

### Authentication Security

**Azure AD Integration**:
```python
# JWT Token Validation
def verify_token(request: Request) -> dict:
    # JWKS-based signature verification
    # Audience validation
    # Token expiration checks
    # Automatic key rotation support
```

**Authorization Levels**:
- **Standard Users**: Query access, personal favorites
- **Administrators**: Feature management, knowledge base updates

## Authentication & Authorization

### Azure Active Directory Integration

**Configuration Requirements**:
```env
TENANT_ID=your-azure-tenant-id
CLIENT_ID=your-azure-client-id
```

**Token Flow**:
1. **Frontend Authentication**: MSAL browser library handles login
2. **Token Acquisition**: Silent token refresh for API calls
3. **Backend Validation**: JWT signature verification against Azure JWKS
4. **User Creation**: Automatic user record creation on first access

**User Management**:
```python
class User(Base):
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)  # Azure AD username
    favorite_groups = relationship("FavoriteGroup")
    chat_histories = relationship("ChatHistory")
```

### Admin Privileges

**Admin Configuration**: JSON file with email list
```json
{
  "admins": ["admin@company.com", "manager@company.com"]
}
```

**Admin Capabilities**:
- Feature toggle management
- Knowledge base updates
- System configuration access

## Database Schema

### Entity Relationship Model

```sql
-- User Management
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR UNIQUE  -- Azure AD identifier
);

-- Favorites System
CREATE TABLE favorite_groups (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    user_id INTEGER REFERENCES users(id),
    order INTEGER DEFAULT 0
);

CREATE TABLE favorite_questions (
    id INTEGER PRIMARY KEY,
    question VARCHAR,
    group_id INTEGER REFERENCES favorite_groups(id),
    order INTEGER DEFAULT 0
);

-- Chat History
CREATE TABLE chat_histories (
    id INTEGER PRIMARY KEY,
    title VARCHAR,
    user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    selected_fields TEXT  -- JSON array of knowledge fields
);

CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER REFERENCES chat_histories(id),
    role VARCHAR,  -- 'user' or 'assistant'
    content TEXT,
    order INTEGER
);
```

### Data Relationships

**User → Groups → Questions**:
- Users can have multiple favorite groups
- Groups contain ordered questions
- Drag-and-drop reordering support

**User → Chat Histories → Messages**:
- Auto-save saveable conversations
- Automatic cleanup (10 most recent)
- Knowledge field association

## API Endpoints

### REST Endpoints

**Authentication Required**: All endpoints require valid Azure AD JWT token.

**Content Types**: 
- Request: `application/json`, `multipart/form-data`
- Response: `application/json`, `application/pdf`

**Error Handling**:
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

### File Upload Processing

**Upload Endpoint**: `POST /uploadfile/`

**Processing Flow**:
1. **Feature Validation**: Check if file type is enabled
2. **Format Detection**: Automatic file type identification
3. **Processing Strategy**: Route to appropriate handler
4. **Result Generation**: Structured response with metadata

**Response Types**:
```python
# Image files
{"filename": "image.png", "type": "image"}

# RAG documents  
{"filename": "doc.pdf", "type": "rag_document", "temp_path": "/path"}

# Table data
{"filename": "data.csv", "type": "table_data", "data": {...}}

# Text files
{"filename": "file.txt", "type": "text", "content": "..."}
```

## Frontend Components

### Component Architecture

**Main Application** (`App.jsx`):
- Authentication wrapper
- Socket.IO connection management
- Global state coordination
- Real-time message handling

**Core Components**:

**Chat Interface**:
- Message rendering with markdown support
- File upload integration
- Voice input support (Web Speech API)
- Real-time typing indicators

**Document Viewers**:
- `CollapsibleTable`: Sortable data tables
- `CollapsibleCode`: Syntax-highlighted code blocks
- `CollapsibleSources`: Source reference management
- `CollapsibleSingleValue`: Numeric result display

**Management Panels**:
- `FavoritesPanel`: Question organization with drag-and-drop
- `HistoryPanel`: Chat session management
- `AdminDialog`: System administration interface

### State Management

**React State Structure**:
```javascript
const [messages, setMessages] = useState([]);
const [chatMode, setChatMode] = useState('knowledge_base');
const [sourceMode, setSourceMode] = useState(null);
const [selectedFields, setSelectedFields] = useState([]);
const [isGenerating, setIsGenerating] = useState(false);
```

**Session Persistence**:
- Automatic chat history saving
- Knowledge field preferences
- Admin privilege caching

### Real-time Features

**Voice Input**:
- German language speech recognition
- Automatic silence detection
- Visual recording indicators
- Text-to-speech responses

**File Handling**:
- Client-side image resizing
- Progress indicators for large files
- Format validation
- Preview generation

## Real-time Communication

### Socket.IO Implementation

**Connection Management**:
```javascript
// Frontend connection with authentication
const socket = io(SOCKET_URL, {
    auth: { token: accessToken }
});

// Backend authentication verification
async def connect(sid, environ, auth):
    token = auth.get("token")
    await verify_token(mock_request)
```

**Session State**:
```python
sessions[sid] = {
    "messages": [],
    "source_mode": None,
    "uploaded_file_path": None,
    "rag_vector_store_path": None
}
```

### Event Streaming

**Response Streaming**:
```python
# Server-side streaming generator
async def stream_and_process_response(sid, generator):
    async for result in generator:
        event_type = result.get("type")
        if event_type == "chunk":
            await sio.emit("answer_chunk", result["data"], to=sid)
        elif event_type == "meta":
            await sio.emit("answer_meta", result["data"], to=sid)
```

**Progress Indicators**:
- Real-time status updates
- Processing stage notifications
- Cancellation support
- Error propagation

## Deployment & Infrastructure

### Docker Configuration

**Multi-stage Build**:
```dockerfile
# Frontend build stage
FROM node:18-alpine as frontend-build
COPY frontend/ .
RUN npm ci && npm run build

# Backend runtime
FROM python:3.11-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY --from=frontend-build /app/dist ./frontend/dist
```

**Environment Setup**:
```bash
# Development
python main.py  # HTTPS on port 8443

# Production (Docker)  
uvicorn api:app --host 0.0.0.0 --port 443 --ssl-keyfile=ssl/key.pem --ssl-certfile=ssl/cert.pem
```

### SSL Configuration

**Certificate Generation**:
```bash
#!/bin/bash
# generate-ssl.sh
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

**Production Requirements**:
- Valid SSL certificates for Azure AD
- HTTPS enforcement for authentication
- CORS configuration for cross-origin requests

### File Structure

**Production Layout**:
```
/app/
├── main.py              # Application entry point
├── api.py               # FastAPI application
├── app_logic.py         # Business logic
├── llm.py               # AI model interface
├── auth.py              # Authentication
├── database.py          # Database models
├── security.py          # Code execution security
├── frontend/dist/       # Built React application
├── Documents/           # Knowledge base documents
├── vector_store/        # FAISS indices
├── temp_uploads/        # Temporary file storage
└── ssl/                # SSL certificates
```

## Configuration

### Environment Variables

**Required Configuration**:
```env
# AI Service
TOGETHER_API_KEY=your-together-ai-key

# Authentication  
TENANT_ID=your-azure-tenant-id
CLIENT_ID=your-azure-client-id

# Optional
FRONTEND_PATH=frontend/dist  # Production frontend path
```

### Feature Management

**Feature Configuration** (`features.json`):
```json
{
  "image_generation": true,
  "image_upload": true, 
  "pdf_docx_upload": true,
  "txt_sql_upload": true,
  "xlsx_csv_analysis": true,
  "web_search": true
}
```

**Dynamic Feature Control**:
- Admin-configurable feature toggles
- Runtime feature enablement/disablement
- User interface adaptation based on features
- API endpoint protection by feature flags

### Admin Configuration

**Administrator List** (`admins.json`):
```json
{
  "admins": [
    "admin@company.com",
    "manager@company.com"
  ]
}
```

**Knowledge Fields** (`knowledge_fields.json`):
```json
[
  "4PLAN Deutsch",
  "S4U intern", 
  "Technical Documentation"
]
```

## Feature Management

### Toggle System

**Feature Categories**:
1. **File Upload Features**: Control document type support
2. **AI Capabilities**: Enable/disable image generation
3. **Search Features**: Web search availability
4. **Analysis Tools**: Python code execution, data visualization

**Implementation**:
```python
def load_features():
    """Load current feature configuration with defaults"""
    default_features = {
        "image_generation": True,
        "image_upload": True,
        "pdf_docx_upload": True, 
        "txt_sql_upload": True,
        "xlsx_csv_analysis": True,
        "web_search": True
    }
    
    try:
        with open("features.json", 'r') as f:
            return json.load(f)
        return default_features
    except Exception:
        return default_features
```

**Frontend Integration**:
- Dynamic file type acceptance based on enabled features
- UI element hiding/showing based on feature state
- Error messages for disabled features
- Automatic field selection updates

### Performance Optimizations

**Vector Store Optimizations**:
- Batch embedding generation (64 documents per batch)
- Optimized chunking parameters (1000 chars + 300 overlap)
- Cross-encoder re-ranking for top results only
- Memory management with garbage collection

**Query Optimizations**:
- Intelligent query expansion (max 3 variants)
- Faster translation model for non-English queries
- Context-aware search enhancement
- Abbreviated term expansion

**Frontend Optimizations**:
- Client-side image resizing before upload
- Lazy loading for large chat histories
- WebSocket connection pooling
- Automatic textarea resizing

---

## Technical Notes

### Code Quality Standards
- Type hints throughout Python codebase
- Comprehensive error handling with try-catch blocks
- Async/await patterns for I/O operations
- Memory-efficient processing for large documents

### Scalability Considerations
- Stateless session management for horizontal scaling
- Database connection pooling
- Batch processing for vector operations
- Configurable timeouts and limits

### Maintenance Features
- Automatic cleanup of temporary files
- Session cleanup on disconnect
- Automatic chat history limiting (10 per user)
- Vector store versioning and updates

This specification represents the current state of the 4PLAN Everything Buddy system as of January 2025, providing a comprehensive technical overview for developers, administrators, and stakeholders.
