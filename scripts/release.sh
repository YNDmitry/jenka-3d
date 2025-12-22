#!/bin/bash

# 1. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "⚠️  There are uncommitted changes. Please commit or stash them first."
  exit 1
fi

# 2. Select update type
echo "Select update type:"
echo "1) patch"
echo "2) minor"
echo "3) major"
read -p "#? " choice

case $choice in
    1) VERSION_TYPE="patch";;
    2) VERSION_TYPE="minor";;
    3) VERSION_TYPE="major";;
    *) echo "Invalid choice"; exit 1;;
esac

echo "🚀 Starting release [$VERSION_TYPE]..."

# 3. Bump version and build
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 Version: v$NEW_VERSION"

echo "🔨 Building library..."
npm run build:lib

# 4. Commit to main
echo "💾 Committing changes..."
git add .
git commit -m "chore(release): v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 5. Push to main
echo "⬆️  Pushing source code (main)..."
git push origin main --tags

# 6. Deploy to release branch
echo "🚀 Deploying build to 'release' branch..."
# This command takes the content of dist/lib folder and makes it the root of the release branch
git push origin `git subtree split --prefix dist/lib main`:release --force

echo ""
echo "✅ Successfully published!"
echo ""
echo "🔗 WEBFLOW LINKS (@release branch):"
echo "JS:  https://cdn.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.js"
echo "CSS: https://cdn.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.css"
echo ""
echo "🧹 Purge Cache (click if not updating):"
echo "https://purge.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.js"
