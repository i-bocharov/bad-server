import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { join } from 'path'
import crypto from 'crypto'

// Создаем кастомный класс ошибки для неверного типа файла.
class FileTypeError extends Error {
  public statusCode: number

  constructor(message: string) {
    super(message)
    this.statusCode = 400 // Bad Request
  }
}

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: DestinationCallback
  ) => {
    cb(
      null,
      join(
        __dirname,
        process.env.UPLOAD_PATH_TEMP
          ? `../public/${process.env.UPLOAD_PATH_TEMP}`
          : '../public'
      )
    )
  },

  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileNameCallback
  ) => {
    // Никогда не используй file.originalname напрямую!
    // Это позволяет злоумышленнику контролировать имя файла на сервере.
    // Вместо этого, генерируем случайное имя файла.
    const randomBytes = crypto.randomBytes(16).toString('hex')
    const extension = file.originalname.split('.').pop() || ''
    const safeFilename = `${randomBytes}.${extension}`
    cb(null, safeFilename)
  },
})

const types = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif']

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (!types.includes(file.mimetype)) {
    return cb(
      new FileTypeError(
        'Недопустимый тип файла. Разрешены только изображения (png, jpg, jpeg, gif).'
      )
    )
  }

  return cb(null, true)
}

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Лимит размера файла: 5 МБ
})
