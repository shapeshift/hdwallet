// The poortis eth address is always address[0] from web3s
export const getPortisEthAddress = async (web3:any):Promise<string> => {
  return  (await web3.eth.getAccounts())[0]
}