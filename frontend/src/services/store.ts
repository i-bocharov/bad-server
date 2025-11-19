import { configureStore } from '@reduxjs/toolkit'
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import weblarekApi from '@utils/weblarek-api'
import { rootReducer } from './rootReducer'

// Создаем конфигурацию для `redux-persist`.
const persistConfig = {
  key: 'root', // Ключ, под которым данные будут храниться в localStorage.
  storage, // Указываем, что используем localStorage.
  // (КРИТИЧЕСКИ ВАЖНО): Указываем, какие слайсы состояния нужно сохранять.
  // Мы сохраняем только 'user', так как в нем хранятся данные сессии,
  // которые должны переживать перезагрузку (информация о пользователе, токен).
  whitelist: ['user'],
}

// Оборачиваем наш `rootReducer` в `persistReducer`.
// Теперь `redux-persist` будет автоматически обрабатывать сохранение и восстановление
// для тех частей состояния, которые указаны в `whitelist`.
const persistedReducer = persistReducer(persistConfig, rootReducer)

const store = configureStore({
  // Используем `persistedReducer` вместо обычного `rootReducer`.
  reducer: persistedReducer,
  devTools: import.meta.env.MODE !== 'production',
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: {
        extraArgument: weblarekApi,
      },
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
})

export type RootState = ReturnType<typeof rootReducer>

export type AppDispatch = typeof store.dispatch

export const persistor = persistStore(store)

export default store
