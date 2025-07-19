#!/usr/bin/env python3
"""
4PLAN Everything Buddy - Backup Manager
Cross-platform backup and restore system for Docker-based application
"""

import os
import sys
import json
import datetime
import subprocess
import shutil
import hashlib
import tarfile
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import platform

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup.log'),
        logging.StreamHandler()
    ]
)

class BackupManager:
    def __init__(self, config_file: str = "backup_config.json"):
        self.project_root = Path(__file__).parent.absolute()
        self.config_file = self.project_root / config_file
        # Use /app/backups in container, backups/ locally
        if os.path.exists("/app/backups"):
            self.backup_dir = Path("/app/backups")
        else:
            self.backup_dir = self.project_root / "backups"
        self.config = self.load_config()
        
        # Ensure backup directory exists (robust fallback)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Docker volume names (actual volumes in use - without hyphens)
        self.volumes = {
            'db': '4planeverythingbuddy_db_data',
            'vector': '4planeverythingbuddy_vector_data', 
            'config': '4planeverythingbuddy_config_data',
            'ssl': '4planeverythingbuddy_ssl_data'
        }
        
    def load_config(self) -> Dict:
        """Load backup configuration"""
        default_config = {
            "retention_days": 7,
            "retention_months": 12,
            "backup_time": "02:00",
            "compress": True,
            "verify_integrity": True,
            "incremental": False
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                # Merge with defaults
                default_config.update(config)
                return default_config
            except Exception as e:
                logging.warning(f"Could not load config: {e}. Using defaults.")
                
        return default_config
    
    def save_config(self):
        """Save current configuration"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logging.error(f"Could not save config: {e}")
    
    def get_container_name(self) -> str:
        """Get the app container name"""
        try:
            result = subprocess.run([
                "docker", "compose", "ps", "-q", "app"
            ], capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
            else:
                # Try to find container by image name pattern
                result = subprocess.run([
                    "docker", "ps", "--format", "{{.ID}}", "--filter", "ancestor=4plan-everything-buddy-app"
                ], capture_output=True, text=True)
                
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()
                    
        except Exception as e:
            logging.error(f"Error getting container name: {e}")
        
        return None
    
    def create_backup(self, description: str = "", backup_type: str = "manual") -> bool:
        """Create a complete backup"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}_{backup_type}"
        backup_path = self.backup_dir / backup_name
        
        logging.info(f"Creating backup: {backup_name}")
        logging.info(f"Description: {description}")
        
        try:
            # Create backup directory
            backup_path.mkdir(exist_ok=True)
            
            # Create metadata
            metadata = {
                "timestamp": timestamp,
                "description": description,
                "type": backup_type,
                "created_at": datetime.datetime.now().isoformat(),
                "system": platform.system(),
                "volumes": list(self.volumes.keys()),
                "config": self.config.copy()
            }
            
            # Step 1: Backup Docker images
            if not self._backup_images(backup_path):
                raise Exception("Failed to backup Docker images")
                
            # Step 2: Create database checkpoint for consistency
            self._create_db_checkpoint()
            
            # Step 3: Backup Docker volumes
            for vol_name, vol_id in self.volumes.items():
                if not self._backup_volume(vol_id, backup_path / f"{vol_name}_data.tar.gz"):
                    raise Exception(f"Failed to backup volume: {vol_name}")
            
            # Step 4: Save metadata
            with open(backup_path / "metadata.json", 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Step 5: Create integrity checksums
            if not self._create_checksums(backup_path):
                raise Exception("Failed to create checksums")
            
            # Step 6: Update backup registry
            self._update_backup_registry(backup_name, metadata)
            
            logging.info(f"Backup completed successfully: {backup_name}")
            return True
            
        except Exception as e:
            logging.error(f"Backup failed: {e}")
            # Cleanup failed backup
            if backup_path.exists():
                shutil.rmtree(backup_path)
            return False
    
    def _backup_images(self, backup_path: Path) -> bool:
        """Backup Docker images"""
        logging.info("Backing up Docker images...")
        
        try:
            # Get currently running container images
            result = subprocess.run([
                "docker", "ps", "--format", "{{.Image}}", "--filter", "status=running"
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                logging.error(f"Failed to get running container images: {result.stderr}")
                return False
            
            images = [img.strip() for img in result.stdout.strip().split('\n') if img.strip()]
            
            # Also try to get images by compose project pattern
            if not images:
                logging.info("No running images found, trying project pattern...")
                result = subprocess.run([
                    "docker", "images", "--format", "{{.Repository}}:{{.Tag}}", "--filter", "reference=4plan*"
                ], capture_output=True, text=True)
                
                if result.returncode == 0:
                    images = [img.strip() for img in result.stdout.strip().split('\n') if img.strip()]
            
            # Final fallback: try common patterns
            if not images:
                logging.info("No images found by pattern, using fallback names...")
                patterns = [
                    "4plan-everything-buddy-app",
                    "4plan-everything-buddy_app",
                    "*4plan*app*"
                ]
                
                for pattern in patterns:
                    result = subprocess.run([
                        "docker", "images", "--format", "{{.Repository}}:{{.Tag}}", "--filter", f"reference={pattern}"
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0 and result.stdout.strip():
                        images = [img.strip() for img in result.stdout.strip().split('\n') if img.strip()]
                        if images:
                            break
            
            if not images:
                logging.error("No Docker images found to backup")
                return False
            
            logging.info(f"Found images to backup: {images}")
            
            # Save images to tar
            image_file = backup_path / "images.tar"
            cmd = ["docker", "save", "-o", str(image_file)] + images
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logging.info(f"Docker images backed up to {image_file}")
                return True
            else:
                logging.error(f"Failed to backup images: {result.stderr}")
                return False
                
        except Exception as e:
            logging.error(f"Error backing up images: {e}")
            return False
    
    def _create_db_checkpoint(self):
        """Create SQLite checkpoint for consistency"""
        logging.info("Creating database checkpoint...")
        
        container_name = self.get_container_name()
        if not container_name:
            logging.warning("Could not find app container for database checkpoint")
            return
        
        try:
            # Execute SQLite checkpoint inside container
            subprocess.run([
                "docker", "exec", container_name,
                "python", "-c", 
                "import sqlite3; db = sqlite3.connect('/app/db_volume/favorites.db'); db.execute('PRAGMA wal_checkpoint(FULL)'); db.close()"
            ], capture_output=True, text=True)
            
            logging.info("Database checkpoint created")
            
        except Exception as e:
            logging.warning(f"Could not create database checkpoint: {e}")
    
    def _backup_volume(self, volume_name: str, output_file: Path) -> bool:
        """Backup a Docker volume"""
        logging.info(f"Backing up volume: {volume_name}")
        
        try:
            # First check if volume exists
            check_cmd = ["docker", "volume", "inspect", volume_name]
            check_result = subprocess.run(check_cmd, capture_output=True, text=True)
            
            if check_result.returncode != 0:
                logging.warning(f"Volume {volume_name} does not exist, creating empty backup")
                # Create empty tar.gz file
                with open(output_file, 'wb') as f:
                    import gzip
                    with gzip.open(f, 'wb') as gz:
                        gz.write(b'')
                return True
            
            # Get backup name from output_file path
            backup_name = output_file.parent.name
            
            # Create backup using a simple approach - output to stdout and redirect
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{volume_name}:/data:ro",
                "alpine",
                "tar", "czf", "-", "-C", "/data", "."
            ]
            
            logging.info(f"Running backup command: {' '.join(cmd)}")
            
            # Save the backup to file
            with open(output_file, 'wb') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=False)
            
            if result.returncode == 0:
                # Verify backup file was created and has reasonable size
                if output_file.exists():
                    size = output_file.stat().st_size
                    logging.info(f"Volume {volume_name} backed up to {output_file} (size: {size} bytes)")
                    if size < 50:  # Very small backup might indicate empty volume
                        logging.warning(f"Backup file for {volume_name} is very small ({size} bytes) - volume might be empty")
                    return True
                else:
                    logging.error(f"Backup file {output_file} was not created")
                    return False
            else:
                logging.error(f"Failed to backup volume {volume_name}")
                logging.error(f"Command: {' '.join(cmd)}")
                logging.error(f"Return code: {result.returncode}")
                if result.stderr:
                    logging.error(f"STDERR: {result.stderr.decode('utf-8')}")
                return False
                
        except Exception as e:
            logging.error(f"Error backing up volume {volume_name}: {e}")
            import traceback
            logging.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def _create_checksums(self, backup_path: Path) -> bool:
        """Create SHA256 checksums for all backup files"""
        logging.info("Creating integrity checksums...")
        
        try:
            checksums = {}
            checksum_file = backup_path / "checksums.sha256"
            
            for file_path in backup_path.iterdir():
                if file_path.is_file() and file_path.name != "checksums.sha256":
                    sha256_hash = hashlib.sha256()
                    with open(file_path, "rb") as f:
                        for chunk in iter(lambda: f.read(4096), b""):
                            sha256_hash.update(chunk)
                    
                    checksums[file_path.name] = sha256_hash.hexdigest()
            
            with open(checksum_file, 'w') as f:
                for filename, checksum in checksums.items():
                    f.write(f"{checksum}  {filename}\n")
            
            logging.info("Checksums created")
            return True
            
        except Exception as e:
            logging.error(f"Error creating checksums: {e}")
            return False
    
    def _update_backup_registry(self, backup_name: str, metadata: Dict):
        """Update backup registry"""
        registry_file = self.backup_dir / "registry.json"
        
        try:
            if registry_file.exists():
                with open(registry_file, 'r') as f:
                    registry = json.load(f)
            else:
                registry = {}
            
            registry[backup_name] = metadata
            
            with open(registry_file, 'w') as f:
                json.dump(registry, f, indent=2)
                
        except Exception as e:
            logging.error(f"Error updating registry: {e}")
    
    def list_backups(self) -> List[Dict]:
        """List all available backups"""
        registry_file = self.backup_dir / "registry.json"
        
        if not registry_file.exists():
            return []
        
        try:
            with open(registry_file, 'r') as f:
                registry = json.load(f)
            
            backups = []
            for backup_name, metadata in registry.items():
                backup_path = self.backup_dir / backup_name
                if backup_path.exists():
                    # Get backup size
                    total_size = sum(f.stat().st_size for f in backup_path.rglob('*') if f.is_file())
                    metadata['size'] = total_size
                    metadata['size_human'] = self._human_size(total_size)
                    metadata['name'] = backup_name
                    backups.append(metadata)
            
            # Sort by timestamp (newest first)
            backups.sort(key=lambda x: x['timestamp'], reverse=True)
            return backups
            
        except Exception as e:
            logging.error(f"Error listing backups: {e}")
            return []
    
    def restore_backup(self, backup_name: str, confirm: bool = False) -> bool:
        """Restore a backup"""
        if not confirm:
            logging.error("Restore requires explicit confirmation")
            return False
        
        backup_path = self.backup_dir / backup_name
        if not backup_path.exists():
            logging.error(f"Backup not found: {backup_name}")
            return False
        
        logging.info(f"Restoring backup: {backup_name}")
        
        try:
            # Step 1: Verify backup integrity
            if not self._verify_backup(backup_path):
                logging.error("Backup integrity check failed")
                return False
            
            # Step 2: Stop application
            logging.info("Stopping application...")
            subprocess.run(["docker", "compose", "down"], cwd=self.project_root)
            
            # Step 3: Restore images
            if not self._restore_images(backup_path):
                raise Exception("Failed to restore images")
            
            # Step 4: Restore volumes
            for vol_name in self.volumes.keys():
                if not self._restore_volume(backup_path / f"{vol_name}_data.tar.gz", self.volumes[vol_name]):
                    raise Exception(f"Failed to restore volume: {vol_name}")
            
            # Step 5: Start application
            logging.info("Starting application...")
            
            # Try multiple approaches to start the application
            start_commands = [
                ["docker", "compose", "up", "-d"],
                ["docker-compose", "up", "-d"]
            ]
            
            application_started = False
            for cmd in start_commands:
                try:
                    logging.info(f"Trying to start application with: {' '.join(cmd)}")
                    result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        logging.info("Application started successfully")
                        application_started = True
                        break
                    else:
                        logging.warning(f"Command failed with return code {result.returncode}")
                        if result.stderr:
                            logging.warning(f"STDERR: {result.stderr}")
                        if result.stdout:
                            logging.info(f"STDOUT: {result.stdout}")
                except Exception as e:
                    logging.warning(f"Command {' '.join(cmd)} failed with exception: {e}")
                    continue
            
            if application_started:
                logging.info(f"Restore completed successfully: {backup_name}")
                return True
            else:
                # Log detailed error but don't fail completely - volumes are restored
                logging.error("Failed to start application automatically after restore")
                logging.info("Volumes have been restored successfully - you may need to start the application manually")
                logging.info("You can start the application with: docker compose up -d")
                return True  # Return success since the restore itself worked
                
        except Exception as e:
            logging.error(f"Restore failed: {e}")
            # Try to start application anyway
            subprocess.run(["docker", "compose", "up", "-d"], cwd=self.project_root)
            return False
    
    def _verify_backup(self, backup_path: Path) -> bool:
        """Verify backup integrity"""
        logging.info("Verifying backup integrity...")
        
        checksum_file = backup_path / "checksums.sha256"
        if not checksum_file.exists():
            logging.warning("No checksum file found")
            return True  # Don't fail if no checksums
        
        try:
            with open(checksum_file, 'r') as f:
                for line in f:
                    if not line.strip():
                        continue
                    
                    checksum, filename = line.strip().split('  ', 1)
                    file_path = backup_path / filename
                    
                    if not file_path.exists():
                        logging.error(f"Missing file: {filename}")
                        return False
                    
                    # Calculate actual checksum
                    sha256_hash = hashlib.sha256()
                    with open(file_path, "rb") as f:
                        for chunk in iter(lambda: f.read(4096), b""):
                            sha256_hash.update(chunk)
                    
                    if sha256_hash.hexdigest() != checksum:
                        logging.error(f"Checksum mismatch for file: {filename}")
                        return False
            
            logging.info("Backup integrity verified")
            return True
            
        except Exception as e:
            logging.error(f"Error verifying backup: {e}")
            return False
    
    def _restore_images(self, backup_path: Path) -> bool:
        """Restore Docker images"""
        logging.info("Restoring Docker images...")
        
        image_file = backup_path / "images.tar"
        if not image_file.exists():
            logging.error("Image backup not found")
            return False
        
        try:
            result = subprocess.run([
                "docker", "load", "-i", str(image_file)
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                logging.info("Docker images restored")
                return True
            else:
                logging.error(f"Failed to restore images: {result.stderr}")
                return False
                
        except Exception as e:
            logging.error(f"Error restoring images: {e}")
            return False
    
    def _restore_volume(self, backup_file: Path, volume_name: str) -> bool:
        """Restore a Docker volume"""
        logging.info(f"Restoring volume: {volume_name}")
        
        if not backup_file.exists():
            logging.error(f"Volume backup not found: {backup_file}")
            return False
        
        try:
            # Remove existing volume
            subprocess.run(["docker", "volume", "rm", volume_name], capture_output=True)
            
            # Create new volume
            subprocess.run(["docker", "volume", "create", volume_name], capture_output=True)
            
            # Check if we're running inside a container (backup_dir is /app/backups)
            if str(self.backup_dir).startswith('/app/'):
                # Running inside container - use stdin to pipe the backup data
                logging.info(f"Restoring volume {volume_name} from container using stdin pipe")
                
                # Use cat to pipe the backup file content directly to docker run
                cmd = f"cat '{backup_file}' | docker run --rm -i -v '{volume_name}:/data' alpine tar xzf - -C /data"
                
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                
            else:
                # Running on host - use volume mount approach
                logging.info(f"Restoring volume {volume_name} from host using volume mount")
                
                cmd = [
                    "docker", "run", "--rm",
                    "-v", f"{volume_name}:/data",
                    "-v", f"{backup_file.parent}:/backup",
                    "alpine",
                    "tar", "xzf", f"/backup/{backup_file.name}", "-C", "/data"
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logging.info(f"Volume {volume_name} restored")
                return True
            else:
                logging.error(f"Failed to restore volume {volume_name}: {result.stderr}")
                return False
                
        except Exception as e:
            logging.error(f"Error restoring volume {volume_name}: {e}")
            return False
    
    def cleanup_old_backups(self):
        """Clean up old backups according to retention policy"""
        logging.info("Cleaning up old backups...")
        
        backups = self.list_backups()
        now = datetime.datetime.now()
        
        for backup in backups:
            backup_date = datetime.datetime.fromisoformat(backup['created_at'].replace('Z', '+00:00'))
            days_old = (now - backup_date).days
            
            should_delete = False
            
            if backup['type'] == 'daily':
                # Keep daily backups for retention_days
                if days_old > self.config['retention_days']:
                    # Check if it's end of month - if so, convert to monthly
                    if backup_date.day == backup_date.replace(day=28).replace(month=backup_date.month+1).replace(day=1) - datetime.timedelta(days=1).day:
                        # End of month - convert to monthly
                        self._convert_to_monthly(backup['name'])
                    else:
                        should_delete = True
                        
            elif backup['type'] == 'monthly':
                # Keep monthly backups for retention_months
                months_old = (now.year - backup_date.year) * 12 + (now.month - backup_date.month)
                if months_old > self.config['retention_months']:
                    should_delete = True
            
            # Manual backups are kept indefinitely unless specifically deleted
            
            if should_delete:
                self._delete_backup(backup['name'])
    
    def _convert_to_monthly(self, backup_name: str):
        """Convert a daily backup to monthly"""
        old_path = self.backup_dir / backup_name
        new_name = backup_name.replace('_daily', '_monthly')
        new_path = self.backup_dir / new_name
        
        try:
            old_path.rename(new_path)
            
            # Update registry
            registry_file = self.backup_dir / "registry.json"
            with open(registry_file, 'r') as f:
                registry = json.load(f)
            
            registry[new_name] = registry[backup_name]
            registry[new_name]['type'] = 'monthly'
            del registry[backup_name]
            
            with open(registry_file, 'w') as f:
                json.dump(registry, f, indent=2)
            
            logging.info(f"Converted backup to monthly: {new_name}")
            
        except Exception as e:
            logging.error(f"Error converting backup to monthly: {e}")
    
    def _delete_backup(self, backup_name: str):
        """Delete a backup"""
        backup_path = self.backup_dir / backup_name
        
        try:
            if backup_path.exists():
                shutil.rmtree(backup_path)
            
            # Remove from registry
            registry_file = self.backup_dir / "registry.json"
            if registry_file.exists():
                with open(registry_file, 'r') as f:
                    registry = json.load(f)
                
                if backup_name in registry:
                    del registry[backup_name]
                    
                    with open(registry_file, 'w') as f:
                        json.dump(registry, f, indent=2)
            
            logging.info(f"Deleted backup: {backup_name}")
            
        except Exception as e:
            logging.error(f"Error deleting backup: {e}")
    
    @staticmethod
    def _human_size(size_bytes: int) -> str:
        """Convert bytes to human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"


def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='4PLAN Everything Buddy Backup Manager')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Create backup
    backup_parser = subparsers.add_parser('create', help='Create a new backup')
    backup_parser.add_argument('description', nargs='?', default='', help='Backup description')
    backup_parser.add_argument('--type', default='manual', choices=['manual', 'daily', 'monthly'], help='Backup type')
    
    # List backups
    subparsers.add_parser('list', help='List all backups')
    
    # Restore backup
    restore_parser = subparsers.add_parser('restore', help='Restore a backup')
    restore_parser.add_argument('backup_name', help='Name of backup to restore')
    restore_parser.add_argument('--confirm', action='store_true', help='Confirm restore operation')
    
    # Cleanup
    subparsers.add_parser('cleanup', help='Clean up old backups')
    
    # Status
    subparsers.add_parser('status', help='Show backup system status')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = BackupManager()
    
    if args.command == 'create':
        success = manager.create_backup(args.description, args.type)
        sys.exit(0 if success else 1)
        
    elif args.command == 'list':
        backups = manager.list_backups()
        if not backups:
            print("No backups found")
        else:
            print(f"{'Name':<35} {'Type':<10} {'Size':<10} {'Date':<20} {'Description'}")
            print("-" * 90)
            for backup in backups:
                print(f"{backup['name']:<35} {backup['type']:<10} {backup.get('size_human', 'N/A'):<10} {backup['created_at'][:19]:<20} {backup['description']}")
    
    elif args.command == 'restore':
        success = manager.restore_backup(args.backup_name, args.confirm)
        sys.exit(0 if success else 1)
        
    elif args.command == 'cleanup':
        manager.cleanup_old_backups()
        
    elif args.command == 'status':
        backups = manager.list_backups()
        print(f"Total backups: {len(backups)}")
        daily = len([b for b in backups if b['type'] == 'daily'])
        monthly = len([b for b in backups if b['type'] == 'monthly'])  
        manual = len([b for b in backups if b['type'] == 'manual'])
        print(f"Daily: {daily}, Monthly: {monthly}, Manual: {manual}")
        
        total_size = sum(b.get('size', 0) for b in backups)
        print(f"Total size: {BackupManager._human_size(total_size)}")


if __name__ == '__main__':
    main()
