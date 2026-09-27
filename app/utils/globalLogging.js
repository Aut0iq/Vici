import logger from '~/utils/logger'

const describe = (error) => {
	if (!error) return 'unknown error'
	if (typeof error === 'string') return error
	return error.stack ? `${error.message}\n${error.stack.split('\n').slice(0, 3).join('\n')}` : (error.message || String(error))
}

const installErrorHandler = () => {
	const errorUtils = global.ErrorUtils
	if (errorUtils?.setGlobalHandler) {
		const previous = errorUtils.getGlobalHandler?.()
		errorUtils.setGlobalHandler((error, isFatal) => {
			logger.error('Crash', `${isFatal ? 'Fatal' : 'Error'}: ${describe(error)}`)
			previous?.(error, isFatal)
		})
	}
	if (typeof window !== 'undefined' && window.addEventListener) {
		window.addEventListener('error', (event) => {
			logger.error('Crash', describe(event?.error || event?.message))
		})
	}
}

const installRejectionHandler = () => {
	const hermes = global.HermesInternal
	if (hermes?.enablePromiseRejectionTracker) {
		hermes.enablePromiseRejectionTracker({
			allRejections: true,
			onUnhandled: (id, error) => logger.error('Rejection', describe(error)),
			onHandled: () => { },
		})
	}
	if (typeof window !== 'undefined' && window.addEventListener) {
		window.addEventListener('unhandledrejection', (event) => {
			logger.error('Rejection', describe(event?.reason))
		})
	}
}

const installGlobalLogging = () => {
	try {
		installErrorHandler()
		installRejectionHandler()
	} catch (error) {
		logger.warn('Logger', `Global handlers not installed: ${error?.message || error}`)
	}
}

export default installGlobalLogging
