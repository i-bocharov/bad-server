import store, { RootState } from '@store/store'
import { API_URL, CDN_URL } from '@constants'
import {
  ICustomerPaginationResult,
  ICustomerResult,
  IFile,
  IOrder,
  IOrderPaginationResult,
  IOrderResult,
  IProduct,
  IProductPaginationResult,
  ServerResponse,
  StatusType,
  UserLoginBodyDto,
  UserRegisterBodyDto,
  UserResponse,
  UserResponseToken,
} from '@types'
import { setCookie } from './cookie'
import { setAccessToken, logout } from '@slices/user/user-slice'

// --- Начало механизма защиты от гонки состояний при обновлении токена ---

// Определяем строгий тип для элемента очереди, чтобы избежать `any`.
// `resolve` не принимает значений, он просто сигналирует о продолжении.
// `reject` принимает `unknown`, так как ошибка может быть любого типа.
type FailedRequest = {
  resolve: () => void
  reject: (reason?: unknown) => void
}

// Флаг, который не позволяет нескольким запросам одновременно инициировать обновление.
let isRefreshing = false

// Очередь для запросов, которые "ждут" завершения обновления токена.
let failedQueue: FailedRequest[] = []

// Функция, которая обрабатывает очередь после завершения обновления токена.
const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve()))
  failedQueue = []
}

// --- Конец механизма защиты ---

class Api {
  private readonly baseUrl: string
  protected options: RequestInit

  constructor(baseUrl: string, options: RequestInit = {}) {
    this.baseUrl = baseUrl
    this.options = {
      headers: {
        'Content-Type': 'application/json',
        ...((options.headers as object) ?? {}),
      },
    }
  }

  // Принудительный выход из системы. Разрывает любой цикл.
  private forceLogout() {
    store.dispatch(logout()) // Очищаем состояние Redux
    setCookie('refreshToken', '', { expires: new Date(0) })
    window.location.replace('/login')
  }

  protected handleResponse<T>(response: Response): Promise<T> {
    return response.ok
      ? response.json()
      : response
          .json()
          .then((err) =>
            Promise.reject({ ...err, statusCode: response.status })
          )
  }

  // Базовый метод, который просто отправляет запрос с токеном из Redux.
  protected async request<T>(endpoint: string, options: RequestInit) {
    const accessToken = (store.getState() as RootState).user.accessToken
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...this.options,
      ...options,
      headers: {
        ...this.options.headers,
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return this.handleResponse<T>(res)
  }

  // Метод, который вызывает эндпоинт обновления токена.
  private refreshTokenRequest = () => {
    return fetch(`${this.baseUrl}/auth/token`, {
      method: 'GET',
      credentials: 'include', // Заставляет браузер отправить httpOnly refreshToken.
    }).then(this.handleResponse<UserResponseToken>)
  }

  // "Умный" метод для запросов, требующих авторизации.
  protected requestWithRefresh = async <T>(
    endpoint: string,
    options: RequestInit
  ): Promise<T> => {
    try {
      return await this.request<T>(endpoint, options)
    } catch (err: unknown) {
      const error = err as { statusCode: number; message?: string }

      // Если это не ошибка 401 или это ошибка "Необходима авторизация" (нет токена), просто пробрасываем.
      if (
        error.statusCode !== 401 ||
        endpoint === '/auth/login' ||
        endpoint === '/auth/register'
      ) {
        throw err
      }

      // Если другой запрос уже обновляет токен, становимся в очередь и ждем.
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => this.request<T>(endpoint, options))
      }

      isRefreshing = true

      // Запускаем процесс обновления.
      return new Promise<T>((resolve, reject) => {
        this.refreshTokenRequest()
          .then((refreshData) => {
            store.dispatch(setAccessToken(refreshData.accessToken)) // Обновляем токен в Redux.
            processQueue(null) // "Отпускаем" все запросы из очереди.
            resolve(this.request<T>(endpoint, options)) // Повторяем наш оригинальный запрос.
          })
          .catch((refreshErr) => {
            processQueue(refreshErr) // Провал! Провалятся все запросы в очереди.
            this.forceLogout() // Выбрасываем пользователя на страницу логина.
            reject(refreshErr)
          })
          .finally(() => {
            isRefreshing = false // Завершаем процесс обновления.
          })
      })
    }
  }
}

export interface IWebLarekAPI {
  getProductList: (
    filters: Record<string, unknown>
  ) => Promise<IProductPaginationResult>
  getProductItem: (id: string) => Promise<IProduct>
  createOrder: (order: IOrder) => Promise<IOrderResult>
}

export class WebLarekAPI extends Api implements IWebLarekAPI {
  readonly cdn: string

  constructor(cdn: string, baseUrl: string, options?: RequestInit) {
    super(baseUrl, options)
    this.cdn = cdn
  }

  // --- Публичные методы API ---

  getProductItem = async (id: string) =>
    this.request<IProduct>(`/product/${id}`, { method: 'GET' }).then(
      (data: IProduct) => ({
        ...data,
        image: { ...data.image, fileName: this.cdn + data.image.fileName },
      })
    )

  getProductList = async (
    filters: Record<string, unknown> = {}
  ): Promise<IProductPaginationResult> => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()

    return this.request<IProductPaginationResult>(`/product?${queryParams}`, {
      method: 'GET',
    }).then((data) => ({
      ...data,
      items: data.items.map((item) => ({
        ...item,
        image: {
          ...item.image,
          fileName: this.cdn + item.image.fileName,
        },
      })),
    }))
  }

  createOrder = async (order: IOrder) =>
    this.requestWithRefresh<IOrderResult>('/order', {
      method: 'POST',
      body: JSON.stringify(order),
    })

  updateOrderStatus = async (status: StatusType, orderNumber: string) =>
    this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })

  getAllOrders = async (filters: Record<string, unknown> = {}) => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<IOrderPaginationResult>(
      `/order/all?${queryParams}`,
      { method: 'GET' }
    )
  }

  getCurrentUserOrders = async (filters: Record<string, unknown> = {}) => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<IOrderPaginationResult>(
      `/order/all/me?${queryParams}`,
      { method: 'GET' }
    )
  }

  getOrderByNumber = async (orderNumber: string) =>
    this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
      method: 'GET',
    })

  getOrderCurrentUserByNumber = async (orderNumber: string) =>
    this.requestWithRefresh<IOrderResult>(`/order/me/${orderNumber}`, {
      method: 'GET',
    })

  loginUser = async (data: UserLoginBodyDto) =>
    this.request<UserResponseToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    })

  registerUser = async (data: UserRegisterBodyDto) =>
    this.request<UserResponseToken>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    })

  getUser = async () =>
    this.requestWithRefresh<UserResponse>('/auth/user', { method: 'GET' })

  getUserRoles = async () =>
    this.requestWithRefresh<string[]>('/auth/user/roles', { method: 'GET' })

  getAllCustomers = async (filters: Record<string, unknown> = {}) => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<ICustomerPaginationResult>(
      `/customers?${queryParams}`,
      { method: 'GET' }
    )
  }

  getCustomerById = async (idCustomer: string) =>
    this.requestWithRefresh<ICustomerResult>(`/customers/${idCustomer}`, {
      method: 'GET',
    })

  logoutUser = async () =>
    this.request<ServerResponse<unknown>>('/auth/logout', {
      method: 'GET',
      credentials: 'include',
    })

  createProduct = async (data: Omit<IProduct, '_id'>) =>
    this.requestWithRefresh<IProduct>('/product', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((data: IProduct) => ({
      ...data,
      image: {
        ...data.image,
        fileName: this.cdn + data.image.fileName,
      },
    }))

  uploadFile = async (data: FormData) => {
    const headers = { ...this.options.headers } as Record<string, string>
    delete headers['Content-Type'] // Браузер сам установит правильный Content-Type для FormData

    return this.requestWithRefresh<IFile>('/upload', {
      method: 'POST',
      body: data,
      headers,
    }).then((data) => ({
      ...data,
      fileName: data.fileName,
    }))
  }

  updateProduct = async (data: Partial<Omit<IProduct, '_id'>>, id: string) =>
    this.requestWithRefresh<IProduct>(`/product/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((data: IProduct) => ({
      ...data,
      image: {
        ...data.image,
        fileName: this.cdn + data.image.fileName,
      },
    }))

  deleteProduct = async (id: string) =>
    this.requestWithRefresh<IProduct>(`/product/${id}`, {
      method: 'DELETE',
    })
}

export default new WebLarekAPI(CDN_URL, API_URL)
