// Переносит веб-сборку приложения из ../dist в desktop/web, откуда её отдаёт main.js.
// Отдельным шагом, потому что expo export всегда пишет в dist в корне проекта
const fs = require('node:fs')
const path = require('node:path')

const source = path.join(__dirname, '..', 'dist')
const target = path.join(__dirname, 'web')

if (!fs.existsSync(source)) {
	console.error('Нет папки dist. Сначала соберите веб-версию: npm run export:web')
	process.exit(1)
}

fs.rmSync(target, { recursive: true, force: true })
fs.cpSync(source, target, { recursive: true })
console.log(`Веб-сборка перенесена в ${path.relative(process.cwd(), target)}`)
