import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Нормализуем путь, чтобы разрешить '..' и т.д.
    const requestedPath = path.normalize(req.path)

    // Создаем абсолютный путь к запрашиваемому файлу.
    const filePath = path.join(baseDir, requestedPath)

    // Проверяем, что итоговый путь все еще находится ВНУТРИ базовой директории.
    if (!filePath.startsWith(baseDir)) {
      // Попытка выхода за пределы разрешенной директории.
      return res.status(403).send('Forbidden')
    }

    // Проверяем, существует ли файл
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        // Файл не существует отдаем дальше мидлварам
        return next()
      }
      // Файл существует, отправляем его клиенту
      return res.sendFile(filePath, (sendErr) => {
        if (sendErr) {
          next(sendErr)
        }
      })
    })
  }
}
