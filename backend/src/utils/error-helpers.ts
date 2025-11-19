// Интерфейс для ошибки Mongoose о дубликате, чтобы безопасно проверять error.code
interface MongooseDuplicateKeyError extends Error {
  code: number
}

// Функция-предикат (type guard) для проверки типа ошибки.
// Это позволяет Typescript "узнать" тип ошибки внутри условного блока.
function isMongooseDuplicateKeyError(
  error: unknown
): error is MongooseDuplicateKeyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as MongooseDuplicateKeyError).code === 11000
  )
}

export { isMongooseDuplicateKeyError }
