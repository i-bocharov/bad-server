import { IProduct, RequestStatus } from '@types'

export type TProductState = {
  data: IProduct[]
  status: RequestStatus
}
