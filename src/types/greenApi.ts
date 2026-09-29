export interface GreenApiCredentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

export type StateInstance =
  'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';

export interface GetStateInstanceResponse {
  stateInstance: StateInstance;
}
