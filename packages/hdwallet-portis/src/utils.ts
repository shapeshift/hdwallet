// The poortis eth address is always address[0] from web3

export const getEthAddress = async (web3:any):Promise<string> => {
  return (await web3.eth.getAccounts())[0]
}
