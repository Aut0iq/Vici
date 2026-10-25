import { ToastAndroid } from 'react-native'

import i18n from '~/i18next/i18next'
import { getApi } from '~/utils/api'
import { getServerAliases, initCacheSong, listAddressData, moveAddressData, saveServerAliases } from '~/utils/cache'
import { resetOfflineIndex } from '~/utils/offlineLibrary'
import logger from '~/utils/logger'

const sameLibrary = async (config, ids) => {
	for (const id of ids) {
		try {
			const json = await getApi(config, 'getSong', { id })
			if (json?.song?.id !== id) return false
		} catch (error) {
			if (error?.isApiError) return false
			throw error
		}
	}
	return true
}

export const mergeAddresses = async (config, address) => {
	if (global.offlineMode || !config?.url || !config?.query) return
	const current = global.config?.folderCache
	const aliases = getServerAliases()
	if (current !== address || aliases.map[address]) return

	const data = await listAddressData()
	const checked = new Set(aliases.checked[address] || [])
	const aliased = new Set(Object.keys(aliases.map))
	const candidates = Object.entries(data)
		.filter(([name, entry]) => name !== current && entry.ids.length && !checked.has(name) && !aliased.has(name))
		.sort((a, b) => b[1].count - a[1].count)
	if (!candidates.length) return

	for (const [name, entry] of candidates) {
		let isSame = false
		try {
			isSame = await sameLibrary(config, entry.ids)
		} catch (error) {
			logger.info('Server', `Could not compare with ${name}, will try later: ${error?.message || error}`)
			return
		}
		if (global.config?.folderCache !== current) return
		if (!isSame) {
			checked.add(name)
			continue
		}
		if (data[current]?.count) await moveAddressData(current, name)
		await saveServerAliases({
			map: { ...aliases.map, [address]: name },
			checked: { ...aliases.checked, [address]: [...checked] },
		})
		global.config = { ...global.config, folderCache: name }
		await initCacheSong()
		resetOfflineIndex()
		logger.info('Server', `${address} is the same server as ${name}, using its cache and downloads (${entry.count} songs)`)
		ToastAndroid.show(`${i18n.t('Songs from another address of this server are connected')}: ${entry.count}`, ToastAndroid.LONG)
		return
	}
	await saveServerAliases({ ...aliases, checked: { ...aliases.checked, [address]: [...checked] } })
}
