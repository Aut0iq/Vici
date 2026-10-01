#!/usr/bin/env node
import fs from 'node:fs'

import { Api } from './api.js'
import { loadConfig, saveConfig, removeConfig } from './config.js'
import { strings as t } from './i18n.js'
import { login, demoConfig } from './login.js'
import { Mpv } from './mpv.js'
import { Player } from './player.js'
import { enter, leave, onKey, onResize } from './term.js'
import { App } from './ui.js'

const DEFAULT_VOLUME = 80

const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

const fail = (message) => {
	console.error(message)
	process.exit(1)
}

const main = async () => {
	const args = process.argv.slice(2)
	if (args.includes('--help') || args.includes('-h')) return console.log(t.usage.join('\n'))
	if (args.includes('--version') || args.includes('-v')) return console.log(version)
	if (args.includes('--logout')) {
		removeConfig()
		return console.log(t.loggedOut)
	}
	if (!process.stdin.isTTY || !process.stdout.isTTY) fail(t.notTerminal)

	let config = loadConfig()
	if (args.includes('--demo')) config = { ...config, ...demoConfig() }
	else if (!config.url || !config.query) {
		config = { ...config, ...(await login(t)) }
		saveConfig(config)
	}

	const api = new Api(config)
	try {
		await api.ping()
	} catch (error) {
		fail(`${t.connectionFailed}: ${error.message}`)
	}

	const volume = Number.isFinite(config.volume) ? config.volume : DEFAULT_VOLUME
	const mpv = new Mpv(volume)
	try {
		await mpv.start()
	} catch (error) {
		fail(error.code === 'ENOENT' ? t.mpvMissing : error.message)
	}

	const player = new Player(api, mpv, volume)
	let closed = false

	const quit = (code = 0) => {
		if (closed) return
		closed = true
		leave()
		mpv.quit()
		if (!args.includes('--demo')) saveConfig({ ...loadConfig(), volume: player.volume })
		process.exit(code)
	}

	const app = new App({
		api,
		player,
		t,
		server: `${config.username}@${config.url.replace(/^https?:\/\//, '')}`,
		onQuit: () => quit(0),
	})

	process.on('SIGINT', () => quit(0))
	process.on('SIGTERM', () => quit(0))
	process.on('SIGHUP', () => quit(0))
	process.on('uncaughtException', (error) => {
		leave()
		mpv.quit()
		console.error(error)
		process.exit(1)
	})
	mpv.on('exit', () => quit(1))

	enter()
	onKey((text, key) => app.key(text, key))
	onResize(() => app.render())
	app.render()
}

main().catch((error) => {
	leave()
	fail(error.message)
})
