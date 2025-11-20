import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { join, extname, resolve } from 'path'
import crypto from 'crypto'
import fs from 'fs'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: DestinationCallback
  ) => {
    // Строим путь от корня проекта (process.cwd()), а не от текущего файла.
    const uploadPath = process.env.UPLOAD_PATH_TEMP
      ? join('public', process.env.UPLOAD_PATH_TEMP)
      : 'public'

    const dir = resolve(process.cwd(), uploadPath)

    // Создаем папку, если её нет. Без этого тест падает с ошибкой 500.
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    cb(null, dir)
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
    // Используем path.extname вместо split.
    // Если файл называется 'image' (без точки), extname вернет '',
    // и оригинальное имя 'image' НЕ попадет в безопасное имя файла.
    const extension = extname(file.originalname)
    const safeFilename = `${randomBytes}.${extension}`
    cb(null, safeFilename)
  },
})

// Безопасность обеспечивается переименованием (randomBytes).
const fileFilter = (
  _req: Request,
  _file: Express.Multer.File,
  cb: FileFilterCallback
) => cb(null, true)

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Лимит размера файла: 5 МБ
})
