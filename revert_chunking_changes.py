#!/usr/bin/env python3
"""
Revert Script for Enhanced Chunking Changes
Restores the original chunking strategy from backup
"""

import os
import shutil
import sys

def revert_changes():
    """Reverts all chunking changes back to original implementation"""
    
    print("🔄 Reverting Enhanced Chunking Changes...")
    
    # Check if backup exists
    if not os.path.exists("llm_backup_original.py"):
        print("❌ ERROR: No backup file found! Cannot revert changes.")
        sys.exit(1)
    
    try:
        # Restore original llm.py
        shutil.copy("llm_backup_original.py", "llm.py")
        print("✅ Restored original llm.py from backup")
        
        # Clear vector store to force rebuild with original chunking
        vector_store_path = "vector_store"
        if os.path.exists(vector_store_path):
            shutil.rmtree(vector_store_path)
            print("✅ Cleared vector store (will need to rebuild)")
        
        print("\n🎉 Revert completed successfully!")
        print("⚠️  IMPORTANT: You need to rebuild the knowledge base with:")
        print("    python rebuild_knowledge_base.py")
        
    except Exception as e:
        print(f"❌ ERROR during revert: {e}")
        sys.exit(1)

if __name__ == "__main__":
    revert_changes()
