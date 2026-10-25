import { requireOptionalNativeModule } from 'expo-modules-core'

const Folders = requireOptionalNativeModule('Folders')

const call = (name, ...args) => {
	if (!Folders) return Promise.reject(new Error('Folders are not available'))
	return Folders[name](...args)
}

export const isFolderSupported = Boolean(Folders)
export const isFolderGranted = (treeUri) => call('isGranted', treeUri)
export const releaseFolder = (treeUri) => call('release', treeUri)
export const folderLabel = (treeUri) => call('label', treeUri)
export const findFolder = (treeUri, path) => call('find', treeUri, path)
export const prepareFolder = (treeUri, path, hidden) => call('prepare', treeUri, path, hidden)
export const storeInFolder = (sourceUri, dirUri, name) => call('store', sourceUri, dirUri, name)
export const listFolder = (dirUri) => call('list', dirUri)
export const listSubfolders = (dirUri) => call('dirs', dirUri)
export const copyToFile = (sourceUri, targetPath) => call('copyToFile', sourceUri, targetPath)
export const removeFromFolder = (uri) => call('remove', uri)
export const existingUris = (uris) => call('existing', uris)
