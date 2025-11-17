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
import { setAccessToken } from '@slices/user/user-slice'

// --- Начало механизма защиты от гонки состояний при обновлении токена ---

// Определяем строгий тип для элемента очереди, чтобы избежать `any`.
// `resolve` не принимает значений, он просто сигналирует о продолжении.
// `reject` принимает `unknown`, так как ошибка может быть любого типа.
type FailedRequest = {
  resolve: () => void
  reject: (reason?: unknown) => void
}

// Флаг, который показывает, что процесс обновления токена уже запущен.
let isRefreshing = false

// Типизированная очередь для "зависших" запросов.
let failedQueue: FailedRequest[] = []

// Функция, которая обрабатывает очередь после завершения обновления токена.
const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
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

  // Принудительный выход из системы при невосстановимых ошибках авторизации.
  private forceLogout() {
    setCookie('accessToken', '', { expires: new Date(0) })
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

  // Базовый метод запроса, который просто отправляет запрос с текущим токеном.
  protected async request<T>(endpoint: string, options: RequestInit) {
    // Берем токен из Redux store, а не из cookie.
    // Это делает store единственным источником правды.
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

  // Метод для вызова эндпоинта обновления токена.
  private refreshToken = () => {
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
      const error = err as { statusCode: number }
      // Если это не ошибка 401, просто пробрасываем ее дальше.
      if (error.statusCode !== 401) {
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
        this.refreshToken()
          .then((refreshData) => {
            store.dispatch(setAccessToken(refreshData.accessToken))
            processQueue(null) // Успех! "Отпускаем" все запросы из очереди.
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

  getProductItem = (id: string): Promise<IProduct> => {
    return this.request<IProduct>(`/product/${id}`, { method: 'GET' }).then(
      (data: IProduct) => ({
        ...data,
        image: {
          ...data.image,
          fileName: this.cdn + data.image.fileName,
        },
      })
    )
  }

  getProductList = (
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

  createOrder = (order: IOrder): Promise<IOrderResult> => {
    return this.requestWithRefresh<IOrderResult>('/order', {
      method: 'POST',
      body: JSON.stringify(order),
    })
  }

  updateOrderStatus = (
    status: StatusType,
    orderNumber: string
  ): Promise<IOrderResult> => {
    return this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  getAllOrders = (
    filters: Record<string, unknown> = {}
  ): Promise<IOrderPaginationResult> => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<IOrderPaginationResult>(
      `/order/all?${queryParams}`,
      {
        method: 'GET',
      }
    )
  }

  getCurrentUserOrders = (
    filters: Record<string, unknown> = {}
  ): Promise<IOrderPaginationResult> => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<IOrderPaginationResult>(
      `/order/all/me?${queryParams}`,
      {
        method: 'GET',
      }
    )
  }

  getOrderByNumber = (orderNumber: string): Promise<IOrderResult> => {
    return this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
      method: 'GET',
    })
  }

  getOrderCurrentUserByNumber = (
    orderNumber: string
  ): Promise<IOrderResult> => {
    return this.requestWithRefresh<IOrderResult>(`/order/me/${orderNumber}`, {
      method: 'GET',
    })
  }

  loginUser = (data: UserLoginBodyDto) => {
    return this.request<UserResponseToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    })
  }

  registerUser = (data: UserRegisterBodyDto) => {
    return this.request<UserResponseToken>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    })
  }

  getUser = () => {
    return this.requestWithRefresh<UserResponse>('/auth/user', {
      method: 'GET',
    })
  }

  getUserRoles = () => {
    return this.requestWithRefresh<string[]>('/auth/user/roles', {
      method: 'GET',
    })
  }

  getAllCustomers = (
    filters: Record<string, unknown> = {}
  ): Promise<ICustomerPaginationResult> => {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString()
    return this.requestWithRefresh<ICustomerPaginationResult>(
      `/customers?${queryParams}`,
      {
        method: 'GET',
      }
    )
  }

  getCustomerById = (idCustomer: string) => {
    return this.requestWithRefresh<ICustomerResult>(
      `/customers/${idCustomer}`,
      {
        method: 'GET',
      }
    )
  }

  logoutUser = () => {
    return this.request<ServerResponse<unknown>>('/auth/logout', {
      method: 'GET',
      credentials: 'include',
    })
  }

  createProduct = (data: Omit<IProduct, '_id'>) => {
    return this.requestWithRefresh<IProduct>('/product', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((data: IProduct) => ({
      ...data,
      image: {
        ...data.image,
        fileName: this.cdn + data.image.fileName,
      },
    }))
  }

  uploadFile = (data: FormData) => {
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

  updateProduct = (data: Partial<Omit<IProduct, '_id'>>, id: string) => {
    return this.requestWithRefresh<IProduct>(`/product/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }).then((data: IProduct) => ({
      ...data,
      image: {
        ...data.image,
        fileName: this.cdn + data.image.fileName,
      },
    }))
  }

  deleteProduct = (id: string) => {
    return this.requestWithRefresh<IProduct>(`/product/${id}`, {
      method: 'DELETE',
    })
  }
}

export default new WebLarekAPI(CDN_URL, API_URL)
