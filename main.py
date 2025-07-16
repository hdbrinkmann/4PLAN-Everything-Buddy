import uvicorn
from api import app
import os
import shutil
import logging
from dotenv import load_dotenv

load_dotenv()

def clear_temp_uploads():
    """Clears the temp_uploads directory."""
    temp_dir = "temp_uploads"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)

def setup_ssl_certificates():
    """Set up SSL certificates for HTTPS."""
    ssl_dir = "ssl"
    cert_file = os.path.join(ssl_dir, "cert.pem")
    key_file = os.path.join(ssl_dir, "key.pem")
    
    # Create SSL directory if it doesn't exist
    os.makedirs(ssl_dir, exist_ok=True)
    
    # Check if certificates exist
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("SSL certificates not found. Generating self-signed certificates...")
        try:
            # Try to run the SSL generation script
            os.system("./generate-ssl.sh")
        except Exception as e:
            print(f"Error generating SSL certificates: {e}")
            print("Please run './generate-ssl.sh' manually or provide SSL certificates.")
            return None, None
    
    return cert_file, key_file

if __name__ == "__main__":
    # Configure logging to reduce httpx verbosity
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    clear_temp_uploads()
    """
    This is the main entry point for the backend server.
    It starts the Uvicorn server with the FastAPI application instance from api.py.
    
    To run the server with HTTPS, execute this file:
    python main.py
    """
    
    # Set up SSL certificates
    ssl_cert, ssl_key = setup_ssl_certificates()
    
    # Determine if we're running in Docker or locally
    is_docker = os.path.exists("/.dockerenv") or os.environ.get("FRONTEND_PATH")
    
    if ssl_cert and ssl_key and os.path.exists(ssl_cert) and os.path.exists(ssl_key):
        # Run with HTTPS
        print("Starting server with HTTPS...")
        # Use port 8443 for development, 443 for Docker/production
        https_port = 443 if is_docker else 8443
        uvicorn.run(
            "api:app",
            host="0.0.0.0" if is_docker else "127.0.0.1",
            port=https_port,
            ssl_certfile=ssl_cert,
            ssl_keyfile=ssl_key,
            reload=not is_docker,  # Only reload in development
            reload_dirs=["."] if not is_docker else None
        )
    else:
        # Fallback to HTTP for development if SSL setup fails
        print("SSL certificates not available. Starting server with HTTP...")
        print("Warning: Azure AD requires HTTPS for production!")
        uvicorn.run(
            "api:app",
            host="0.0.0.0" if is_docker else "127.0.0.1",
            port=8002,
            reload=not is_docker,
            reload_dirs=["."] if not is_docker else None
        )
