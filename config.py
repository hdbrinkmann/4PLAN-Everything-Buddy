"""
Configuration management for 4PLAN Everything Buddy
Handles paths for configuration files and provides fallback defaults
"""
import os
import json
from typing import Dict, Any

# Configuration paths - use environment variables or defaults
CONFIG_PATH = os.getenv("CONFIG_PATH", ".")
DB_PATH = os.getenv("DB_PATH", "./favorites.db")

def get_config_file_path(filename: str) -> str:
    """Get the full path for a configuration file."""
    return os.path.join(CONFIG_PATH, filename)

def load_json_config(filename: str, default: Dict[str, Any] = None) -> Dict[str, Any]:
    """Load a JSON configuration file with fallback to default."""
    if default is None:
        default = {}
    
    filepath = get_config_file_path(filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load {filename}: {e}. Using defaults.")
        return default

def save_json_config(filename: str, data: Dict[str, Any]) -> bool:
    """Save data to a JSON configuration file."""
    filepath = get_config_file_path(filename)
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error: Could not save {filename}: {e}")
        return False

# Configuration file loaders with defaults
def load_admins_config() -> Dict[str, Any]:
    """Load admins configuration."""
    default_admins = {
        "admins": [
            "hdb@software4you.com",
            "adeingruber@software4you.com", 
            "thoffmann@software4you.com",
            "mabele@software4you.com",
            "cwalter@software4you.com"
        ]
    }
    return load_json_config("admins.json", default_admins)

def load_features_config() -> Dict[str, Any]:
    """Load features configuration."""
    default_features = {
        "image_generation": True,
        "image_upload": True,
        "pdf_docx_upload": True,
        "txt_sql_upload": True,
        "xlsx_csv_analysis": True,
        "web_search": True
    }
    return load_json_config("features.json", default_features)

def load_knowledge_fields_config() -> Dict[str, Any]:
    """Load knowledge fields configuration."""
    default_fields = {
        "fields": [
            {
                "name": "General",
                "description": "General knowledge and information",
                "domains": ["*"]  # Available to all domains
            }
        ]
    }
    return load_json_config("knowledge_fields.json", default_fields)

# Save functions
def save_admins_config(data: Dict[str, Any]) -> bool:
    """Save admins configuration."""
    return save_json_config("admins.json", data)

def save_features_config(data: Dict[str, Any]) -> bool:
    """Save features configuration."""
    return save_json_config("features.json", data)

def save_knowledge_fields_config(data: Dict[str, Any]) -> bool:
    """Save knowledge fields configuration."""
    return save_json_config("knowledge_fields.json", data)
