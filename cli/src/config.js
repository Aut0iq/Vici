import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const directory = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vici-tui')
const file = path.join(directory, 'config.json')

export const loadConfig = () => {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return {}
	}
}

export const saveConfig = (config) => {
	fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
	fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

export const removeConfig = () => {
	fs.rmSync(file, { force: true })
}
