@echo off
REM Docker Cleanup Script for 4PLAN Everything Buddy (Windows)
REM This script helps clean up unused Docker resources

echo 🧹 Docker Cleanup Script
echo ==========================

:show_usage
echo 📊 Current Docker disk usage:
docker system df
echo.

echo ⚠️  This will clean up unused Docker resources.
echo 🔧 What would you like to clean?
echo.
echo 1) 🧽 Basic cleanup (safe) - removes unused containers, networks, and dangling images
echo 2) 🗑️  Aggressive cleanup - removes ALL unused images (not just dangling ones)
echo 3) 💥 Nuclear cleanup - removes everything unused including build cache
echo 4) 🔍 Just show preview (no changes)
echo 5) ❌ Cancel
echo.

set /p choice="Choose option (1-5): "

if "%choice%"=="1" goto basic_cleanup
if "%choice%"=="2" goto aggressive_cleanup
if "%choice%"=="3" goto nuclear_cleanup
if "%choice%"=="4" goto show_preview
if "%choice%"=="5" goto cancel
goto invalid_choice

:basic_cleanup
echo 🧽 Performing basic cleanup...
docker system prune -f
goto cleanup_complete

:aggressive_cleanup
echo 🗑️  Performing aggressive cleanup...
docker system prune -a -f
goto cleanup_complete

:nuclear_cleanup
echo 💥 Performing nuclear cleanup...
echo ⚠️  This will remove ALL unused containers, networks, images, and build cache!
set /p confirm="Are you absolutely sure? Type 'YES' to continue: "
if "%confirm%"=="YES" (
    docker system prune -a -f --volumes
    docker builder prune -a -f
    goto cleanup_complete
) else (
    echo ❌ Cleanup cancelled
    goto end
)

:show_preview
echo 🔍 Preview of what will be cleaned:
echo.
echo Unused containers:
docker container ls -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"
echo.
echo Dangling images (untagged):
docker images --filter "dangling=true" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo.
echo All images:
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
goto end

:cleanup_complete
echo.
echo ✅ Cleanup completed!
echo.
echo After cleanup:
docker system df
echo.
echo 🎯 Additional cleanup commands you can run manually:
echo.
echo # Remove all stopped containers:
echo docker container prune -f
echo.
echo # Remove unused volumes (careful - this removes data!):
echo docker volume prune -f
echo.
echo # Remove all dangling images:
echo docker image prune -f
echo.
echo # Remove all unused images:
echo docker image prune -a -f
echo.
echo 🔧 To prevent future buildup:
echo - Use 'docker system prune' regularly (weekly)
echo - Use multi-stage builds in Dockerfiles
echo - Use .dockerignore files to reduce build context
echo - Clean up after development work
goto end

:invalid_choice
echo ❌ Invalid option
goto end

:cancel
echo ❌ Cleanup cancelled
goto end

:end
pause
