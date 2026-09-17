import { registerRootComponent } from 'expo'

import App from './App'
import { initService } from '~/utils/player'
import { registerWidget } from '~/widget'

registerRootComponent(App)

initService()
registerWidget()