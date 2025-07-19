@echo off
REM 4PLAN Everything Buddy - Restore Script (Windows)
REM Cross-platform restore solution

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

REM Function to show available backups
:list_backups
call :print_info "Available backups:"
%PYTHON_CMD% backup_manager.py list
goto :eof

REM Function to show usage
:usage
echo Usage: %0 BACKUP_NAME [OPTIONS]
echo.
echo Restore a backup of the 4PLAN Everything Buddy system
echo.
echo Arguments:
echo   BACKUP_NAME    Name of the backup to restore
echo.
echo Options:
echo   --confirm      Confirm the restore operation (required for safety)
echo   --list         List all available backups
echo   --help         Show this help message
echo.
echo Examples:
echo   %0 --list                                    # List available backups
echo   %0 backup_20250119_185322_manual --confirm  # Restore specific backup
echo.
echo WARNING: Restore will stop the application, replace all data, and restart.
echo          Make sure to create a backup before restoring if you want to preserve current data.
echo.
goto :eof

REM Function to confirm restore operation
:confirm_restore
set "BACKUP_NAME_TEMP=%~1"
call :print_warning "RESTORE CONFIRMATION REQUIRED"
echo.
call :print_warning "This operation will:"
call :print_warning "  1. Stop the 4PLAN application"
call :print_warning "  2. Replace ALL current data with backup data"
call :print_warning "  3. Restart the application"
echo.
call :print_warning "Backup to restore: !BACKUP_NAME_TEMP!"
echo.
call :print_warning "Current data will be PERMANENTLY LOST unless you have another backup!"
echo.

REM Show backup details if possible
%PYTHON_CMD% backup_manager.py list | findstr /i "!BACKUP_NAME_TEMP!" >nul 2>&1
if not errorlevel 1 (
    call :print_info "Backup details:"
    for /f "delims=" %%i in ('%PYTHON_CMD% backup_manager.py list ^| findstr /i "!BACKUP_NAME_TEMP!"') do echo %%i
    echo.
)

set /p "CONFIRMATION=Do you want to continue? Type 'yes' to confirm: "
if /i "!CONFIRMATION!"=="yes" (
    set "CONFIRMED=1"
) else (
    call :print_info "Restore cancelled by user."
    exit /b 0
)
goto :eof

REM Parse arguments
:parse_args
set "BACKUP_NAME="
set "CONFIRM=0"
set "LIST_BACKUPS=0"
set "SHOW_HELP=0"
set "CONFIRMED=0"

:parse_loop
if "%~1"=="" goto :main
if "%~1"=="--confirm" (
    set "CONFIRM=1"
    shift
    goto :parse_loop
)
if "%~1"=="--list" (
    set "LIST_BACKUPS=1"
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
REM Check if it's an unknown option
echo %~1 | findstr /r "^-" >nul
if not errorlevel 1 (
    call :print_error "Unknown option: %~1"
    call :usage
    exit /b 1
)
REM Otherwise, it's the backup name
if defined BACKUP_NAME (
    call :print_error "Multiple backup names provided."
    call :usage
    exit /b 1
)
set "BACKUP_NAME=%~1"
shift
goto :parse_loop

REM Main logic
:main
if %SHOW_HELP%==1 (
    call :usage
    exit /b 0
)

call :print_info "4PLAN Everything Buddy - Restore System"

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

REM Handle list request
if %LIST_BACKUPS%==1 (
    call :list_backups
    exit /b 0
)

REM Check if backup name was provided
if not defined BACKUP_NAME (
    call :print_error "No backup name specified."
    echo.
    call :usage
    exit /b 1
)

REM Interactive confirmation if --confirm not provided
if %CONFIRM%==0 (
    call :confirm_restore "!BACKUP_NAME!"
    if !CONFIRMED!==1 (
        set "CONFIRM=1"
    )
)

call :print_info "Starting restore process for: !BACKUP_NAME!"

REM Run the Python backup manager
if %CONFIRM%==1 (
    %PYTHON_CMD% backup_manager.py restore "!BACKUP_NAME!" --confirm
) else (
    %PYTHON_CMD% backup_manager.py restore "!BACKUP_NAME!"
)

set "RESULT=!ERRORLEVEL!"

if !RESULT! equ 0 (
    call :print_success "Restore completed successfully!"
    call :print_info "Application should be starting up now..."
    
    REM Wait a bit and check if containers are running
    timeout /t 5 /nobreak >nul
    call :print_info "Checking application status..."
    docker compose ps
    
) else (
    call :print_error "Restore failed! Check backup.log for details."
    call :print_warning "Attempting to start application anyway..."
    docker compose up -d
    exit /b 1
)

exit /b 0
