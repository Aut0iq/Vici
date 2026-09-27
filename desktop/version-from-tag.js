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
