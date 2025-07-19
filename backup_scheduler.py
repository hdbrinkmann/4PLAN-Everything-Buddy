#!/usr/bin/env python3
"""
4PLAN Everything Buddy - Container-based Backup Scheduler
Runs automated backups within the Docker container
"""

import asyncio
import json
import logging
import schedule
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional
from backup_manager import BackupManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class BackupScheduler:
    def __init__(self, config_file: str = "backup_config.json"):
        self.project_root = Path(__file__).parent.absolute()
        self.config_file = self.project_root / config_file
        self.backup_manager = BackupManager(config_file)
        
        self._running = False
        self._scheduler_thread = None
        self._next_run_time = None
        
        # Load or create initial configuration
        self.config = self.load_config()
        self.save_config()  # Ensure config file exists
        
    def load_config(self) -> Dict:
        """Load backup scheduler configuration"""
        default_config = {
            "enabled": True,
            "backup_time": "02:00",
            "retention_days": 7,
            "retention_months": 12,
            "compress": True,
            "verify_integrity": True,
            "timezone": "Europe/Berlin",
            "last_backup": None,
            "next_backup": None,
            "last_backup_success": None,
            "backup_count_total": 0,
            "backup_count_daily": 0,
            "backup_count_monthly": 0,
            "backup_count_manual": 0,
            "total_storage_bytes": 0
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                # Merge with defaults
                default_config.update(config)
                return default_config
            except Exception as e:
                logging.warning(f"Could not load scheduler config: {e}. Using defaults.")
        
        return default_config
    
    def save_config(self):
        """Save current configuration"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            
            # Also update backup_manager config
            self.backup_manager.config.update({
                'retention_days': self.config['retention_days'],
                'retention_months': self.config['retention_months'],
                'backup_time': self.config['backup_time'],
                'compress': self.config['compress'],
                'verify_integrity': self.config['verify_integrity']
            })
            self.backup_manager.save_config()
            
        except Exception as e:
            logging.error(f"Could not save scheduler config: {e}")
    
    def update_config(self, new_config: Dict) -> bool:
        """Update configuration and restart scheduler if needed"""
        try:
            old_time = self.config.get('backup_time')
            old_enabled = self.config.get('enabled')
            
            # Update config
            self.config.update(new_config)
            self.save_config()
            
            # Restart scheduler if time changed or enabled status changed
            time_changed = old_time != self.config.get('backup_time')
            enabled_changed = old_enabled != self.config.get('enabled')
            
            if (time_changed or enabled_changed) and self._running:
                logging.info("Backup configuration changed, restarting scheduler...")
                self.stop_scheduler()
                if self.config.get('enabled', True):
                    self.start_scheduler()
            elif not self._running and self.config.get('enabled', True):
                self.start_scheduler()
            elif self._running and not self.config.get('enabled', True):
                self.stop_scheduler()
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to update config: {e}")
            return False
    
    def start_scheduler(self):
        """Start the backup scheduler"""
        if self._running:
            logging.warning("Scheduler is already running")
            return
        
        if not self.config.get('enabled', True):
            logging.info("Backup scheduler is disabled")
            return
        
        self._running = True
        self._scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self._scheduler_thread.start()
        
        logging.info(f"Backup scheduler started - daily backups at {self.config['backup_time']}")
        self._calculate_next_run_time()
    
    def stop_scheduler(self):
        """Stop the backup scheduler"""
        if not self._running:
            logging.warning("Scheduler is not running")
            return
        
        self._running = False
        schedule.clear()
        
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            self._scheduler_thread.join(timeout=5)
        
        logging.info("Backup scheduler stopped")
        self._next_run_time = None
        self.config['next_backup'] = None
        self.save_config()
    
    def _run_scheduler(self):
        """Main scheduler loop"""
        # Clear any existing schedules
        schedule.clear()
        
        # Schedule daily backup
        backup_time = self.config.get('backup_time', '02:00')
        schedule.every().day.at(backup_time).do(self._create_scheduled_backup)
        
        logging.info(f"Scheduled daily backup at {backup_time}")
        
        # Calculate next run time
        self._calculate_next_run_time()
        
        # Main loop
        while self._running:
            try:
                schedule.run_pending()
                time.sleep(30)  # Check every 30 seconds
                
                # Update next run time periodically
                if self._next_run_time and datetime.now() > self._next_run_time:
                    self._calculate_next_run_time()
                    
            except Exception as e:
                logging.error(f"Scheduler error: {e}")
                time.sleep(60)  # Wait a minute before retrying
    
    def _calculate_next_run_time(self):
        """Calculate when the next backup will run"""
        try:
            backup_time_str = self.config.get('backup_time', '02:00')
            hour, minute = map(int, backup_time_str.split(':'))
            
            now = datetime.now()
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If the time has already passed today, schedule for tomorrow
            if next_run <= now:
                next_run += timedelta(days=1)
            
            self._next_run_time = next_run
            self.config['next_backup'] = next_run.isoformat()
            self.save_config()
            
            logging.info(f"Next backup scheduled for: {next_run}")
            
        except Exception as e:
            logging.error(f"Error calculating next run time: {e}")
            self._next_run_time = None
    
    def _create_scheduled_backup(self):
        """Create an automated daily backup"""
        logging.info("Starting scheduled backup...")
        
        try:
            success = self.backup_manager.create_backup(
                description="Daily automated backup",
                backup_type="daily"
            )
            
            # Update statistics
            self._update_backup_statistics()
            
            # Update last backup info
            self.config['last_backup'] = datetime.now().isoformat()
            self.config['last_backup_success'] = success
            self.save_config()
            
            if success:
                logging.info("Scheduled backup completed successfully")
                
                # Run cleanup after successful backup
                self.backup_manager.cleanup_old_backups()
            else:
                logging.error("Scheduled backup failed")
                
        except Exception as e:
            logging.error(f"Scheduled backup error: {e}")
            self.config['last_backup'] = datetime.now().isoformat()
            self.config['last_backup_success'] = False
            self.save_config()
    
    def create_manual_backup(self, description: str = "") -> bool:
        """Create a manual backup"""
        logging.info(f"Creating manual backup: {description}")
        
        try:
            success = self.backup_manager.create_backup(
                description=description or "Manual backup via Admin UI",
                backup_type="manual"
            )
            
            # Update statistics
            self._update_backup_statistics()
            
            if success:
                logging.info("Manual backup created successfully")
            else:
                logging.error("Manual backup failed")
                
            return success
            
        except Exception as e:
            logging.error(f"Manual backup error: {e}")
            return False
    
    def _update_backup_statistics(self):
        """Update backup statistics in config"""
        try:
            backups = self.backup_manager.list_backups()
            
            self.config['backup_count_total'] = len(backups)
            self.config['backup_count_daily'] = len([b for b in backups if b['type'] == 'daily'])
            self.config['backup_count_monthly'] = len([b for b in backups if b['type'] == 'monthly'])
            self.config['backup_count_manual'] = len([b for b in backups if b['type'] == 'manual'])
            
            total_size = sum(b.get('size', 0) for b in backups)
            self.config['total_storage_bytes'] = total_size
            
            self.save_config()
            
        except Exception as e:
            logging.error(f"Error updating backup statistics: {e}")
    
    def get_status(self) -> Dict:
        """Get current scheduler status"""
        # Update statistics before returning status
        self._update_backup_statistics()
        
        backups = self.backup_manager.list_backups()
        
        return {
            "scheduler_running": self._running,
            "enabled": self.config.get('enabled', True),
            "backup_time": self.config.get('backup_time', '02:00'),
            "last_backup": self.config.get('last_backup'),
            "last_backup_success": self.config.get('last_backup_success'),
            "next_backup": self.config.get('next_backup'),
            "retention_days": self.config.get('retention_days', 7),
            "retention_months": self.config.get('retention_months', 12),
            "total_backups": len(backups),
            "daily_backups": len([b for b in backups if b['type'] == 'daily']),
            "monthly_backups": len([b for b in backups if b['type'] == 'monthly']),
            "manual_backups": len([b for b in backups if b['type'] == 'manual']),
            "total_storage_bytes": sum(b.get('size', 0) for b in backups),
            "total_storage_human": self._human_size(sum(b.get('size', 0) for b in backups)),
            "compress": self.config.get('compress', True),
            "verify_integrity": self.config.get('verify_integrity', True)
        }
    
    def get_backup_list(self) -> list:
        """Get list of all backups"""
        return self.backup_manager.list_backups()
    
    def delete_backup(self, backup_name: str) -> bool:
        """Delete a specific backup"""
        try:
            self.backup_manager._delete_backup(backup_name)
            self._update_backup_statistics()
            return True
        except Exception as e:
            logging.error(f"Error deleting backup {backup_name}: {e}")
            return False
    
    def cleanup_old_backups(self) -> Dict:
        """Manually run cleanup and return results"""
        try:
            old_count = len(self.backup_manager.list_backups())
            self.backup_manager.cleanup_old_backups()
            new_count = len(self.backup_manager.list_backups())
            
            deleted_count = old_count - new_count
            
            self._update_backup_statistics()
            
            return {
                "success": True,
                "deleted_count": deleted_count,
                "remaining_count": new_count
            }
            
        except Exception as e:
            logging.error(f"Error during cleanup: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _human_size(size_bytes: int) -> str:
        """Convert bytes to human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"
    
    def is_running(self) -> bool:
        """Check if scheduler is running"""
        return self._running
    
    def restart_scheduler(self):
        """Restart the scheduler"""
        if self._running:
            self.stop_scheduler()
            time.sleep(1)  # Brief pause
        self.start_scheduler()


# Global scheduler instance
_scheduler_instance: Optional[BackupScheduler] = None

def get_scheduler() -> BackupScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = BackupScheduler()
        # Auto-start if enabled
        if _scheduler_instance.config.get('enabled', True):
            _scheduler_instance.start_scheduler()
    return _scheduler_instance

def initialize_scheduler():
    """Initialize the backup scheduler on application startup"""
    scheduler = get_scheduler()
    logging.info("Backup scheduler initialized")
    return scheduler

if __name__ == '__main__':
    # For testing purposes
    scheduler = BackupScheduler()
    scheduler.start_scheduler()
    
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        scheduler.stop_scheduler()
        print("Scheduler stopped")
