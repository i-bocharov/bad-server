import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Error as MongooseError } from 'mongoose'
import bcrypt from 'bcryptjs' // Импортируем bcrypt для безопасного хэширования паролей
import { REFRESH_TOKEN } from '../config'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import User from '../models/user'
import { isMongooseDuplicateKeyError } from '../utils/error-helpers'

// POST /auth/login
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body
    const user = await User.findUserByCredentials(email, password)
    const accessToken = user.generateAccessToken()
    const refreshToken = await user.generateRefreshToken()
    res.cookie(REFRESH_TOKEN.cookie.name, refreshToken, {
      ...REFRESH_TOKEN.cookie.options,
      sameSite: 'strict',
    })
    return res.json({
      success: true,
      user,
      accessToken,
    })
  } catch (err: unknown) {
    return next(err)
  }
}

// POST /auth/register
const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body

    // Хешируем пароль перед сохранением с помощью bcrypt.
    // bcrypt добавляет "соль" и выполняет множество итераций, делая подбор пароля очень медленным.
    const hashedPassword = await bcrypt.hash(password, 10) // 10 - это "стоимость" хеширования, хороший баланс.

    const newUser = new User({ email, password: hashedPassword, name })
    await newUser.save()
    const accessToken = newUser.generateAccessToken()
    const refreshToken = await newUser.generateRefreshToken()

    res.cookie(REFRESH_TOKEN.cookie.name, refreshToken, {
      ...REFRESH_TOKEN.cookie.options,
      sameSite: 'strict',
    })
    return res.status(constants.HTTP_STATUS_CREATED).json({
      success: true,
      user: newUser,
      accessToken,
    })
  } catch (error: unknown) {
    if (error instanceof MongooseError.ValidationError) {
      return next(new BadRequestError(error.message))
    }
    // Используем type guard для безопасной проверки кода ошибки.
    if (isMongooseDuplicateKeyError(error)) {
      return next(
        new ConflictError('Пользователь с таким email уже существует')
      )
    }
    return next(error)
  }
}

// GET /auth/user
const getCurrentUser = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id
    const user = await User.findById(userId).orFail(
      () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
    )
    res.json({ user, success: true })
  } catch (error: unknown) {
    next(error)
  }
}

// GET  /auth/logout
const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cookies } = req
    const rfTkn = cookies[REFRESH_TOKEN.cookie.name]

    if (rfTkn) {
      const decoded = jwt.verify(rfTkn, REFRESH_TOKEN.secret) as JwtPayload

      // Хешируем текущий токен для поиска в базе
      const rTknHash = crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(rfTkn)
        .digest('hex')

      // Удаляем ТОЛЬКО текущий токен из массива
      await User.findByIdAndUpdate(
        decoded.sub,
        { $pull: { tokens: { token: rTknHash } } },
        { new: true }
      )
    }

    // В любом случае очищаем cookie у клиента.
    res.clearCookie(REFRESH_TOKEN.cookie.name, REFRESH_TOKEN.cookie.options)

    return res.status(200).json({ success: true, message: 'Выход выполнен' })
  } catch (error: unknown) {
    // Даже если была ошибка (например, токен невалиден), все равно очищаем cookie,
    // чтобы разорвать возможные циклы на клиенте.
    res.clearCookie(REFRESH_TOKEN.cookie.name, REFRESH_TOKEN.cookie.options)
    next(error)
  }
}

// GET  /auth/token
const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cookies } = req
    const rfTkn = cookies[REFRESH_TOKEN.cookie.name]
    if (!rfTkn) {
      throw new UnauthorizedError('Refresh токен отсутствует')
    }

    // Проверяем валидность токена (подпись, срок действия).
    const decoded = jwt.verify(rfTkn, REFRESH_TOKEN.secret) as JwtPayload
    const user = await User.findById(decoded.sub).orFail(
      () => new UnauthorizedError('Пользователь не найден')
    )

    // Проверяем, есть ли такой токен в нашей базе (не был ли он уже использован/отозван).
    const rTknHash = crypto
      .createHmac('sha256', REFRESH_TOKEN.secret)
      .update(rfTkn)
      .digest('hex')
    const tokenExists = user.tokens.some(
      (tokenObj) => tokenObj.token === rTknHash
    )
    if (!tokenExists) {
      throw new UnauthorizedError('Токен отозван или недействителен')
    }

    // Удаляем ИСПОЛЬЗОВАННЫЙ токен из базы (стратегия "одноразовых" токенов).
    user.tokens = user.tokens.filter((tokenObj) => tokenObj.token !== rTknHash)

    // Генерируем НОВУЮ пару токенов.
    const accessToken = user.generateAccessToken()
    const newRefreshToken = await user.generateRefreshToken() // Эта функция сама сохранит новый токен в базу.

    // Отправляем новый refresh-токен в httpOnly cookie.
    res.cookie(
      REFRESH_TOKEN.cookie.name,
      newRefreshToken,
      REFRESH_TOKEN.cookie.options
    )

    return res.json({
      success: true,
      user, // Возвращаем обновленные данные пользователя
      accessToken,
    })
  } catch (_error: unknown) {
    // Если на любом этапе возникла ошибка, очищаем cookie на клиенте.
    // Это критически важно, чтобы разорвать цикл на фронтенде.
    res.clearCookie(REFRESH_TOKEN.cookie.name, REFRESH_TOKEN.cookie.options)
    // Возвращаем явную ошибку, чтобы фронтенд знал, что нужно разлогинить пользователя.
    return next(
      new UnauthorizedError('Ошибка авторизации, пожалуйста, войдите снова')
    )
  }
}

const getCurrentUserRoles = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // FIX: Убрана передача req.body, которая была бессмысленной и потенциально опасной.
    // Мы просто находим пользователя по ID из `res.locals`.
    const user = await User.findById(res.locals.user._id).orFail(
      () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
    )
    res.status(200).json(user.roles)
  } catch (error: unknown) {
    next(error)
  }
}

const updateCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email } = req.body
    const updateData = { name, email }
    const updatedUser = await User.findByIdAndUpdate(
      res.locals.user._id,
      updateData,
      { new: true, runValidators: true }
    ).orFail(
      () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
    )
    res.status(200).json(updatedUser)
  } catch (error: unknown) {
    if (isMongooseDuplicateKeyError(error)) {
      return next(
        new ConflictError('Пользователь с таким email уже существует')
      )
    }
    next(error)
  }
}

export {
  getCurrentUser,
  getCurrentUserRoles,
  login,
  logout,
  refreshAccessToken,
  register,
  updateCurrentUser,
}
