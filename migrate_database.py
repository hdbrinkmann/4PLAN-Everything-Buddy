#!/usr/bin/env python3
"""
Database migration script to add the rating column to the chat_question_logs table.
Run this script to update the existing database schema.
"""

import sqlite3
import os
from datetime import datetime

# Database file path
DATABASE_PATH = "favorites.db"

def migrate_database():
    """Add the rating column to the chat_question_logs table if it doesn't exist."""
    
    if not os.path.exists(DATABASE_PATH):
        print(f"Database file {DATABASE_PATH} not found!")
        return False
    
    try:
        # Connect to the database
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Check if the rating column already exists
        cursor.execute("PRAGMA table_info(chat_question_logs)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]
        
        if 'rating' in column_names:
            print("Rating column already exists in chat_question_logs table.")
            return True
        
        # Add the rating column
        cursor.execute("""
            ALTER TABLE chat_question_logs 
            ADD COLUMN rating TEXT
        """)
        
        conn.commit()
        print("Successfully added 'rating' column to chat_question_logs table.")
        
        # Verify the column was added
        cursor.execute("PRAGMA table_info(chat_question_logs)")
        columns = cursor.fetchall()
        print("\nUpdated table structure:")
        for column in columns:
            print(f"  - {column[1]} ({column[2]})")
        
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("=== Database Migration Script ===")
    print(f"Migrating database: {DATABASE_PATH}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    success = migrate_database()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("You can now restart the application and the rating functionality will work.")
    else:
        print("\n❌ Migration failed!")
        print("Please check the error messages above and try again.")
