#!/bin/bash

# 1. Проверка на наличие изменений
if [[ -n $(git status -s) ]]; then
  echo "⚠️  Есть незакоммиченные изменения. Сначала закоммитьте или спрячьте их."
  exit 1
fi

# 2. Выбор типа обновления
echo "Какое обновление выпускаем?"
select type in "patch (1.0.0 -> 1.0.1)" "minor (1.0.0 -> 1.1.0)" "major (1.0.0 -> 2.0.0)"; do
    case $type in
        "patch") VERSION_TYPE="patch"; break;;
        "minor") VERSION_TYPE="minor"; break;;
        "major") VERSION_TYPE="major"; break;;
        *) echo "Неверный выбор";;
    esac
done

echo "🚀 Начинаем релиз [$VERSION_TYPE]..."

# 3. Поднятие версии и сборка
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 Версия: v$NEW_VERSION"

echo "🔨 Сборка библиотеки..."
npm run build:lib

# 4. Коммит в основную ветку (main)
echo "💾 Коммит изменений..."
git add .
git commit -m "chore(release): v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 5. Пуш в main
echo "⬆️  Отправка исходного кода (main)..."
git push origin main --tags

# 6. Деплой в ветку release (самое важное!)
echo "🚀 Отправка сборки в ветку 'release'..."
# Эта команда берет содержимое папки dist/lib и делает его корнем ветки release
git push origin `git subtree split --prefix dist/lib main`:release --force

echo ""
echo "✅ Успешно опубликовано!"
echo ""
echo "🔗 ССЫЛКИ ДЛЯ WEBFLOW (ветка @release):"
echo "JS:  https://cdn.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.js"
echo "CSS: https://cdn.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.css"
echo ""
echo "🧹 Сброс кеша (нажмите, если не обновилось):"
echo "https://purge.jsdelivr.net/gh/yndmitry/jenka-3d@release/jenka-3d.js"