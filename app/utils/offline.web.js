export const isOfflineSupported = false

const idle = { running: false, total: 0, done: 0, failed: 0 }

export const cacheSongs = async () => 0
export const cacheAlbum = async () => 0
export const removeAlbum = async () => { }
export const stopOffline = () => { }
export const scanLibrary = async () => ({ songs: [], missing: [], bytes: 0, free: null })
export const albumStatus = () => null
export const useOffline = () => idle
