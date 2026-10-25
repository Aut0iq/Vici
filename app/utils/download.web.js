import { urlStream } from '~/utils/url'
import logger from '~/utils/logger'

export const downloadSongs = async (config, songs) => {
	for (const song of songs || []) {
		await fetch(urlStream(config, song.id))
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				return response.blob()
			})
			.then((data) => {
				const link = document.createElement('a')
				link.download = `${song.artist} - ${song.title}.${song.suffix || 'mp3'}`
				link.href = URL.createObjectURL(data)
				link.click()
				setTimeout(() => URL.revokeObjectURL(link.href), 1000)
			})
			.catch((error) => logger.error('Download', error?.message || error))
	}
}

const idle = { running: false, total: 0, done: 0, saved: 0, exists: 0, failed: 0 }

export const isDownloadFolderSupported = false
export const useDownloads = () => idle
export const stopDownloads = () => { }
export const isAlbumQueued = () => false
