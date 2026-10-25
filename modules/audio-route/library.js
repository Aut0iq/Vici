import { requireOptionalNativeModule } from 'expo-modules-core'

const MusicLibrary = requireOptionalNativeModule('MusicLibrary')

export const canSaveToMusic = async () => {
	if (!MusicLibrary) return false
	try {
		return await MusicLibrary.isSupported()
	} catch {
		return false
	}
}

export const saveToMusic = (uri, folder, name, mimeType, tags = null) => {
	if (!MusicLibrary) return Promise.reject(new Error('Saving to Music is not available'))
	return MusicLibrary.save(uri, folder, name, mimeType, tags)
}

export const saveToFolder = (treeUri, folders, name, mimeType, uri, tags = null) => {
	if (!MusicLibrary) return Promise.reject(new Error('Saving to a folder is not available'))
	return MusicLibrary.saveToFolder(treeUri, folders, name, mimeType, uri, tags)
}
