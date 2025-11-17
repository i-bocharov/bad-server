import { IUser, RequestStatus } from '@utils/types'

export type TUserState = {
  isAuthChecked: boolean
  data: IUser | null
  roles: string[]
  requestStatus: RequestStatus
  accessToken: string | null
}
