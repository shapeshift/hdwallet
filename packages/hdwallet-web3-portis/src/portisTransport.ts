import {
  Keyring,
  Transport
} from '@shapeshiftoss/hdwallet-core'
  
  export class PortisTransport extends Transport {
    public keyring: Keyring
  
    constructor (keyring: Keyring) {
      console.log('PortisTransport constructor')
      super(keyring)
    }
  
    public getDeviceID(): string {
      console.log('portisTransport getDeviceID()')
      return 'portisTransport getDeviceId()'
    }
  
    /**
      * Must emit outgoing message events and communicate with underlying interface
      */
    public call (...args: any[]): Promise<any>  {
      console.log('portisTransport call()')
      return Promise.resolve()
    }
  
    /**
      * Optional method to bootstrap connection to device
      */
    public connect(): Promise<any> {
      console.log('portisTransport connect()')
      return
    }
  
    /**
      * Optional method to bootstrap connection to device
      */ 
    public listen(): Promise<any> {
      console.log('portisTransport listen()')
      return
    }
  
    /**
      * Optional function that gets called to clean up connection to device
      */
    public disconnect(): Promise<any> {
      console.log('portisTransport disconnect()')
      return
    }
  }
  