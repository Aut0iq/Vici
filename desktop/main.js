const { app, BrowserWindow, Menu, Tray, shell, nativeImage, dialog, session, protocol } = require('electron')
const { autoUpdater } = require('electron-updater')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService')

const WEB_ROOT = path.join(__dirname, 'web')

const MIME = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
}

const SCHEME = 'vici-app'
const ORIGIN = `${SCHEME}://app`
const STORAGE_PATH = '/__storage'
const STORAGE_PAGE = '<!doctype html><title>Vici</title>'
const READ_STORAGE = 'JSON.stringify(Object.assign({}, localStorage))'
const LEGACY_PORTS = [47821, 47822, 47823]

const WEB_PREFERENCES = {
	contextIsolation: true,
	nodeIntegration: false,
	sandbox: true,
	allowRunningInsecureContent: true,
}

protocol.registerSchemesAsPrivileged([{
	scheme: SCHEME,
	privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true, stream: true },
}])

let tray = null
let window = null
let quitting = false
let updateReady = null

const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000

const resolveFile = (pathname) => {
	let file = null
	try {
		file = path.join(WEB_ROOT, decodeURIComponent(pathname))
	} catch {
		return null
	}
	if (file !== WEB_ROOT && !file.startsWith(WEB_ROOT + path.sep)) return null
	if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
		if (path.extname(file)) return null
		file = path.join(WEB_ROOT, 'index.html')
	}
	return fs.existsSync(file) ? file : null
}

const serveApp = () => {
	protocol.handle(SCHEME, async (request) => {
		const { pathname } = new URL(request.url)
		if (pathname === STORAGE_PATH) return new Response(STORAGE_PAGE, { headers: { 'Content-Type': MIME['.html'] } })
		const file = resolveFile(pathname)
		if (!file) return new Response(null, { status: 404 })
		return new Response(await fs.promises.readFile(file), {
			headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' },
		})
	})
}

const runOnPage = async (url, script) => {
	const page = new BrowserWindow({ show: false, webPreferences: WEB_PREFERENCES })
	try {
		await page.loadURL(url)
		return await page.webContents.executeJavaScript(script)
	} finally {
		page.destroy()
	}
}

const readLegacyStorage = (port) => new Promise((resolve) => {
	const server = http.createServer((request, response) => {
		response.writeHead(200, { 'Content-Type': MIME['.html'] }).end(STORAGE_PAGE)
	})
	server.once('error', () => resolve(null))
	server.listen(port, '127.0.0.1', async () => {
		const dump = await runOnPage(`http://127.0.0.1:${port}${STORAGE_PATH}`, READ_STORAGE).catch(() => null)
		server.close()
		resolve(dump)
	})
})

const migrateStorage = async () => {
	const marker = path.join(app.getPath('userData'), 'storage-migrated')
	if (fs.existsSync(marker)) return
	const target = `${ORIGIN}${STORAGE_PATH}`
	let finished = await runOnPage(target, READ_STORAGE) !== '{}'
	if (!finished) {
		for (const port of LEGACY_PORTS) {
			await session.defaultSession.clearStorageData({
				origin: `http://127.0.0.1:${port}`,
				storages: ['serviceworkers', 'cachestorage'],
			})
			const dump = await readLegacyStorage(port)
			if (dump === null) continue
			finished = true
			if (dump === '{}') continue
			await runOnPage(target, `Object.entries(JSON.parse(${JSON.stringify(dump)})).forEach(([key, value]) => localStorage.setItem(key, value))`)
			break
		}
	}
	if (!finished) return
	for (const port of LEGACY_PORTS) {
		await session.defaultSession.clearStorageData({ origin: `http://127.0.0.1:${port}` })
	}
	fs.writeFileSync(marker, app.getVersion())
}

const resetServiceWorkerOnUpdate = async () => {
	const marker = path.join(app.getPath('userData'), 'last-version')
	const previous = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : null
	if (previous === app.getVersion()) return
	await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] })
	fs.writeFileSync(marker, app.getVersion())
}

const createWindow = async (url) => {
	window = new BrowserWindow({
		width: 1180,
		height: 820,
		minWidth: 380,
		minHeight: 480,
		show: false,
		backgroundColor: '#0E0A0F',
		autoHideMenuBar: true,
		icon: path.join(__dirname, 'icon.png'),
		webPreferences: WEB_PREFERENCES,
	})

	window.once('ready-to-show', () => window.show())

	window.webContents.setWindowOpenHandler(({ url: target }) => {
		shell.openExternal(target)
		return { action: 'deny' }
	})

	window.on('close', (event) => {
		if (quitting) return
		event.preventDefault()
		window.hide()
	})

	await window.loadURL(url)
}

const showWindow = () => {
	if (!window) return
	window.show()
	window.focus()
}

const installUpdate = () => {
	quitting = true
	autoUpdater.quitAndInstall(true, true)
}

const buildTrayMenu = () => Menu.buildFromTemplate([
	{ label: 'Открыть Vici', click: showWindow },
	...(updateReady ? [{ label: `Обновить до ${updateReady} и перезапустить`, click: installUpdate }] : []),
	{ type: 'separator' },
	{
		label: 'Выход',
		click: () => {
			quitting = true
			app.quit()
		},
	},
])

const createTray = () => {
	const traySize = process.platform === 'linux' ? 22 : 16
	tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: traySize, height: traySize }))
	tray.setToolTip('Vici')
	tray.setContextMenu(buildTrayMenu())
	tray.on('click', showWindow)
}

const setupUpdates = () => {
	autoUpdater.on('update-downloaded', async (info) => {
		updateReady = info.version
		tray?.setContextMenu(buildTrayMenu())
		const { response } = await dialog.showMessageBox({
			type: 'info',
			buttons: ['Перезапустить', 'Позже'],
			defaultId: 0,
			cancelId: 1,
			title: 'Обновление Vici',
			message: `Доступна новая версия ${info.version}`,
			detail: 'Она уже скачана. Перезапустить Vici сейчас, чтобы установить? Можно и позже — через меню значка в трее.',
		})
		if (response === 0) installUpdate()
	})
	autoUpdater.on('error', (error) => console.error('Update error', error))

	const check = () => autoUpdater.checkForUpdates().catch((error) => console.error('Update check failed', error))
	check()
	setInterval(check, UPDATE_CHECK_INTERVAL)
}

const start = async () => {
	serveApp()
	createTray()
	if (app.isPackaged) setupUpdates()
	await resetServiceWorkerOnUpdate()
	await migrateStorage().catch((error) => console.error('Storage migration failed', error))
	await createWindow(`${ORIGIN}/`)
}

if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	app.on('second-instance', showWindow)

	app.whenReady().then(start).catch((error) => {
		dialog.showErrorBox('Vici', `Не удалось запустить приложение.\n\n${error?.stack || error}`)
		app.exit(1)
	})

	app.on('before-quit', () => { quitting = true })
	app.on('window-all-closed', () => { })
}
