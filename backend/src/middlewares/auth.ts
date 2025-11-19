import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { ACCESS_TOKEN } from '../config'
import ForbiddenError from '../errors/forbidden-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import UserModel, { IUser, Role } from '../models/user'

const auth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Необходима авторизация')
  }

  try {
    const accessToken = authHeader.split(' ')[1]
    const payload = jwt.verify(accessToken, ACCESS_TOKEN.secret) as JwtPayload

    const user = await UserModel.findById(payload.sub, { password: 0, salt: 0 })

    if (!user) {
      return next(new ForbiddenError('Нет доступа'))
    }
    res.locals.user = user

    return next()
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Истек срок действия токена'))
    }
    return next(new UnauthorizedError('Необходима авторизация'))
  }
}

export function roleGuardMiddleware(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as IUser | undefined

    if (!user) {
      return next(new UnauthorizedError('Необходима авторизация'))
    }

    const hasAccess = roles.some((role) => user.roles.includes(role))

    if (!hasAccess) {
      return next(new ForbiddenError('Доступ запрещен'))
    }

    return next()
  }
}

export function currentUserAccessMiddleware<T extends { _id: Types.ObjectId }>(
  model: Model<T>,
  idProperty: string,
  userProperty: keyof T
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[idProperty]
    const user = res.locals.user as IUser | undefined

    if (!user) {
      return next(new UnauthorizedError('Необходима авторизация'))
    }

    if (user.roles.includes(Role.Admin)) {
      return next()
    }

    const entity = await model.findById(id)

    if (!entity) {
      return next(new NotFoundError('Не найдено'))
    }

    const userEntityId = entity[userProperty]

    if (!(userEntityId instanceof Types.ObjectId)) {
      return next(new ForbiddenError('Доступ запрещен'))
    }

    const hasAccess = user._id.equals(userEntityId)

    if (!hasAccess) {
      return next(new ForbiddenError('Доступ запрещен'))
    }

    return next()
  }
}

export default auth
