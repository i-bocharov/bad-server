import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getCurrentUser,
  getCurrentUserRoles,
  login,
  logout,
  refreshAccessToken,
  register,
  updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'

const authRouter = Router()

// Строгий лимитер для авторизации.
// 10 попыток за 15 минут с одного IP — достаточно для человека, но остановит брутфорс.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Слишком много попыток входа. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
})

authRouter.get('/user', auth, getCurrentUser)
authRouter.patch('/me', auth, updateCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)

// Применяем строгий лимит к входу и регистрации
authRouter.post('/login', authLimiter, login)
authRouter.post('/register', authLimiter, register)

authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)

export default authRouter
