@echo off
REM 4PLAN Everything Buddy - Backup Script (Windows)
REM Cross-platform backup solution

setlocal enabledelayedexpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Colors (using echo with special characters - limited support)
set "INFO_PREFIX=[INFO]"
set "SUCCESS_PREFIX=[SUCCESS]"
set "WARNING_PREFIX=[WARNING]"
set "ERROR_PREFIX=[ERROR]"

REM Function to print messages (simulated)
goto :parse_args

:print_info
echo %INFO_PREFIX% %~1
goto :eof

:print_success
echo %SUCCESS_PREFIX% %~1
goto :eof

:print_warning
echo %WARNING_PREFIX% %~1
goto :eof

:print_error
echo %ERROR_PREFIX% %~1
goto :eof

REM Function to check if Docker is running
:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker is not running. Please start Docker first."
    exit /b 1
)
goto :eof

REM Function to check if docker-compose.yml exists
:check_compose
if not exist "docker-compose.yml" (
    call :print_error "docker-compose.yml not found. Are you in the correct directory?"
    exit /b 1
)
goto :eof

REM Function to setup scheduled backups
:setup_schedule
call :print_info "Setting up automated daily backups at 2:00 AM..."

REM Create backup configuration if it doesn't exist
if not exist "backup_config.json" (
    (
        echo {
        echo   "retention_days": 7,
        echo   "retention_months": 12,
        echo   "backup_time": "02:00",
        echo   "compress": true,
        echo   "verify_integrity": true,
        echo   "incremental": false
        echo }
    ) > backup_config.json
    call :print_success "Created backup configuration file"
)

REM Create scheduled task
set "TASK_NAME=4PLAN_Daily_Backup"
set "TASK_COMMAND=%SCRIPT_DIR%backup.bat \"Daily automated backup\" --type=daily"

REM Check if task already exists
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if not errorlevel 1 (
    call :print_warning "Backup schedule already exists."
) else (
    REM Create the scheduled task
    schtasks /create /tn "%TASK_NAME%" /tr "\"%TASK_COMMAND%\"" /sc daily /st 02:00 /f >nul 2>&1
    if not errorlevel 1 (
        call :print_success "Daily backup scheduled for 2:00 AM"
    ) else (
        call :print_error "Failed to create scheduled task. Please run as Administrator."
        exit /b 1
    )
)

call :print_success "Backup system setup complete!"
call :print_info "Next scheduled backup: Tomorrow at 2:00 AM"
exit /b 0

REM Function to show usage
:usage
echo Usage: %0 [DESCRIPTION] [OPTIONS]
echo.
echo Create a backup of the 4PLAN Everything Buddy system
echo.
echo Arguments:
echo   DESCRIPTION    Optional description for the backup
echo.
echo Options:
echo   --type=TYPE    Backup type: manual, daily, monthly (default: manual)
echo   --setup        Setup automated daily backups
echo   --help         Show this help message
echo.
echo Examples:
echo   %0 "Before update"                    # Manual backup with description
echo   %0 "Daily backup" --type=daily       # Daily backup
echo   %0 --setup                           # Setup automated backups
echo.
goto :eof

REM Parse arguments
:parse_args
set "DESCRIPTION="
set "BACKUP_TYPE=manual"
set "SHOW_HELP=0"
set "SETUP_SCHEDULE=0"

:parse_loop
if "%~1"=="" goto :main
if "%~1"=="--setup" (
    set "SETUP_SCHEDULE=1"
    shift
    goto :parse_loop
)
if "%~1"=="--help" (
    set "SHOW_HELP=1"
    shift
    goto :parse_loop
)
if "%~1"=="-h" (
    set "SHOW_HELP=1"
    shift
    goto :parse_loop
)
if "%~1"=="--type=manual" (
    set "BACKUP_TYPE=manual"
    shift
    goto :parse_loop
)
if "%~1"=="--type=daily" (
    set "BACKUP_TYPE=daily"
    shift
    goto :parse_loop
)
if "%~1"=="--type=monthly" (
    set "BACKUP_TYPE=monthly"
    shift
    goto :parse_loop
)
if "%~1"=="--type=" (
    call :print_error "Invalid backup type. Use: manual, daily, or monthly"
    call :usage
    exit /b 1
)
REM Check if it's an option starting with --type=
echo %~1 | findstr /r "^--type=" >nul
if not errorlevel 1 (
    set "TYPE_VALUE=%~1"
    set "TYPE_VALUE=!TYPE_VALUE:--type=!"
    set "BACKUP_TYPE=!TYPE_VALUE!"
    shift
    goto :parse_loop
)
REM Check if it's an unknown option
echo %~1 | findstr /r "^-" >nul
if not errorlevel 1 (
    call :print_error "Unknown option: %~1"
    call :usage
    exit /b 1
)
REM Otherwise, it's the description
if defined DESCRIPTION (
    call :print_error "Multiple descriptions provided. Use quotes for descriptions with spaces."
    call :usage
    exit /b 1
)
set "DESCRIPTION=%~1"
shift
goto :parse_loop

REM Main logic
:main
if %SHOW_HELP%==1 (
    call :usage
    exit /b 0
)

if %SETUP_SCHEDULE%==1 (
    call :setup_schedule
    exit /b !ERRORLEVEL!
)

call :print_info "4PLAN Everything Buddy - Backup System"
call :print_info "Starting backup process..."

REM Pre-flight checks
call :check_docker
if errorlevel 1 exit /b 1

call :check_compose  
if errorlevel 1 exit /b 1

REM Check if Python 3 is available
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        call :print_error "Python 3 is required but not found. Please install Python 3."
        exit /b 1
    )
    set "PYTHON_CMD=python3"
) else (
    REM Check if it's Python 3
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do (
        set "VERSION=%%v"
        set "MAJOR_VERSION=!VERSION:~0,1!"
        if "!MAJOR_VERSION!" neq "3" (
            call :print_error "Python 3 is required. Found Python !VERSION!"
            exit /b 1
        )
    )
    set "PYTHON_CMD=python"
)

REM Run the Python backup manager
if defined DESCRIPTION (
    call :print_info "Creating backup with description: '!DESCRIPTION!'"
    %PYTHON_CMD% backup_manager.py create "!DESCRIPTION!" --type=!BACKUP_TYPE!
) else (
    call :print_info "Creating backup..."
    %PYTHON_CMD% backup_manager.py create "Backup created via backup.bat" --type=!BACKUP_TYPE!
)

set "RESULT=!ERRORLEVEL!"

if !RESULT! equ 0 (
    call :print_success "Backup completed successfully!"
    
    REM Show backup status
    call :print_info "Current backup status:"
    %PYTHON_CMD% backup_manager.py status
    
    REM Run cleanup
    call :print_info "Running cleanup process..."
    %PYTHON_CMD% backup_manager.py cleanup
) else (
    call :print_error "Backup failed! Check backup.log for details."
    exit /b 1
)

exit /b 0
