import os
from llm import robust_api_call, LLM_MODEL
from together import Together
from database import SessionLocal, FaultyCodeLog
from datetime import datetime

# --- 1. Verteidigungslinie: Statische Analyse ---
# Liste von Modulen, deren Import generell verboten ist.
BLACKLISTED_MODULES = [
    "os", "subprocess", "shutil", "sys", "glob", "socket", 
    "requests", "urllib", "http", "ctypes", "multiprocessing"
]
# Liste von Funktionen, deren Aufruf generell verboten ist.
BLACKLISTED_FUNCTIONS = ["eval", "exec"]

def static_code_analysis(code: str) -> tuple[bool, str]:
    """
    Führt eine einfache statische Analyse durch, um offensichtliche Risiken zu finden.
    Gibt (is_safe, reason) zurück.
    """
    for module in BLACKLISTED_MODULES:
        if f"import {module}" in code or f"from {module}" in code:
            return False, f"Sicherheitsrisiko: Die Verwendung des Moduls '{module}' ist verboten."

    for func in BLACKLISTED_FUNCTIONS:
        if f"{func}(" in code:
            return False, f"Sicherheitsrisiko: Die Verwendung der Funktion '{func}()' ist verboten."
    
    # Prüft, ob 'open()' im Schreib- oder Anhängemodus verwendet wird.
    if "open(" in code and ("'w'" in code or "'a'" in code or "mode='w'" in code or "mode='a'" in code):
        return False, "Sicherheitsrisiko: Das Schreiben von Dateien ist verboten."

    return True, "Statische Analyse bestanden."

# --- 2. Verteidigungslinie: LLM Security Audit ---
def llm_security_audit(client, code: str) -> tuple[bool, str]:
    """
    Beauftragt ein auf Sicherheit spezialisiertes LLM mit der Code-Prüfung.
    Gibt (is_safe, reason) zurück.
    """
    system_prompt = """You are a senior Python security expert. Your sole task is to analyze the provided Python code for any potential security vulnerabilities, malicious intent, or dangerous operations.

Analyze the code for the following risks:
- **File System Access:** Any attempt to read, write, modify, or delete files. Reading the specified input file is allowed.
- **Network Access:** Any attempt to make network requests.
- **Data Exfiltration:** Any attempt to send data to an external location.
- **Command Execution:** Any attempt to execute shell commands or other subprocesses.
- **Environment Variable Access:** Any attempt to access or modify environment variables.

Your response MUST be a single word: 'SAFE' or 'UNSAFE'.
- If the code is safe and only performs data analysis (e.g., using pandas on a given file) and generates a result (JSON or a plotly plot saved to 'temp_images/'), respond with 'SAFE'.
- If you detect ANY potential risk, no matter how small, respond with 'UNSAFE'.
- Do NOT provide any explanation or additional text. Just the single word.
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"```python\n{code}\n```"}
    ]

    try:
        # Wir verwenden das Llama-3-Modell gemäß dem Feedback des Benutzers.
        response = robust_api_call(client, LLM_MODEL, messages, 0.0)
        decision = response.choices[0].message.content.strip().upper()

        if "SAFE" in decision:
            return True, "LLM-Sicherheitsaudit bestanden."
        else:
            return False, "LLM-Sicherheitsaudit fehlgeschlagen: Das Modell hat ein potenzielles Sicherheitsrisiko identifiziert."
    except Exception as e:
        return False, f"Fehler beim LLM-Sicherheitsaudit: {e}"

# --- Hauptfunktion ---
def is_code_safe(code: str) -> tuple[bool, str]:
    """
    Führt die mehrstufige Sicherheitsprüfung durch.
    Gibt (is_safe, reason) zurück.
    """
    # Schritt 1: Statische Analyse
    is_safe, reason = static_code_analysis(code)
    if not is_safe:
        return False, reason

    # Schritt 2: LLM-Audit (benötigt einen API-Client)
    try:
        client = Together(api_key=os.getenv("TOGETHER_API_KEY"))
        is_safe, reason = llm_security_audit(client, code)
        if not is_safe:
            return False, reason
    except Exception as e:
        return False, f"Konnte Sicherheits-Service nicht initialisieren: {e}"

    return True, "Code hat alle Sicherheitsprüfungen bestanden."

# --- Logging Function ---
def log_faulty_code(user_id: int, python_code: str, security_failure_reason: str, original_question: str, session_id: str = None, attempt_number: int = 1):
    """
    Logs faulty or unsecure Python code to the database for analysis.
    """
    try:
        db = SessionLocal()
        try:
            faulty_code_log = FaultyCodeLog(
                user_id=user_id,
                python_code=python_code,
                security_failure_reason=security_failure_reason,
                original_question=original_question,
                session_id=session_id,
                attempt_number=attempt_number,
                timestamp=datetime.utcnow()
            )
            db.add(faulty_code_log)
            db.commit()
            print(f"Faulty code logged for user {user_id}: {security_failure_reason}")
        finally:
            db.close()
    except Exception as e:
        print(f"Error logging faulty code: {e}")
