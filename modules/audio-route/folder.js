import { requireOptionalNativeModule } from 'expo-modules-core'

const CacheFolder = requireOptionalNativeModule('CacheFolder')

const call = (name, ...args) => {
	if (!CacheFolder) return Promise.reject(new Error('Choosing a folder is not available'))
	return CacheFolder[name](...args)
}

export const isFolderSupported = Boolean(CacheFolder)
export const isFolderGranted = (treeUri) => call('isGranted', treeUri)
export const releaseFolder = (treeUri) => call('release', treeUri)
export const prepareFolder = (treeUri, path) => call('prepare', treeUri, path)
export const listFolder = (dirUri) => call('list', dirUri)
export const storeInFolder = (sourceUri, dirUri, name) => call('store', sourceUri, dirUri, name)
export const copyToFile = (sourceUri, targetPath) => call('copyToFile', sourceUri, targetPath)
export const removeFromFolder = (uri) => call('remove', uri)
export const folderLabel = (treeUri) => call('label', treeUri)
