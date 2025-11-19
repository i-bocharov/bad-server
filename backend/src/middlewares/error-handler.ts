import { ErrorRequestHandler } from 'express'

// Создаем интерфейс для наших кастомных ошибок, которые содержат statusCode.
// Это позволяет нам безопасно обращаться к err.statusCode.
interface AppError extends Error {
  statusCode?: number
}

const errorHandler: ErrorRequestHandler = (err: AppError, _req, res, _next) => {
  const statusCode = err.statusCode || 500
  const message =
    statusCode === 500 ? 'На сервере произошла ошибка' : err.message

  // eslint-disable-next-line no-console
  console.error({
    timestamp: new Date().toISOString(),
    level: 'error',
    statusCode: err.statusCode,
    message: err.message,
    stack: err.stack,
  })

  res.status(statusCode).send({ message })
}

export default errorHandler
