import crypto from 'node:crypto'
import readline from 'node:readline'

import { Api, buildQuery, normalizeUrl } from './api.js'

const DEMO_SALT = 'aaaaaa'

export const demoConfig = () => ({
	url: 'https://demo.navidrome.org',
	username: 'demo',
	query: `u=demo&t=${crypto.createHash('md5').update(`demo${DEMO_SALT}`).digest('hex')}&s=${DEMO_SALT}&v=1.16.1&c=vici-tui`,
})

const ask = (question) => new Promise((resolve) => {
	const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
	prompt.question(question, (answer) => {
		prompt.close()
		resolve(answer.trim())
	})
})

const askHidden = (question) => new Promise((resolve) => {
	const input = process.stdin
	let value = ''
	process.stdout.write(question)
	input.setRawMode(true)
	input.resume()
	input.setEncoding('utf8')

	const finish = () => {
		input.removeListener('data', onData)
		input.setRawMode(false)
		input.pause()
		process.stdout.write('\n')
	}

	const onData = (chunk) => {
		for (const char of chunk) {
			if (char === '\r' || char === '\n') {
				finish()
				resolve(value)
				return
			}
			if (char === '\u0003') {
				finish()
				process.exit(130)
			}
			if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
			else if (char >= ' ') value += char
		}
	}

	input.on('data', onData)
})

export const login = async (t) => {
	console.log(t.welcome)
	console.log('')
	for (;;) {
		const url = normalizeUrl(await ask(t.askUrl))
		if (!url) return demoConfig()
		const username = await ask(t.askUser)
		const password = await askHidden(t.askPassword)
		const config = { url, username, query: buildQuery(username, password) }
		console.log(t.connecting)
		try {
			await new Api(config).ping()
			return config
		} catch (error) {
			console.log(`${t.loginFailed}: ${error.message}`)
			console.log('')
		}
	}
}
