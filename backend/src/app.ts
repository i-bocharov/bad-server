import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import helmet from 'helmet' // Импортируем helmet для установки защитных HTTP-заголовков.
import rateLimit from 'express-rate-limit' // Импортируем express-rate-limit для защиты от брутфорс-атак и DDoS.
import { DB_ADDRESS, ORIGIN_ALLOW } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const app = express()

// Ограничиваем количество запросов с одного IP-адреса,
// защищая от брутфорс-атак на эндпоинты входа и регистрации.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // ограничение каждого IP до 100 запросов за "окно" (здесь, за 15 минут)
  standardHeaders: true, // Возвращает информацию о лимите в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключаем заголовки `X-RateLimit-*`
})

// Устанавливаем различные HTTP-заголовки (Strict-Transport-Security, X-Content-Type-Options, etc.),
// которые защищают приложение от множества известных веб-уязвимостей.
app.use(helmet())

app.use(cookieParser())

app.use(cors({ origin: ORIGIN_ALLOW, credentials: true }))

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(urlencoded({ extended: true }))
app.use(json())

app.use(limiter)

app.options('*', cors())
app.use(routes)
app.use(errors())
app.use(errorHandler)

// eslint-disable-next-line no-console
const bootstrap = async () => {
  try {
    await mongoose.connect(DB_ADDRESS)
    await app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`))
  } catch (error) {
    console.error(`Ошибка при запуске сервера:`, error)
  }
}

bootstrap()
