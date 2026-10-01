import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const CONNECT_ATTEMPTS = 50
const CONNECT_DELAY = 100

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class Mpv extends EventEmitter {
	constructor(volume) {
		super()
		this.volume = volume
		this.socketPath = path.join(os.tmpdir(), `vici-tui-${process.pid}.sock`)
		this.socket = null
		this.process = null
		this.buffer = ''
	}

	async start() {
		this.process = spawn('mpv', [
			'--idle=yes',
			'--no-video',
			'--no-terminal',
			'--audio-display=no',
			'--force-window=no',
			`--volume=${this.volume}`,
			`--input-ipc-server=${this.socketPath}`,
		], { stdio: 'ignore' })

		await new Promise((resolve, reject) => {
			this.process.once('error', reject)
			this.process.once('spawn', resolve)
		})
		this.process.on('exit', () => this.emit('exit'))

		await this.connect()
		this.command('observe_property', 1, 'time-pos')
		this.command('observe_property', 2, 'duration')
		this.command('observe_property', 3, 'pause')
	}

	async connect() {
		for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {
			if (fs.existsSync(this.socketPath)) {
				const socket = await new Promise((resolve) => {
					const candidate = net.connect(this.socketPath)
					candidate.once('connect', () => resolve(candidate))
					candidate.once('error', () => resolve(null))
				})
				if (socket) {
					this.socket = socket
					socket.setEncoding('utf8')
					socket.on('data', (chunk) => this.read(chunk))
					socket.on('error', () => { })
					return
				}
			}
			await wait(CONNECT_DELAY)
		}
		throw new Error('mpv did not open its control socket')
	}

	read(chunk) {
		this.buffer += chunk
		const lines = this.buffer.split('\n')
		this.buffer = lines.pop()
		for (const line of lines) {
			if (!line.trim()) continue
			let message = null
			try {
				message = JSON.parse(line)
			} catch {
				continue
			}
			if (message.event === 'property-change') this.emit(message.name, message.data)
			else if (message.event === 'end-file') this.emit('ended', message.reason)
		}
	}

	command(...args) {
		if (!this.socket || this.socket.destroyed) return
		this.socket.write(`${JSON.stringify({ command: args })}\n`)
	}

	load(url) {
		this.command('loadfile', url, 'replace')
		this.command('set_property', 'pause', false)
	}

	setPause(value) {
		this.command('set_property', 'pause', value)
	}

	seek(seconds) {
		this.command('seek', seconds, 'relative')
	}

	setVolume(value) {
		this.volume = value
		this.command('set_property', 'volume', value)
	}

	stop() {
		this.command('stop')
	}

	quit() {
		this.command('quit')
		this.socket?.destroy()
		if (this.process && this.process.exitCode === null) this.process.kill()
		fs.rmSync(this.socketPath, { force: true })
	}
}
