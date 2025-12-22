#!/bin/bash

# 1. Проверка на наличие изменений
if [[ -n $(git status -s) ]]; then
  echo "⚠️  Есть незакоммиченные изменения. Сначала закоммитьте или спрячьте их."
  exit 1
fi

# 2. Выбор типа обновления (patch, minor, major)
echo "Какое обновление выпускаем?"
select type in "patch (1.0.0 -> 1.0.1)" "minor (1.0.0 -> 1.1.0)" "major (1.0.0 -> 2.0.0)"; do
    case $type in
        "patch (1.0.0 -> 1.0.1)") VERSION_TYPE="patch"; break;;
        "minor (1.0.0 -> 1.1.0)") VERSION_TYPE="minor"; break;;
        "major (1.0.0 -> 2.0.0)") VERSION_TYPE="major"; break;;
        *) echo "Неверный выбор";;
    esac
done

echo "🚀 Начинаем релиз [$VERSION_TYPE]..."

# 3. Поднятие версии (это меняет package.json, но не создает git tag автоматически, если git-tag-version=false, но мы оставим стандартно)
# Мы используем --no-git-tag-version, чтобы сначала собрать билд, а потом закоммитить все вместе
npm version $VERSION_TYPE --no-git-tag-version

# Читаем новую версию
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 Новая версия: v$NEW_VERSION"

# 4. Сборка библиотеки
echo "🔨 Сборка библиотеки..."
npm run build:lib

# 5. Коммит и тег
echo "floppy_disk: Коммит и создание тега..."
git add package.json package-lock.json dist/
git commit -m "chore(release): v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 6. Пуш
echo "⬆️  Отправка на GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo "✅ Релиз v$NEW_VERSION успешно опубликован!"
echo ""
echo "🌍 Ссылка для сброса кеша (Purge) на jsDelivr:"
echo "https://purge.jsdelivr.net/gh/yndmitry/jenka-3d@1/dist/lib/jenka-3d.js"
echo ""
echo "(Перейдите по ссылке, чтобы пользователи увидели обновление мгновенно)"
