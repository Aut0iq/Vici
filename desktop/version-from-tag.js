// Переводит версию Vici в semver для desktop/package.json.
//
// Теги проекта выглядят как 2026.09.20 или 2026.09.20.3, а electron-builder
// и автообновление понимают только semver: ведущие нули и четвёртая часть
// им не годятся. Поэтому склеиваем месяц и день в минорную часть:
// 2026.09.20 -> 2026.920.0, 2026.09.20.3 -> 2026.920.3, 2026.11.05 -> 2026.1105.0.
// Внутри года версии так и растут по возрастанию, а с нового года растёт major
const fs = require('node:fs')
const path = require('node:path')

const toSemver = (version) => {
	const [year, month, day, build = '0'] = String(version || '').split('.')
	const minor = parseInt(`${month}${String(day).padStart(2, '0')}`, 10)
	const major = parseInt(year, 10)
	const patch = parseInt(build, 10)
	if (![major, minor, patch].every(Number.isFinite)) {
		throw new Error(`Не разобрать версию: ${version}`)
	}
	return `${major}.${minor}.${patch}`
}

module.exports = { toSemver }

if (require.main === module) {
	const version = toSemver(process.argv[2])
	const file = path.join(__dirname, 'package.json')
	const data = JSON.parse(fs.readFileSync(file, 'utf8'))
	data.version = version
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
	console.log(`Версия рабочего стола: ${version}`)
}
