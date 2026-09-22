const { app, BrowserWindow, Menu, Tray, shell, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

// Медиа-клавиши на клавиатуре и карточка трека в панели громкости Windows.
// Страница уже выставляет navigator.mediaSession в app/utils/player.web.js,
// Chromium внутри Electron подхватит её, если включить эти возможности
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService')

// Сюда npm run sync кладёт веб-сборку приложения
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

// Запасные порты нужны только если первый занят чем-то посторонним.
// На запасном порту настройки будут свои, но это лучше, чем не запуститься
const PORTS = [47821, 47822, 47823]

let tray = null
let window = null
let quitting = false

// Отдаём сборку по http, а не через file://: так работают fetch, история навигации
// и всё остальное, что браузер запрещает локальным файлам
const startServer = () => new Promise((resolve, reject) => {
	const server = http.createServer((request, response) => {
		let file = path.join(WEB_ROOT, decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname))
		// Наружу из папки со сборкой не выпускаем
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
	// Порт постоянный: настройки, сервер и очередь хранятся в localStorage,
	// а он привязан к адресу вместе с портом. Со случайным портом каждый запуск
	// выглядел для браузера новым сайтом, и приложение забывало подключение
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

	// Ссылки на Github и Last.fm открываем в обычном браузере, а не внутри плеера
	window.webContents.setWindowOpenHandler(({ url: target }) => {
		shell.openExternal(target)
		return { action: 'deny' }
	})

	// Крестик прячет окно в трей, музыка продолжает играть
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

const createTray = () => {
	tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }))
	tray.setToolTip('Vici')
	tray.setContextMenu(Menu.buildFromTemplate([
		{ label: 'Открыть Vici', click: showWindow },
		{ type: 'separator' },
		{
			label: 'Выход',
			click: () => {
				quitting = true
				app.quit()
			},
		},
	]))
	tray.on('click', showWindow)
}

// Второй запуск не поднимает вторую копию, а возвращает уже открытое окно
if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	app.on('second-instance', showWindow)

	app.whenReady().then(async () => {
		createTray()
		await createWindow(await startServer())
		// В распакованном виде обновляться неоткуда, проверяем только собранное приложение
		if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify()
	})

	app.on('before-quit', () => { quitting = true })
	// Окно живёт в трее, поэтому закрытие последнего окна приложение не завершает
	app.on('window-all-closed', () => { })
}
