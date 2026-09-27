import React from "react"

import { useConfig } from "~/contexts/config"
import { getJsonCache, setJsonCache } from "~/utils/cache"
import { useUpdateApi, useSetUpdateApi, isUpdatable } from "~/contexts/updateApi"
import logger from "~/utils/logger"

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
	json = await getJsonCache('api', key).catch(() => null)
	if (json) setData(json, 'cache')
	json = await getApi(config, path, query, true)
		.then((json) => {
			setData(json, 'api')
			return json
		})
		.catch(() => { return null })
	await setJsonCache('api', key, json).catch((error) => logger.error('getCachedAndApi', `cache write failed: ${error?.message || error}`))
}

export const refreshApi = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		getApi(config, path, query)
			.then((json) => {
				setJsonCache('api', getUrl(config, path, query), json)
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
		getJsonCache('api', key)
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
		getJsonCache('api', key)
			.then((json) => {
				if (json) setFunc(json, setData)
			})
	}, [updateApi])

	return [data, setData]
}

export const getApiCacheFirst = (config, path, query = '') => {
	return new Promise((resolve, reject) => {
		const key = getUrl(config, path, query)
		getJsonCache('api', key)
			.then((json) => {
				if (json) return resolve(json)
				else getApi(config, path, query)
					.then((json) => {
						setJsonCache('api', key, json)
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
						setJsonCache('api', key, json)
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
				setJsonCache('api', key, json)
					.then(() => resolve(json))
					.catch((error) => {
						logger.warn('getApiNetworkFirst', `cache write failed: ${error?.message || error}`)
						resolve(json)
					})
			})
			.catch((error) => {
				getJsonCache('api', key)
					.then((json) => {
						if (json) resolve(json)
						else reject(error)
					})
					.catch((error) => reject(error))
			})
	})
}