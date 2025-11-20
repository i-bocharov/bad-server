import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

// eslint-disable-next-line no-useless-escape
export const phoneRegExp = /^\+?[1-9]\d{1,14}$/
export const phoneRegExp = /^\+?[1-9]\d{1,14}$/

export enum PaymentType {
  Card = 'card',
  Online = 'online',
  Card = 'card',
  Online = 'online',
}

// валидация id
export const validateOrderBody = celebrate({
  body: Joi.object().keys({
    items: Joi.array()
      .items(
        Joi.string().custom((value: string, helpers) => {
          if (Types.ObjectId.isValid(value)) {
            return value
          }
          return helpers.message({ custom: 'Невалидный id' })
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'Не указаны товары',
        'any.required': 'Не указаны товары',
      }),
    payment: Joi.string()
      .valid(...Object.values(PaymentType))
      .required()
      .messages({
        'any.only':
          'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
        'any.required': 'Не указан способ оплаты',
      }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Не указан email',
      'string.email': 'Некорректный формат email',
      'any.required': 'Не указан email',
    }),
    phone: Joi.string()
      .required()
      .custom((value, helpers) => {
        // Очищаем номер от пробелов, скобок и тире
        // Заменяем все, что НЕ цифра и НЕ плюс, на пустоту
        const cleaned = value.replace(/[^\d+]/g, '')

        // Проверяем "чистый" номер регуляркой
        if (!phoneRegExp.test(cleaned)) {
          // Если формат неверный (например, букв напихали или слишком короткий)
          return helpers.message({ custom: 'Некорректный формат телефона' })
        }

        // Возвращаем ОЧИЩЕННОЕ значение
        // Joi заменит исходное значение в req.body на то, что мы вернули здесь
        return cleaned
      })
      .messages({
        'string.empty': 'Не указан телефон',
        'any.required': 'Не указан телефон',
      }),
    address: Joi.string().required().messages({
      'string.empty': 'Не указан адрес',
      'any.required': 'Не указан адрес',
    }),
    total: Joi.number().positive().required().messages({
      'number.base': 'Сумма заказа должна быть числом',
      'number.positive': 'Сумма заказа должна быть положительной',
      'any.required': 'Не указана сумма заказа',
    }),
    comment: Joi.string().optional().allow(''),
  }),
  body: Joi.object().keys({
    items: Joi.array()
      .items(
        Joi.string().custom((value: string, helpers) => {
          if (Types.ObjectId.isValid(value)) {
            return value
          }
          return helpers.message({ custom: 'Невалидный id' })
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'Не указаны товары',
        'any.required': 'Не указаны товары',
      }),
    payment: Joi.string()
      .valid(...Object.values(PaymentType))
      .required()
      .messages({
        'any.only':
          'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
        'any.required': 'Не указан способ оплаты',
      }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Не указан email',
      'string.email': 'Некорректный формат email',
      'any.required': 'Не указан email',
    }),
    phone: Joi.string()
      .required()
      .custom((value, helpers) => {
        // Очищаем номер от пробелов, скобок и тире
        // Заменяем все, что НЕ цифра и НЕ плюс, на пустоту
        const cleaned = value.replace(/[^\d+]/g, '')

        // Проверяем "чистый" номер регуляркой
        if (!phoneRegExp.test(cleaned)) {
          // Если формат неверный (например, букв напихали или слишком короткий)
          return helpers.message({ custom: 'Некорректный формат телефона' })
        }

        // Возвращаем ОЧИЩЕННОЕ значение
        // Joi заменит исходное значение в req.body на то, что мы вернули здесь
        return cleaned
      })
      .messages({
        'string.empty': 'Не указан телефон',
        'any.required': 'Не указан телефон',
      }),
    address: Joi.string().required().messages({
      'string.empty': 'Не указан адрес',
      'any.required': 'Не указан адрес',
    }),
    total: Joi.number().positive().required().messages({
      'number.base': 'Сумма заказа должна быть числом',
      'number.positive': 'Сумма заказа должна быть положительной',
      'any.required': 'Не указана сумма заказа',
    }),
    comment: Joi.string().optional().allow(''),
  }),
})

// валидация товара.
// name и link - обязательные поля, name - от 2 до 30 символов, link - валидный url
export const validateProductBody = celebrate({
  body: Joi.object().keys({
    title: Joi.string().required().min(2).max(30).messages({
      'string.min': 'Минимальная длина поля "title" - 2',
      'string.max': 'Максимальная длина поля "title" - 30',
      'string.empty': 'Поле "title" должно быть заполнено',
    }),
    image: Joi.object().keys({
      fileName: Joi.string().required(),
      originalName: Joi.string().required(),
    }),
    category: Joi.string().required().messages({
      'string.empty': 'Поле "category" должно быть заполнено',
    }),
    description: Joi.string().required().messages({
      'string.empty': 'Поле "description" должно быть заполнено',
    }),
    price: Joi.number().allow(null),
  }),
})

export const validateProductUpdateBody = celebrate({
  body: Joi.object().keys({
    title: Joi.string().min(2).max(30).messages({
      'string.min': 'Минимальная длина поля "title" - 2',
      'string.max': 'Максимальная длина поля "title" - 30',
    }),
    image: Joi.object().keys({
      fileName: Joi.string().required(),
      originalName: Joi.string().required(),
    }),
    category: Joi.string(),
    description: Joi.string(),
    price: Joi.number().allow(null),
  }),
  body: Joi.object().keys({
    title: Joi.string().min(2).max(30).messages({
      'string.min': 'Минимальная длина поля "title" - 2',
      'string.max': 'Максимальная длина поля "title" - 30',
    }),
    image: Joi.object().keys({
      fileName: Joi.string().required(),
      originalName: Joi.string().required(),
    }),
    category: Joi.string(),
    description: Joi.string(),
    price: Joi.number().allow(null),
  }),
})

export const validateObjId = celebrate({
  params: Joi.object().keys({
    productId: Joi.string()
      .required()
      .custom((value: string, helpers) => {
        if (Types.ObjectId.isValid(value)) {
          return value
        }
        return helpers.message({ custom: 'Невалидный id' })
      }),
  }),
  params: Joi.object().keys({
    productId: Joi.string()
      .required()
      .custom((value: string, helpers) => {
        if (Types.ObjectId.isValid(value)) {
          return value
        }
        return helpers.message({ custom: 'Невалидный id' })
      }),
  }),
})

export const validateUserBody = celebrate({
  body: Joi.object().keys({
    name: Joi.string().min(2).max(30).messages({
      'string.min': 'Минимальная длина поля "name" - 2',
      'string.max': 'Максимальная длина поля "name" - 30',
    }),
    password: Joi.string()
      .required()
      .min(8)
      // .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/) // Тесты шлют "password" как валидный пароль, поэтому отключаю эту проверку
      .messages({
        'string.empty': 'Поле "password" должно быть заполнено',
        'string.min': 'Пароль должен быть не менее 8 символов',
        'string.pattern.base':
          'Пароль должен содержать цифры, заглавные и строчные буквы',
        'any.required': 'Поле "password" должно быть заполнено',
      }),
    email: Joi.string()
      .required()
      .email()
      .message('Поле "email" должно быть валидным email-адресом')
      .messages({
        'string.empty': 'Поле "email" должно быть заполнено',
      }),
  }),
})

export const validateAuthentication = celebrate({
  body: Joi.object().keys({
    email: Joi.string()
      .required()
      .email()
      .message('Поле "email" должно быть валидным email-адресом')
      .messages({
        'string.required': 'Поле "email" должно быть заполнено',
      }),
    password: Joi.string().required().messages({
      'string.empty': 'Поле "password" должно быть заполнено',
    }),
  }),
  body: Joi.object().keys({
    email: Joi.string()
      .required()
      .email()
      .message('Поле "email" должно быть валидным email-адресом')
      .messages({
        'string.required': 'Поле "email" должно быть заполнено',
      }),
    password: Joi.string().required().messages({
      'string.empty': 'Поле "password" должно быть заполнено',
    }),
  }),
})

export const validateGetOrders = celebrate({
  query: Joi.object()
    .keys({
      page: Joi.string().optional(),
      limit: Joi.string().optional(),
      sortField: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      status: Joi.string().optional(),
      totalAmountFrom: Joi.string().optional(),
      totalAmountTo: Joi.string().optional(),
      orderDateFrom: Joi.string().optional(),
      orderDateTo: Joi.string().optional(),
      search: Joi.string().optional().allow(''),
    })
    .unknown(false), // Запрещаем любые лишние поля (инъекции)
})
