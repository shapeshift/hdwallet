export type RemoteCall<T extends string = string, U extends Array<any> = unknown[]> = {
  type: "call",
  method: T,
  args: U,
  port?: MessagePort,
}

export type RemoteCallResult<T = unknown> = {
  type: "return",
  payload: T
} | {
  type: "throw",
  payload: Error
}
