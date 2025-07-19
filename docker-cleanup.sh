#!/bin/bash

# Docker Cleanup Script for 4PLAN Everything Buddy
# This script helps clean up unused Docker resources

echo "🧹 Docker Cleanup Script"
echo "=========================="

# Function to show disk usage
show_docker_usage() {
    echo "📊 Current Docker disk usage:"
    docker system df
    echo ""
}

# Function to show what will be cleaned
show_cleanup_preview() {
    echo "🔍 Preview of what will be cleaned:"
    echo ""
    echo "Unused containers:"
    docker container ls -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"
    echo ""
    echo "Dangling images (untagged):"
    docker images --filter "dangling=true" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
    echo ""
    echo "Unused images (not referenced by any container):"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -20
    echo ""
}

echo "Before cleanup:"
show_docker_usage

# Ask for confirmation
echo "⚠️  This will clean up unused Docker resources."
echo "🔧 What would you like to clean?"
echo ""
echo "1) 🧽 Basic cleanup (safe) - removes unused containers, networks, and dangling images"
echo "2) 🗑️  Aggressive cleanup - removes ALL unused images (not just dangling ones)"
echo "3) 💥 Nuclear cleanup - removes everything unused including build cache"
echo "4) 🔍 Just show preview (no changes)"
echo "5) ❌ Cancel"
echo ""
read -p "Choose option (1-5): " choice

case $choice in
    1)
        echo "🧽 Performing basic cleanup..."
        docker system prune -f
        ;;
    2)
        echo "🗑️  Performing aggressive cleanup..."
        docker system prune -a -f
        ;;
    3)
        echo "💥 Performing nuclear cleanup..."
        echo "⚠️  This will remove ALL unused containers, networks, images, and build cache!"
        read -p "Are you absolutely sure? Type 'YES' to continue: " confirm
        if [ "$confirm" = "YES" ]; then
            docker system prune -a -f --volumes
            # Also clean build cache separately
            docker builder prune -a -f
        else
            echo "❌ Cleanup cancelled"
            exit 1
        fi
        ;;
    4)
        show_cleanup_preview
        exit 0
        ;;
    5)
        echo "❌ Cleanup cancelled"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "After cleanup:"
show_docker_usage

echo ""
echo "🎯 Additional cleanup commands you can run manually:"
echo ""
echo "# Remove specific old 4PLAN images (be careful!):"
echo "docker images | grep '4plan' | grep '<none>' | awk '{print \$3}' | xargs -r docker rmi"
echo ""
echo "# Remove all stopped containers:"
echo "docker container prune -f"
echo ""
echo "# Remove unused volumes (careful - this removes data!):"
echo "docker volume prune -f"
echo ""
echo "# Remove specific images by pattern:"
echo "docker images | grep 'PATTERN' | awk '{print \$3}' | xargs -r docker rmi -f"
echo ""
echo "🔧 To prevent future buildup:"
echo "- Use 'docker system prune' regularly (weekly)"
echo "- Use multi-stage builds in Dockerfiles"
echo "- Use .dockerignore files to reduce build context"
echo "- Clean up after development work"
