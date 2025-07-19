#!/bin/bash
# 4PLAN Everything Buddy - Backup Script (macOS/Linux)
# Cross-platform backup solution

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

# Function to setup scheduled backups
setup_schedule() {
    print_info "Setting up automated daily backups at 2:00 AM..."
    
    # Create cron job
    CRON_JOB="0 2 * * * $SCRIPT_DIR/backup.sh \"Daily automated backup\" --type=daily"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$SCRIPT_DIR/backup.sh"; then
        print_warning "Backup schedule already exists."
    else
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        print_success "Daily backup scheduled for 2:00 AM"
    fi
    
    # Create backup configuration
    if [ ! -f "backup_config.json" ]; then
        cat > backup_config.json << 'EOF'
{
  "retention_days": 7,
  "retention_months": 12,
  "backup_time": "02:00",
  "compress": true,
  "verify_integrity": true,
  "incremental": false
}
EOF
        print_success "Created backup configuration file"
    fi
    
    print_success "Backup system setup complete!"
    print_info "Next scheduled backup: Tomorrow at 2:00 AM"
    exit 0
}

# Function to show usage
usage() {
    echo "Usage: $0 [DESCRIPTION] [OPTIONS]"
    echo ""
    echo "Create a backup of the 4PLAN Everything Buddy system"
    echo ""
    echo "Arguments:"
    echo "  DESCRIPTION    Optional description for the backup"
    echo ""
    echo "Options:"
    echo "  --type=TYPE    Backup type: manual, daily, monthly (default: manual)"
    echo "  --setup        Setup automated daily backups"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 \"Before update\"                    # Manual backup with description"
    echo "  $0 \"Daily backup\" --type=daily       # Daily backup"
    echo "  $0 --setup                            # Setup automated backups"
    echo ""
}

# Parse arguments
DESCRIPTION=""
BACKUP_TYPE="manual"

while [[ $# -gt 0 ]]; do
    case $1 in
        --setup)
            setup_schedule
            ;;
        --type=*)
            BACKUP_TYPE="${1#*=}"
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
            if [ -z "$DESCRIPTION" ]; then
                DESCRIPTION="$1"
            else
                print_error "Multiple descriptions provided. Use quotes for descriptions with spaces."
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Main backup process
main() {
    print_info "4PLAN Everything Buddy - Backup System"
    print_info "Starting backup process..."
    
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
    
    # Run the Python backup manager
    if [ -n "$DESCRIPTION" ]; then
        print_info "Creating backup with description: '$DESCRIPTION'"
        python3 backup_manager.py create "$DESCRIPTION" --type="$BACKUP_TYPE"
    else
        print_info "Creating backup..."
        python3 backup_manager.py create "Backup created via backup.sh" --type="$BACKUP_TYPE"
    fi
    
    RESULT=$?
    
    if [ $RESULT -eq 0 ]; then
        print_success "Backup completed successfully!"
        
        # Show backup status
        print_info "Current backup status:"
        python3 backup_manager.py status
        
        # Run cleanup
        print_info "Running cleanup process..."
        python3 backup_manager.py cleanup
        
    else
        print_error "Backup failed! Check backup.log for details."
        exit 1
    fi
}

# Run main function
main
