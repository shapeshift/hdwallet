declare module 'bs58check' {
  function encode(payload: Buffer): string;
  function decode(encoded: string): Buffer;
  export { encode, decode };
}
