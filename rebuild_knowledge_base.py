#!/usr/bin/env python3
"""
Rebuild Knowledge Base Script
Erstellt die Knowledge Base neu mit dem korrigierten Knowledge Field Bug
"""

import sys
import os
from app_logic import AppLogic

def main():
    print("🔄 Rebuilding Knowledge Base with corrected Knowledge Field detection...")
    print("="*70)
    
    # Erstelle AppLogic Instanz
    logic = AppLogic()
    
    # Führe Knowledge Base Update durch
    try:
        for status_message in logic.update_knowledge_base():
            print(f"📌 {status_message}")
        
        print("\n🎉 Knowledge Base Update erfolgreich abgeschlossen!")
        print("✅ Das System sollte jetzt korrekt auf Fragen zu neuen Dateien antworten.")
        
    except Exception as e:
        print(f"❌ Fehler beim Knowledge Base Update: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
