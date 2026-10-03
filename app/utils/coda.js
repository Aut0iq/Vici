const TIMEOUT = 30000
const FINAL_STATUSES = ['done', 'partial', 'error', 'cancelled']

export const isCodaReady = (coda) => Boolean(coda?.url && coda?.token)

export const normalizeCodaUrl = (url) => {
	let value = String(url || '').trim().replace(/\/+$/, '')
	if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`
	return value
}

export const parseCodaLink = (link) => {
	const query = String(link || '').split('?')[1]
	if (!query) return null
	const params = {}
	query.split('&').forEach((part) => {
		const [key, value = ''] = part.split('=')
		try {
			params[key] = decodeURIComponent(value)
		} catch {
			params[key] = value
		}
	})
	const url = normalizeCodaUrl(params.url)
	const token = (params.token || '').trim()
	return url && token ? { url, token } : null
}

const failure = (code, message) => Object.assign(new Error(message), { code })

const request = async (coda, path, body = null) => {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT)
	let response = null
	try {
		response = await fetch(`${coda.url}${path}`, {
			method: body ? 'POST' : 'GET',
			headers: {
				Authorization: `Bearer ${coda.token}`,
				...(body ? { 'Content-Type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		})
	} catch (error) {
		throw failure('network', error?.message || 'Network error')
	} finally {
		clearTimeout(timer)
	}
	if (response.status === 401) throw failure('auth', 'Wrong token')
	if (response.status === 429) throw failure('locked', 'Too many attempts')
	if (response.status === 404) throw failure('outdated', 'Not found')
	const json = await response.json().catch(() => null)
	if (!response.ok) throw failure('server', json?.error || `HTTP ${response.status}`)
	return json
}

export const codaInfo = (coda) => request(coda, '/api/info')

export const codaFind = async (coda, query) => {
	const json = await request(coda, `/api/find?q=${encodeURIComponent(query)}`)
	return {
		tracks: (json?.tracks || []).filter((track) => !track.owned),
		albums: (json?.albums || []).filter((album) => !album.owned),
	}
}

export const codaEnqueue = (coda, target) => request(coda, '/api/enqueue', target)

export const codaJob = (coda, id) => request(coda, `/api/job/${encodeURIComponent(id)}`)

export const isCodaJobFinished = (job) => FINAL_STATUSES.includes(job?.status)
