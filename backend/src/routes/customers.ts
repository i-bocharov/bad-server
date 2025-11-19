import { Router } from 'express'
import {
  deleteCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from '../controllers/customers'
import auth, { roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'

const customerRouter = Router()

// Все маршруты требуют аутентификации
customerRouter.use(auth)

// Добавляем guard. Только Admin может видеть список всех и удалять/править.
customerRouter.use(roleGuardMiddleware(Role.Admin))

customerRouter.get('/', auth, getCustomers)
customerRouter.get('/:id', auth, getCustomerById)
customerRouter.patch('/:id', auth, updateCustomer)
customerRouter.delete('/:id', auth, deleteCustomer)

export default customerRouter
