import React from "react"

import { useConfig } from "~/contexts/config"
import { getJsonCache, setJsonCache } from "~/utils/cache"
import { useUpdateApi, useSetUpdateApi, isUpdatable } from "~/contexts/updateApi"
import logger from "~/utils/logger"
import { filterOffline, offlineResponse } from "~/utils/offlineLibrary"

const isOffline = (config) => Boolean(config?.offline || global.offlineMode)

const legacyKey = (key) => key.replace(/([?&])c=vici(?=&)/, '$1c=castafiore')

const readCache = async (config, key) => {
	let json = await getJsonCache('api', key).catch(() => null)
	if (!json && legacyKey(key) !== key) json = await getJsonCache('api', legacyKey(key)).catch(() => null)
	return isOffline(config) ? filterOffline(json) : json
}

const writeCache = async (config, key, json) => {
	if (isOffline(config)) return
	await setJsonCache('api', key, json)
}

export const readApiCache = (config, path, query = '') => readCache(config, getUrl(config, path, query))

const getOffline = async (config, path, query) => {
	const local = await offlineResponse(path, query, false)
	if (local) return local
	const cached = await readCache(config, getUrl(config, path, query)).catch(() => null)
	if (cached) return cached
	const fallback = await offlineResponse(path, query, true)
	if (fallback) return fallback
	throw { message: 'Offline mode', isApiError: false, isOffline: true }
}

export const getUrl = (config, path, query = '') => {
	let encodedQuery = ''
	if (typeof query === 'string') {
		encodedQuery = query
	} else if (query === null || query === undefined) {
		encodedQuery = ''
	} else if (typeof query === 'object') {
		encodedQuery = Object.keys(query).map((key) => `${key}=${encodeURIComponent(query[key])}`).join('&')
	} else {
		logger.error('getUrl', 'query is not a string or an object')
		return ''
	}
	return `${config.url}/rest/${path}?${config.query}&f=json&${encodedQuery}`
}

export const getApi = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		if (!config?.url || !config?.query) {
			reject('getApi: config.url or config.query is not defined')
			return
		}
		if (isOffline(config)) {
			getOffline(config, path, query).then(resolve, reject)
			return
		}
		const url = getUrl(config, path, query)
		fetch(url)
			.then(res => {
				if (res.status !== 200) {
					logger.error('getApi', `/rest/${path}: HTTP ${res.status}`)
					reject({ message: `Connection failed (HTTP ${res.status})`, isApiError: false })
					return null
				} else {
					return res.json()
				}
			})
			.then(json => {
				if (!json) {
					reject({ message: 'Connection failed (no response)', isApiError: false })
					return
				}
				if (json['subsonic-response'] && !json['subsonic-response']?.error) {
					resolve(json['subsonic-response'])
				} else {
					logger.error('getApi', `/rest/${path}: ${JSON.stringify(json['subsonic-response']?.error)}`)
					reject({ ...json['subsonic-response']?.error, isApiError: true })
				}
			})
			.catch((error) => {
				logger.error('getApi', `/rest/${path}: ${error}`)
				reject({ message: error.message, error, isApiError: false })
			})
	})
}

export const getCachedAndApi = async (config, path, query = '', setData = () => { }) => {
	if (!config?.url || !config?.query) {
		logger.error('getCachedAndApi', 'config.url or config.query is not defined')
		return
	}

	let json = null
	const key = getUrl(config, path, query)
	json = await readCache(config, key).catch(() => null)
	if (json) setData(json, 'cache')
	json = await getApi(config, path, query, true)
		.then((json) => {
			setData(json, 'api')
			return json
		})
		.catch(() => { return null })
	await writeCache(config, key, json).catch((error) => logger.error('getCachedAndApi', `cache write failed: ${error?.message || error}`))
}

export const refreshApi = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		getApi(config, path, query)
			.then((json) => {
				writeCache(config, getUrl(config, path, query), json)
					.catch((error) => logger.warn('refreshApi', `cache write failed: ${error?.message || error}`))
					.then(() => resolve(json))
			})
			.catch((error) => {
				logger.error('refreshApi', `/rest/${path}: `, error)
				reject({ ...error, isApiError: false })
			})
	})
}

export const useCachedAndApi = (initialState, path, query = '', setFunc = () => { }, deps = []) => {
	const config = useConfig()
	const updateApi = useUpdateApi()
	const setUpdateApi = useSetUpdateApi()
	const [data, setData] = React.useState(initialState)
	const uid = React.useRef(Date.now())

	const refresh = React.useCallback(() => {
		if (!config?.url || !config?.query) return
		uid.current = Date.now()
		refreshApi(config, path, query)
			.then((json) => {
				setUpdateApi({ path, query, uid: uid.current })
				setFunc(json, setData)
			})
	}, [config, path, query, setFunc, setUpdateApi])

	React.useEffect(() => {
		if (!config?.url || !config?.query) return
		getCachedAndApi(config, path, query, (json, mode) => {
			setFunc(json, setData)
			if (mode === 'api') setUpdateApi({ path, query, uid: uid.current })
		})
	}, [config, ...deps])

	React.useEffect(() => {
		if (!config?.url || !config?.query) setData(initialState)
	}, [config])

	React.useEffect(() => {
		if (!config?.url || !config?.query) return
		if (!isUpdatable(updateApi, path, query)) return
		if (updateApi.uid === uid.current) return

		const key = getUrl(config, path, query)
		readCache(config, key)
			.then((json) => {
				if (json) setFunc(json, setData)
			})
	}, [updateApi])

	return [data, refresh, setData]
}

export const useCachedFirst = (initialState, path, query = '', setFunc = () => { }, deps = []) => {
	const config = useConfig()
	const updateApi = useUpdateApi()
	const [data, setData] = React.useState(initialState)

	React.useEffect(() => {
		if (!config?.url || !config?.query) return
		getApiCacheFirst(config, path, query)
			.then((json) => {
				setFunc(json, setData)
			})
	}, [config, ...deps])

	React.useEffect(() => {
		if (!config?.url || !config?.query) return
		if (!isUpdatable(updateApi, path, query)) return

		const key = getUrl(config, path, query)
		readCache(config, key)
			.then((json) => {
				if (json) setFunc(json, setData)
			})
	}, [updateApi])

	return [data, setData]
}

export const getApiCacheFirst = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		const key = getUrl(config, path, query)
		readCache(config, key)
			.then((json) => {
				if (json) return resolve(json)
				else getApi(config, path, query)
					.then((json) => {
						writeCache(config, key, json)
							.catch((error) => logger.warn('getApiCacheFirst', `cache write failed: ${error?.message || error}`))
							.then(() => {
								resolve(json)
							})
					})
					.catch((error) => reject(error))
			})
			.catch(() => {
				getApi(config, path, query)
					.then((json) => {
						writeCache(config, key, json)
							.catch((error) => logger.warn('getApiCacheFirst', `cache write failed: ${error?.message || error}`))
							.then(() => {
								resolve(json)
							})
					})
					.catch((error) => reject(error))
			})
	})
}

export const getApiNetworkFirst = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		const key = getUrl(config, path, query)
		getApi(config, path, query)
			.then((json) => {
				writeCache(config, key, json)
					.then(() => resolve(json))
					.catch((error) => {
						logger.warn('getApiNetworkFirst', `cache write failed: ${error?.message || error}`)
						resolve(json)
					})
			})
			.catch((error) => {
				readCache(config, key)
					.then((json) => {
						if (json) resolve(json)
						else reject(error)
					})
					.catch((error) => reject(error))
			})
	})
}