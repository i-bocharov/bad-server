import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { isActionPending, isActionRejected } from '@utils/redux'
import {
  checkUserAuth,
  checkUserRoles,
  loginUser,
  logoutUser,
  registerUser,
} from './thunk'
import { TUserState } from './type'
import { RequestStatus } from '@types'

const initialState: TUserState = {
  isAuthChecked: false,
  data: null,
  roles: [],
  requestStatus: RequestStatus.Idle,
  accessToken: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    authCheck: (state) => {
      state.isAuthChecked = true
    },
    // Добавляем экшен для прямого обновления accessToken.
    // Он будет использоваться механизмом обновления токена в api.ts.
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload
    },
    // Создаем экшен `logout` для полного сброса состояния пользователя.
    // Он будет вызываться при выходе из системы или при невосстановимой ошибке токена.
    logout: (state) => {
      state.data = null
      state.roles = []
      state.accessToken = null
      state.requestStatus = RequestStatus.Idle
    },
    resetUser: (state) => {
      state.data = null
      state.roles = []
      state.requestStatus = RequestStatus.Idle
      state.accessToken = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkUserAuth.fulfilled, (state, action) => {
        state.data = action.payload.user
        state.requestStatus = RequestStatus.Success
      })
      .addCase(checkUserAuth.rejected, (state) => {
        // Если проверка пользователя провалилась, очищаем все данные.
        state.data = null
        state.accessToken = null
        state.roles = []
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.data = action.payload.user
        // FIX: Сохраняем accessToken в store при успешной регистрации.
        state.accessToken = action.payload.accessToken
        state.requestStatus = RequestStatus.Success
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.data = action.payload.user
        // FIX: Сохраняем accessToken в store при успешном входе.
        state.accessToken = action.payload.accessToken
        state.requestStatus = RequestStatus.Success
      })
      .addCase(logoutUser.fulfilled, (state) => {
        // При успешном выходе на сервере, очищаем локальные данные.
        state.data = null
        state.accessToken = null
        state.roles = []
        state.requestStatus = RequestStatus.Success
      })
      .addCase(checkUserRoles.fulfilled, (state, action) => {
        state.roles = action.payload
      })
      .addMatcher(isActionPending(userSlice.name), (state) => {
        state.requestStatus = RequestStatus.Loading
      })
      .addMatcher(isActionRejected(userSlice.name), (state, action) => {
        // Не меняем статус на Failed для checkUserAuth, так как это ожидаемое поведение для гостя
        if (action.type !== checkUserAuth.rejected.type) {
          state.requestStatus = RequestStatus.Failed
        }
      })
  },
  selectors: {
    getUser: (state: TUserState) => state.data,
    getIsAuthChecked: (state: TUserState) => state.isAuthChecked,
    isAdmin: (state: TUserState) => state.roles.includes('admin'),
    getRequestStatus: (state: TUserState) => state.requestStatus,
    getAccessToken: (state: TUserState) => state.accessToken,
  },
})

// Экспортируем экшены
export const { authCheck, setAccessToken, logout, resetUser } =
  userSlice.actions
// Экспортируем селекторы
export const {
  getUser,
  getIsAuthChecked,
  isAdmin,
  getRequestStatus,
  getAccessToken,
} = userSlice.selectors
// Экспортируем редюсер
export const userReducer = userSlice.reducer
