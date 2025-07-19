#!/bin/bash
# 4PLAN Everything Buddy - Restore Script (macOS/Linux)
# Cross-platform restore solution

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if docker-compose.yml exists
check_compose() {
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found. Are you in the correct directory?"
        exit 1
    fi
}

# Function to show available backups
list_backups() {
    print_info "Available backups:"
    python3 backup_manager.py list
}

# Function to show usage
usage() {
    echo "Usage: $0 BACKUP_NAME [OPTIONS]"
    echo ""
    echo "Restore a backup of the 4PLAN Everything Buddy system"
    echo ""
    echo "Arguments:"
    echo "  BACKUP_NAME    Name of the backup to restore"
    echo ""
    echo "Options:"
    echo "  --confirm      Confirm the restore operation (required for safety)"
    echo "  --list         List all available backups"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list                                    # List available backups"
    echo "  $0 backup_20250119_185322_manual --confirm  # Restore specific backup"
    echo ""
    echo "⚠️  WARNING: Restore will stop the application, replace all data, and restart."
    echo "   Make sure to create a backup before restoring if you want to preserve current data."
    echo ""
}

# Function to confirm restore operation
confirm_restore() {
    local backup_name="$1"
    
    print_warning "⚠️  RESTORE CONFIRMATION REQUIRED ⚠️"
    echo ""
    print_warning "This operation will:"
    print_warning "  1. Stop the 4PLAN application"
    print_warning "  2. Replace ALL current data with backup data"
    print_warning "  3. Restart the application"
    echo ""
    print_warning "Backup to restore: $backup_name"
    echo ""
    print_warning "Current data will be PERMANENTLY LOST unless you have another backup!"
    echo ""
    
    # Show backup details if possible
    if python3 backup_manager.py list | grep -q "$backup_name"; then
        print_info "Backup details:"
        python3 backup_manager.py list | grep "$backup_name"
        echo ""
    fi
    
    read -p "Do you want to continue? Type 'yes' to confirm: " confirmation
    
    if [ "$confirmation" = "yes" ]; then
        return 0
    else
        print_info "Restore cancelled by user."
        exit 0
    fi
}

# Parse arguments
BACKUP_NAME=""
CONFIRM=false
LIST_BACKUPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --confirm)
            CONFIRM=true
            shift
            ;;
        --list)
            LIST_BACKUPS=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [ -z "$BACKUP_NAME" ]; then
                BACKUP_NAME="$1"
            else
                print_error "Multiple backup names provided."
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Main restore process
main() {
    print_info "4PLAN Everything Buddy - Restore System"
    
    # Pre-flight checks
    check_docker
    check_compose
    
    # Check if Python 3 is available
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not found. Please install Python 3."
        exit 1
    fi
    
    # Make backup_manager.py executable if needed
    chmod +x backup_manager.py
    
    # Handle list request
    if [ "$LIST_BACKUPS" = true ]; then
        list_backups
        exit 0
    fi
    
    # Check if backup name was provided
    if [ -z "$BACKUP_NAME" ]; then
        print_error "No backup name specified."
        echo ""
        usage
        exit 1
    fi
    
    # Interactive confirmation if --confirm not provided
    if [ "$CONFIRM" = false ]; then
        confirm_restore "$BACKUP_NAME"
        CONFIRM=true
    fi
    
    print_info "Starting restore process for: $BACKUP_NAME"
    
    # Run the Python backup manager
    if [ "$CONFIRM" = true ]; then
        python3 backup_manager.py restore "$BACKUP_NAME" --confirm
    else
        python3 backup_manager.py restore "$BACKUP_NAME"
    fi
    
    RESULT=$?
    
    if [ $RESULT -eq 0 ]; then
        print_success "Restore completed successfully!"
        print_info "Application should be starting up now..."
        
        # Wait a bit and check if containers are running
        sleep 5
        print_info "Checking application status..."
        docker compose ps
        
    else
        print_error "Restore failed! Check backup.log for details."
        print_warning "Attempting to start application anyway..."
        docker compose up -d
        exit 1
    fi
}

# Run main function
main
