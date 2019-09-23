import Web3 from 'web3'

// The poortis eth address is always address[0] from web3
export const getPortisEthAddress = async (portis:any):Promise<string> => {
  const web3 = new Web3(portis.provider)
  return  (await web3.eth.getAccounts())[0]
}