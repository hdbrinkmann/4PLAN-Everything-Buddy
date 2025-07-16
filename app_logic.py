from llm import (
    get_answer, 
    force_create_vector_store, 
    get_answer_from_document, 
    get_python_code,
    create_vector_store_for_document, # New
    get_answer_from_rag # New
)
from security import is_code_safe
import asyncio
import os
import traceback
import json
import shutil
import glob
import base64
import tempfile
import plotly.io as pio
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import User, FavoriteGroup, FavoriteQuestion, ChatHistory, ChatMessage
from fastapi import HTTPException

class AppLogic:
    def __init__(self):
        self.cancellation_flags = {}

    def get_favorites(self, db: Session, user: User):
        groups = db.query(FavoriteGroup).filter(FavoriteGroup.user_id == user.id).order_by(FavoriteGroup.order).all()
        result = []
        for group in groups:
            questions = sorted(group.questions, key=lambda q: q.order)
            result.append({
                "id": group.id,
                "name": group.name,
                "order": group.order,
                "questions": [{"id": q.id, "question": q.question, "order": q.order} for q in questions]
            })
        return result

    def create_favorite_group(self, db: Session, user: User, name: str):
        max_order = db.query(func.max(FavoriteGroup.order)).filter(FavoriteGroup.user_id == user.id).scalar() or 0
        new_group = FavoriteGroup(name=name, user_id=user.id, order=max_order + 1)
        db.add(new_group)
        db.commit()
        db.refresh(new_group)
        return {"id": new_group.id, "name": new_group.name, "order": new_group.order, "questions": []}

    def rename_favorite_group(self, db: Session, user: User, group_id: int, new_name: str):
        group = db.query(FavoriteGroup).filter(FavoriteGroup.id == group_id, FavoriteGroup.user_id == user.id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        group.name = new_name
        db.commit()
        db.refresh(group)
        return {"id": group.id, "name": group.name}

    def delete_favorite_group(self, db: Session, user: User, group_id: int):
        group = db.query(FavoriteGroup).filter(FavoriteGroup.id == group_id, FavoriteGroup.user_id == user.id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        db.delete(group)
        db.commit()
        return {"status": "success"}

    def add_favorite_question(self, db: Session, user: User, group_id: int, question_text: str):
        # If group_id is -1, it's a signal to use or create the default group.
        if group_id == -1:
            # Look for any group for this user.
            group = db.query(FavoriteGroup).filter(FavoriteGroup.user_id == user.id).first()
            
            # If no group exists, create a default one.
            if not group:
                group = FavoriteGroup(name="Favorites", user_id=user.id)
                db.add(group)
                db.commit()
                db.refresh(group)
        else:
            # Otherwise, find the group by the provided ID.
            group = db.query(FavoriteGroup).filter(FavoriteGroup.id == group_id, FavoriteGroup.user_id == user.id).first()

        # If still no group is found, raise an error.
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        # Check if the question already exists for this user across all their groups.
        existing_question = db.query(FavoriteQuestion).join(FavoriteGroup).filter(
            FavoriteGroup.user_id == user.id,
            FavoriteQuestion.question == question_text
        ).first()

        if existing_question:
            # Question already exists, return a specific message or the existing question.
            # Returning the existing question might be useful for the client.
            return {"id": existing_question.id, "question": existing_question.question, "group_id": existing_question.group_id, "status": "exists"}

        max_question_order = db.query(func.max(FavoriteQuestion.order)).filter(FavoriteQuestion.group_id == group.id).scalar() or 0
        new_question = FavoriteQuestion(question=question_text, group_id=group.id, order=max_question_order + 1)
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        return {"id": new_question.id, "question": new_question.question, "group_id": new_question.group_id, "order": new_question.order}

    def delete_favorite_question(self, db: Session, user: User, question_id: int):
        question = db.query(FavoriteQuestion).join(FavoriteGroup).filter(FavoriteQuestion.id == question_id, FavoriteGroup.user_id == user.id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        db.delete(question)
        db.commit()
        return {"status": "success"}

    def move_favorite_question(self, db: Session, user: User, question_id: int, new_group_id: int, new_order: int):
        try:
            # Start transaction
            question = db.query(FavoriteQuestion).join(FavoriteGroup).filter(
                FavoriteQuestion.id == question_id, FavoriteGroup.user_id == user.id
            ).first()
            if not question:
                raise HTTPException(status_code=404, detail="Question not found")

            new_group = db.query(FavoriteGroup).filter(
                FavoriteGroup.id == new_group_id, FavoriteGroup.user_id == user.id
            ).first()
            if not new_group:
                raise HTTPException(status_code=404, detail="New group not found")

            old_group_id = question.group_id
            
            # If moving within the same group, just reorder
            if old_group_id == new_group_id:
                # Get all questions in the group except the one being moved
                questions = db.query(FavoriteQuestion).filter(
                    FavoriteQuestion.group_id == new_group_id,
                    FavoriteQuestion.id != question_id
                ).order_by(FavoriteQuestion.order).all()
                
                # Insert the moved question at the new position
                questions.insert(new_order, question)
                
                # Update all orders
                for i, q in enumerate(questions):
                    q.order = i
                    
            else:
                # Moving between different groups
                
                # First, compact the old group by removing gaps
                old_group_questions = db.query(FavoriteQuestion).filter(
                    FavoriteQuestion.group_id == old_group_id,
                    FavoriteQuestion.id != question_id
                ).order_by(FavoriteQuestion.order).all()
                
                for i, q in enumerate(old_group_questions):
                    q.order = i
                
                # Then, make space in the new group and insert
                new_group_questions = db.query(FavoriteQuestion).filter(
                    FavoriteQuestion.group_id == new_group_id
                ).order_by(FavoriteQuestion.order).all()
                
                # Shift questions at and after the new position
                for q in new_group_questions:
                    if q.order >= new_order:
                        q.order += 1
                
                # Update the moved question
                question.group_id = new_group_id
                question.order = new_order
            
            db.commit()
            return {"status": "success"}
            
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to move question: {str(e)}")

    def update_group_order(self, db: Session, user: User, ordered_ids: list[int]):
        if not ordered_ids:
            return {"status": "no IDs provided"}
            
        groups = db.query(FavoriteGroup).filter(
            FavoriteGroup.user_id == user.id,
            FavoriteGroup.id.in_(ordered_ids)
        ).all()
        
        group_map = {group.id: group for group in groups}

        for i, group_id in enumerate(ordered_ids):
            if group_id in group_map:
                group_map[group_id].order = i + 1
        
        db.commit()
        return {"status": "success"}

    def cancel_generation(self, sid: str):
        """Sets a flag to cancel the ongoing generation for a specific session."""
        self.cancellation_flags[sid] = True

    def _get_cancellation_flag(self, sid: str):
        """Checks the cancellation flag for a session."""
        return self.cancellation_flags.get(sid, False)

    def _reset_cancellation_flag(self, sid: str):
        """Resets the cancellation flag for a session."""
        if sid in self.cancellation_flags:
            del self.cancellation_flags[sid]

    async def process_new_question(self, sid: str, conversation_history: list, source_mode: str = None, selected_fields: list = None, image_b64: str = None, user: User = None):
        """
        Processes a new question based on the provided conversation history.
        This is an async generator that yields status updates and the final answer.
        """
        self._reset_cancellation_flag(sid)
        try:
            # Handle WIPE command specifically
            last_question = conversation_history[-1]['content'].strip()
            if last_question.upper() == "WIPE":
                image_b64 = None # Ensure no image is passed for refinement

            # Extract user email for domain-based access control
            user_email = user.username if user else None

            async for result in get_answer(
                conversation_history,
                source_mode,
                selected_fields=selected_fields,
                image_b64=image_b64,
                user_email=user_email,
                cancellation_check=lambda: self._get_cancellation_flag(sid)
            ):
                yield result
        finally:
            self._reset_cancellation_flag(sid)

    def update_knowledge_base(self):
        """
        Triggers the knowledge base update process.
        This is a generator that yields progress updates.
        """
        # --- Derive and store knowledge fields with domain permissions ---
        yield "Processing document structure..."
        documents_path = "Documents"
        fields_file = "knowledge_fields.json"
        try:
            if os.path.isdir(documents_path):
                # Load existing knowledge fields configuration
                existing_fields_data = {}
                if os.path.exists(fields_file):
                    with open(fields_file, 'r') as f:
                        existing_fields_data = json.load(f)

                # Get current directories from Documents folder
                current_fields = [d for d in os.listdir(documents_path) if os.path.isdir(os.path.join(documents_path, d))]
                current_fields = [f for f in current_fields if not f.startswith('.')]

                # Update the fields data
                updated_fields_data = {}
                for field in current_fields:
                    if field in existing_fields_data:
                        # Preserve existing domain permissions
                        updated_fields_data[field] = existing_fields_data[field]
                    else:
                        # New field - initialize with empty domains (admin only access)
                        updated_fields_data[field] = {"domains": []}

                # Save the updated configuration
                with open(fields_file, 'w') as f:
                    json.dump(updated_fields_data, f, indent=2)
                
                yield f"Found {len(current_fields)} knowledge fields. Preserved existing domain permissions."
            else:
                yield "Documents directory not found. Skipping field update."
        except Exception as e:
            yield f"Error updating knowledge fields: {e}"

        # --- Update vector store (existing functionality) ---
        yield "Starting vector store update..."
        for message in force_create_vector_store():
            yield message

    async def process_document_question(self, sid: str, conversation_history: list, document_content: str, file_type: str = None):
        """
        Processes a new question based on the provided conversation history and document content.
        This is an async generator.
        """
        self._reset_cancellation_flag(sid)
        try:
            async for result in get_answer_from_document(conversation_history, document_content, file_type, cancellation_check=lambda: self._get_cancellation_flag(sid)):
                yield result
        finally:
            self._reset_cancellation_flag(sid)

    async def create_vector_store_for_document(self, sid: str, file_path: str, vector_store_path: str):
        """
        Creates a vector store for the given document and yields progress updates.
        This is an async generator.
        """
        self._reset_cancellation_flag(sid)
        try:
            # The actual logic is in llm.py, this just passes the call through
            async for result in create_vector_store_for_document(
                file_path, 
                vector_store_path, 
                cancellation_check=lambda: self._get_cancellation_flag(sid)
            ):
                yield result
        except Exception as e:
            yield {"status": "error", "message": f"Failed to create vector store: {e}"}
        finally:
            self._reset_cancellation_flag(sid)

    async def process_rag_question(self, sid: str, conversation_history: list, vector_store_path: str):
        """
        Processes a question using the RAG pipeline with a pre-existing vector store.
        This is an async generator.
        """
        self._reset_cancellation_flag(sid)
        try:
            async for result in get_answer_from_rag(
                conversation_history, 
                vector_store_path, 
                cancellation_check=lambda: self._get_cancellation_flag(sid)
            ):
                yield result
        finally:
            self._reset_cancellation_flag(sid)

    async def process_python_question(self, sid: str, conversation_history: list, file_path: str = None, file_header: str = None):
        """
        Generates and executes Python code asynchronously to answer a question.
        Handles table, text, and image outputs. Retries up to 3 times.
        """
        max_retries = 3
        python_code = ""
        temp_script_path = None
        last_error_message = ""
        last_python_code = ""
        
        # --- Create a unique session directory for this execution ---
        session_id = str(uuid.uuid4())
        base_temp_dir = tempfile.gettempdir()
        session_dir = os.path.join(base_temp_dir, "4plan_sessions", session_id)
        temp_image_dir = os.path.join(session_dir, "images")
        temp_script_dir = os.path.join(session_dir, "scripts")

        # Create session-specific temporary directories
        os.makedirs(temp_image_dir, exist_ok=True)
        os.makedirs(temp_script_dir, exist_ok=True)

        self._reset_cancellation_flag(sid)
        try:
            code_gen_history = [msg.copy() for msg in conversation_history]

            last_user_message = code_gen_history[-1]["content"]
            
            technical_notes = []
            # Add instruction for robust data type conversion
            technical_notes.append(
                "When performing calculations, you MUST ensure the data types are correct. Columns intended for mathematical operations must be numeric. "
                "To do this robustly: "
                "1. Identify the columns required for the analysis. "
                "2. For each of these columns, check if its `dtype` is `object`. "
                "3. **Only if the `dtype` is `object`**, you should clean and convert it. The cleaning process is: "
                "   a. First, use the `.str.replace()` method on the pandas Series to remove any thousand separators (e.g., '.') and currency symbols (e.g., '€', '$'). "
                "   b. Second, replace the decimal comma (',') with a decimal point ('.'). "
                "   c. Finally, use `pd.to_numeric(your_series, errors='coerce')` to perform the conversion. The `errors='coerce'` argument is crucial as it will turn any values that still cannot be converted into `NaN` (Not a Number). "
                "4. After conversion, you can handle potential `NaN` values, for example by filling them with 0 using `.fillna(0)` if it's appropriate for the context of the analysis. "
                "Do NOT attempt to use `.str` accessor on columns that are not of `object` dtype."
            )

            # Add instruction for the output directory for plots
            technical_notes.append(
                f"You MUST save any generated plots or image files to the following directory: '{temp_image_dir}'. "
                "Use this full, absolute path. Do not use relative paths for saving files."
            )

            # Add instruction for file headers if they exist
            if file_header and isinstance(file_header, list):
                technical_notes.append(
                    f"The data file has the following columns: {file_header}. "
                    f"You MUST use these exact column names to answer the question."
                )
            
            # Append all technical notes to the last user message
            if technical_notes:
                notes_string = "\n\n(Technical notes for the AI model: " + " ".join(technical_notes) + ")"
                code_gen_history[-1]["content"] = last_user_message + notes_string

            for attempt in range(max_retries):
                if self._get_cancellation_flag(sid):
                    yield {"status": "failed", "error": "Generation cancelled by user."}
                    return

                temp_script_path = os.path.join(temp_script_dir, f"temp_script_{attempt}.py")
                try:
                    yield {"status": "generating_code", "attempt": attempt + 1}

                    code_generation_result = next(get_python_code(
                        code_gen_history,
                        file_path=file_path,
                        cancellation_check=lambda: self._get_cancellation_flag(sid)
                    ))

                    if self._get_cancellation_flag(sid):
                        yield {"status": "failed", "error": "Generation cancelled by user."}
                        return

                    if "error" in code_generation_result:
                        yield code_generation_result
                        return

                    python_code = code_generation_result.get("python_code")
                    last_python_code = python_code
                    explanation = code_generation_result.get("explanation", "")
                    if not explanation:
                        explanation = "Hier ist das Ergebnis der von mir durchgeführten Analyse." # Fallback
                    if not python_code:
                        yield {"error": "Failed to generate Python code."}
                        return

                    # --- Sicherheitsüberprüfung ---
                    yield {"status": "security_check"}
                    is_safe, reason = is_code_safe(python_code)
                    if not is_safe:
                        yield {"status": "error", "error": f"Security check failed: {reason}", "code": python_code}
                        conversation_history.append({"role": "system", "content": f"Attempt {attempt + 1} failed the security check: {reason}. You MUST generate a safe version of the code that only performs data analysis and visualization."})
                        continue # Nächsten Versuch starten

                    yield {"status": "executing_code", "code": python_code}

                    with open(temp_script_path, "w", encoding="utf-8") as f:
                        f.write(python_code)

                    process = await asyncio.create_subprocess_exec(
                        "python", temp_script_path,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )

                    try:
                        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)
                    except asyncio.TimeoutError:
                        process.kill()
                        await process.wait()
                        error_message = "Execution timed out after 30 seconds."
                        last_error_message = error_message
                        conversation_history.append({"role": "system", "content": f"Attempt {attempt + 1} failed with a timeout. Please try a more efficient approach."})
                        continue

                    if process.returncode == 0:
                        # Check for generated HTML plots first
                        html_files = glob.glob(os.path.join(temp_image_dir, '*.html'))
                        if html_files:
                            html_contents = []
                            html_plot_paths = []
                            for html_path in html_files:
                                with open(html_path, "r", encoding="utf-8") as html_file:
                                    html_str = html_file.read()
                                    html_contents.append(html_str)
                                    
                                    # Convert HTML to image and save it
                                    try:
                                        fig_json = json.loads(html_str)
                                        fig = pio.from_json(json.dumps(fig_json))
                                        
                                        # Save as PNG
                                        img_path = os.path.join(temp_image_dir, f"plot_{uuid.uuid4()}.png")
                                        fig.write_image(img_path)
                                        html_plot_paths.append(img_path)
                                    except Exception as e:
                                        print(f"Failed to convert Plotly HTML to image: {e}")
                                        # If conversion fails, we won't have a path for this plot
                                        pass

                            conversation_history.append({"role": "system", "content": f"The following Python code was executed successfully and generated {len(html_contents)} HTML plot(s):\n```python\n{python_code}\n```"})
                            yield {
                                "status": "success", 
                                "html_plots": html_contents, 
                                "html_plot_paths": html_plot_paths, # Send back the paths of the generated images
                                "code": python_code, 
                                "explanation": explanation
                            }
                            return

                        # If no plots, process standard output
                        output = stdout.decode().strip()
                        conversation_history.append({"role": "system", "content": f"The following Python code was executed successfully:\n```python\n{python_code}\n```\nAnd produced this output:\n{output}"})
                        
                        # Check for single value output
                        try:
                            # Attempt to parse as a number first
                            val = float(output)
                            # Check if it's an integer
                            if val == int(val):
                                val = int(val)
                            yield {"status": "success", "single_value": val, "code": python_code, "explanation": explanation}
                            return
                        except (ValueError, TypeError):
                            # If not a number, check if it's a simple string (not JSON)
                            if '\n' not in output and not output.strip().startswith(('[', '{')):
                                yield {"status": "success", "single_value": output, "code": python_code, "explanation": explanation}
                                return

                        # If not a single value, try to parse as a table
                        try:
                            table_data = json.loads(output)
                            yield {"status": "success", "table": table_data, "code": python_code, "explanation": explanation}
                        except json.JSONDecodeError:
                            # Fallback to raw output if all else fails
                            yield {"status": "success", "output": output, "code": python_code, "explanation": explanation}
                        return
                    else:
                        error_message = stderr.decode().strip()
                        last_error_message = error_message
                        conversation_history.append({"role": "system", "content": f"Attempt {attempt + 1} failed with error: {error_message}. Please fix the code."})
                        continue

                except Exception as e:
                    error_message = traceback.format_exc()
                    last_error_message = error_message
                    conversation_history.append({"role": "system", "content": f"Attempt {attempt + 1} failed with an exception: {error_message}. Please fix the code."})
                    continue
                finally:
                    if temp_script_path and os.path.exists(temp_script_path):
                        os.remove(temp_script_path)

            yield {"status": "failed", "error": "Leider konnte kein lauffähiger Code erzeugt werden:", "code": last_python_code, "error_details": last_error_message}
        finally:
            self._reset_cancellation_flag(sid)
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
            # Clean up the entire session directory
            if os.path.exists(session_dir):
                shutil.rmtree(session_dir)

    # --- Chat History Functions ---
    
    def _is_chat_saveable(self, messages: list) -> bool:
        """
        Checks if a chat is saveable (only text-based chats without files or generated content).
        """
        if not messages or len(messages) < 2:  # Need at least one user and one assistant message
            return False
            
        for msg in messages:
            # Skip if message has file-related content
            if msg.get("imagePreview") or msg.get("imageUrl") or msg.get("image_b64"):
                return False
            if msg.get("table") or msg.get("images") or msg.get("html_plots"):
                return False
            if msg.get("file") or msg.get("code"):
                return False
            # Only allow text content
            if not msg.get("content") or not isinstance(msg.get("content"), str):
                return False
                
        return True

    def _generate_chat_title(self, messages: list) -> str:
        """
        Generates a title from the first user message.
        """
        for msg in messages:
            if msg.get("role") == "user" and msg.get("content"):
                content = msg["content"].strip()
                # Take first 50 characters and add ellipsis if needed
                if len(content) > 50:
                    return content[:47] + "..."
                return content
        return "Chat"

    def get_chat_history(self, db: Session, user: User):
        """
        Gets the last 10 chat histories for the user.
        """
        chats = db.query(ChatHistory).filter(
            ChatHistory.user_id == user.id
        ).order_by(desc(ChatHistory.created_at)).limit(10).all()
        
        result = []
        for chat in chats:
            # Get first user message for preview
            first_user_msg = db.query(ChatMessage).filter(
                ChatMessage.chat_id == chat.id,
                ChatMessage.role == "user"
            ).order_by(ChatMessage.order).first()
            
            preview = first_user_msg.content[:100] + "..." if first_user_msg and len(first_user_msg.content) > 100 else (first_user_msg.content if first_user_msg else "")
            
            result.append({
                "id": chat.id,
                "title": chat.title,
                "created_at": chat.created_at.isoformat(),
                "preview": preview,
                "message_count": len(chat.messages)
            })
        
        return result

    def save_chat_history(self, db: Session, user: User, title: str, messages: list, selected_fields: list):
        """
        Saves a new chat history if it's saveable.
        """
        # Check if chat is saveable
        if not self._is_chat_saveable(messages):
            raise HTTPException(status_code=400, detail="Chat contains files or generated content and cannot be saved")
        
        # Auto-generate title if not provided or empty
        if not title or title.strip() == "":
            title = self._generate_chat_title(messages)
        
        # Create chat history
        new_chat = ChatHistory(
            title=title,
            user_id=user.id,
            selected_fields=json.dumps(selected_fields) if selected_fields else json.dumps([])
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        
        # Add messages
        for i, msg in enumerate(messages):
            chat_msg = ChatMessage(
                chat_id=new_chat.id,
                role=msg.get("role", "user"),
                content=msg.get("content", ""),
                order=i
            )
            db.add(chat_msg)
        
        db.commit()
        
        # Keep only last 10 chats per user
        all_chats = db.query(ChatHistory).filter(
            ChatHistory.user_id == user.id
        ).order_by(desc(ChatHistory.created_at)).all()
        
        if len(all_chats) > 10:
            chats_to_delete = all_chats[10:]
            for chat in chats_to_delete:
                db.delete(chat)
            db.commit()
        
        return {
            "id": new_chat.id,
            "title": new_chat.title,
            "created_at": new_chat.created_at.isoformat()
        }

    def get_chat_history_detail(self, db: Session, user: User, chat_id: int):
        """
        Gets the complete chat history with messages.
        """
        chat = db.query(ChatHistory).filter(
            ChatHistory.id == chat_id,
            ChatHistory.user_id == user.id
        ).first()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat history not found")
        
        messages = db.query(ChatMessage).filter(
            ChatMessage.chat_id == chat_id
        ).order_by(ChatMessage.order).all()
        
        return {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.isoformat(),
            "selected_fields": json.loads(chat.selected_fields) if chat.selected_fields else [],
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content
                } for msg in messages
            ]
        }

    def delete_chat_history(self, db: Session, user: User, chat_id: int):
        """
        Deletes a chat history.
        """
        chat = db.query(ChatHistory).filter(
            ChatHistory.id == chat_id,
            ChatHistory.user_id == user.id
        ).first()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat history not found")
        
        db.delete(chat)
        db.commit()
        return {"status": "success"}
