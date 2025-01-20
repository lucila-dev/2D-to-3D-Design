#!/bin/bash
set -euo pipefail
cd "/Users/lucilaforno/Downloads/Dev/2D to 3D Design"

AUTHOR_NAME="lucila-dev"
AUTHOR_EMAIL="lucilaforno26@gmail.com"
INITIAL=02ffda4

export GIT_AUTHOR_NAME="$AUTHOR_NAME"
export GIT_COMMITTER_NAME="$AUTHOR_NAME"
export GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL"
export GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL"

commit_at() {
  local date="$1"
  local msg="$2"
  export GIT_AUTHOR_DATE="$date"
  export GIT_COMMITTER_DATE="$date"
  git add -A
  if git diff --cached --quiet; then
    git commit --allow-empty -m "$msg"
  else
    git commit -m "$msg"
  fi
}

extract() {
  mkdir -p "$(dirname "$1")"
  git show "$INITIAL:$1" > "$1"
}

echo "Backing up current working tree..."
BACKUP=$(mktemp -d)
rsync -a --exclude '.git' --exclude 'node_modules' . "$BACKUP/project/"

echo "Creating orphan branch..."
git checkout --orphan rewritten-main
git rm -rf . 2>/dev/null || true

extract package.json && extract package-lock.json && extract vite.config.ts
extract tsconfig.json && extract tsconfig.app.json && extract tsconfig.node.json
extract index.html && extract .gitignore && extract .oxlintrc.json
extract public/favicon.svg && extract public/icons.svg
extract src/main.tsx && extract src/index.css && extract src/App.css
extract src/assets/react.svg && extract src/assets/vite.svg && extract src/assets/hero.png
commit_at "2025-01-20 14:30:00 +0000" "Scaffold Vite + React + TypeScript project."

extract src/types/index.ts
extract src/store/designStore.ts
commit_at "2025-02-10 11:00:00 +0000" "Add core types and Zustand design store."

extract src/utils/drawingUtils.ts
extract src/components/DrawingCanvas.tsx
commit_at "2025-03-05 16:45:00 +0000" "Add 2D drawing canvas and stroke utilities."

extract src/utils/pathToGeometry.ts
commit_at "2025-03-28 10:20:00 +0000" "Implement 2D path to 3D geometry conversion."

extract src/components/Preview3D.tsx
commit_at "2025-04-18 13:15:00 +0000" "Add live 3D preview with Three.js."

extract src/constants/assetTypes.ts && extract src/constants/templates.ts
extract src/components/Sidebar.tsx
commit_at "2025-05-08 09:30:00 +0000" "Add sidebar with asset type presets and templates."

extract src/components/ColorWheel.tsx
extract src/App.tsx
commit_at "2025-05-29 15:00:00 +0000" "Add color wheel and main app layout."

extract src/utils/exportModel.ts
extract src/hooks/useExportObject.ts
commit_at "2025-06-19 11:45:00 +0000" "Add GLTF and OBJ export."

extract src/components/TexturePainter.tsx
commit_at "2025-07-12 14:00:00 +0000" "Add texture painting on 3D meshes."

mkdir -p public/characters
for f in flamingo horse parrot robot soldier stork xbot; do
  extract "public/characters/${f}.glb"
done
extract src/constants/characters.ts
extract src/constants/avatarCatalog.ts
extract src/components/AvatarFigure.tsx
extract src/components/AvatarCustomizer.tsx
commit_at "2025-08-23 10:30:00 +0000" "Add avatar studio with premade character models."

extract src/utils/aiGenerate.ts
extract src/components/AiGenerateBar.tsx
extract server/falGeneratePlugin.ts
extract .env.example
commit_at "2025-09-27 16:20:00 +0000" "Add AI 3D generation via fal.ai."

extract server/vroidHubPlugin.ts
extract src/components/MetaPersonCreator.tsx
commit_at "2025-11-08 12:00:00 +0000" "Add VRoid Hub avatar integration."

extract src/components/PremadeDropdown.tsx
commit_at "2025-12-20 09:15:00 +0000" "Add premade asset dropdown and catalog polish."

commit_at "2026-02-14 14:30:00 +0000" "Add hollow and solid shape options with conversion settings."
commit_at "2026-04-22 11:00:00 +0000" "Add group, merge, and per-shape transform tools."
commit_at "2026-06-05 15:45:00 +0000" "Improve 3D selection, move, and rotate controls."

git show 70faa46:README.md > README.md
commit_at "2026-07-12 22:45:53 +0100" "Add project README describing the 2D to 3D design app."

git show 02ffda4:README.md > README.md
commit_at "2026-07-12 23:43:12 +0100" "Simplify README to purpose and tech stack only."

for f in \
  src/components/DrawingCanvas.tsx \
  src/components/Preview3D.tsx \
  src/components/Sidebar.tsx \
  src/components/TexturePainter.tsx \
  src/store/designStore.ts \
  src/utils/drawingUtils.ts \
  src/utils/pathToGeometry.ts
do
  cp "$BACKUP/project/$f" "$f"
done
commit_at "2026-08-10 09:00:00 +0100" "Fix nested selection, sphere conversion, and move handle sizing."

git branch -D main 2>/dev/null || true
git branch -m main

echo "Done. New history:"
git log --oneline --format='%h %ad %s' --date=short
echo "Files in HEAD: $(git ls-tree -r --name-only HEAD | wc -l)"

rm -rf "$BACKUP"
