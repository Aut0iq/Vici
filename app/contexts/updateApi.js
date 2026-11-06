import React from 'react'

export const UpdateApiContext = React.createContext()
export const SetUpdateApiContext = React.createContext()

export const useUpdateApi = () => React.useContext(UpdateApiContext)
export const useSetUpdateApi = () => React.useContext(SetUpdateApiContext)

const queryKey = (query) => {
	if (!query) return ''
	if (typeof query === 'string') return query
	return Object.keys(query).sort().map((key) => `${key}=${encodeURIComponent(query[key])}`).join('&')
}

export const isUpdatable = (updateApi, path, query) => {
	if (updateApi.path !== path) return false
	if (!updateApi.query && !query) return true
	if (queryKey(updateApi.query) === queryKey(query)) return true
	return false
}

export const UpdateApiProvider = ({ children }) => {
	const [updateApi, setUpdateApi] = React.useState({ path: null, query: null })

	return (
		<UpdateApiContext.Provider value={updateApi}>
			<SetUpdateApiContext.Provider value={setUpdateApi}>
				{children}
			</SetUpdateApiContext.Provider>
		</UpdateApiContext.Provider>
	)
}