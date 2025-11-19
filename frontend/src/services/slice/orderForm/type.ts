import { IOrder, RequestStatus } from '@types'

export type TOrderState = {
  info: IOrder
  status: RequestStatus
}
