const { app, BrowserWindow, Menu, Tray, shell, nativeImage, dialog, session } = require('electron')
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

const PORTS = [47821, 47822, 47823]

let tray = null
let window = null
let quitting = false
let updateReady = null

const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000

const startServer = () => new Promise((resolve, reject) => {
	const server = http.createServer((request, response) => {
		let file = path.join(WEB_ROOT, decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname))
		if (!file.startsWith(WEB_ROOT)) {
			response.writeHead(403).end()
			return
		}
		if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html')
		if (!fs.existsSync(file)) {
			response.writeHead(404).end()
			return
		}
		response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' })
		fs.createReadStream(file).pipe(response)
	})
	const tryListen = (index) => {
		const port = PORTS[index]
		server.once('error', (error) => {
			if (error.code === 'EADDRINUSE' && index + 1 < PORTS.length) tryListen(index + 1)
			else reject(error)
		})
		server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${port}`))
	}
	tryListen(0)
})

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
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
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

if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	app.on('second-instance', showWindow)

	app.whenReady().then(async () => {
		createTray()
		await resetServiceWorkerOnUpdate()
		await createWindow(await startServer())
		if (app.isPackaged) setupUpdates()
	})

	app.on('before-quit', () => { quitting = true })
	app.on('window-all-closed', () => { })
}
