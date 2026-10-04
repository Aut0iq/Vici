const fs = require('node:fs')
const path = require('node:path')
const { generateSW } = require('workbox-build')

const config = require('../workbox-config.js')

const source = path.join(__dirname, '..', 'dist')
const target = path.join(__dirname, 'web')
const SERVICE_WORKER = 'serviceWorker.js'
const LOCAL_CACHES = ['images']

if (!fs.existsSync(source)) {
	console.error('Нет папки dist. Сначала соберите веб-версию: npm run export:web')
	process.exit(1)
}

const isWorkerFile = (name) => name.startsWith(SERVICE_WORKER) || name.startsWith('workbox-')

const sync = async () => {
	fs.rmSync(target, { recursive: true, force: true })
	fs.cpSync(source, target, { recursive: true })
	fs.readdirSync(target).filter(isWorkerFile).forEach((name) => fs.rmSync(path.join(target, name)))

	const { warnings } = await generateSW({
		...config,
		globDirectory: target,
		globPatterns: [],
		swDest: path.join(target, SERVICE_WORKER),
		runtimeCaching: config.runtimeCaching.filter((route) => !LOCAL_CACHES.includes(route.options?.cacheName)),
	})
	warnings.filter((warning) => !warning.includes('globPatterns')).forEach((warning) => console.warn(warning))
	console.log(`Веб-сборка перенесена в ${path.relative(process.cwd(), target)}`)
}

sync().catch((error) => {
	console.error(error)
	process.exit(1)
})
