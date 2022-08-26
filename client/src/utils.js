import Web3 from "web3";
import Dex from "./contracts/Dex.json";
import ERC20Abi from "./ERC20Abi.json";
import detectEthereumProvider from "@metamask/detect-provider";

const getWeb3 = () => {
  return new Promise((resolve, reject) => {
    // Wait for loading completion to avoid race conditions with web3 injection timing.
    window.addEventListener("load", async () => {
      // Modern dapp browsers...
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        try {
          // Request account access if needed
          await window.ethereum.enable();
          // Acccounts now exposed
          resolve(web3);
        } catch (error) {
          reject(error);
        }
      }
      // Legacy dapp browsers...
      else if (window.web3) {
        // Use Mist/MetaMask's provider.
        const web3 = window.web3;
        console.log("Injected web3 detected.");
        resolve(web3);
      }
      // Fallback to localhost; use dev console port by default...
      else {
        const provider = new Web3.providers.HttpProvider(
          "http://localhost:9545"
        );
        const web3 = new Web3(provider);
        console.log("No web3 instance injected, using Local web3.");
        resolve(web3);
      }
    });
  });
};

// Update to Metamask
const getWeb3 = () => {
  new Promise( async (resolve, reject) => {
    let provider = await detectEthereumProvider();

    if(provider) {
      await provider.request({ method: 'eth_requestAccounts' });

      try {
        const web3 = new Web3(window.ethereum);
        resolve(web3);
      } 
      catch(error) 
      {
        reject(error);
      }

    } 
    
    reject('Install Metamask');
  })
};

const getContracts = async web3 => {
  const networkId = await web3.eth.net.getId();
  const deployedNetwork = Dex.networks[networkId];
  const dex = new web3.eth.Contract(
    Dex.abi,
    deployedNetwork && deployedNetwork.address,
  );
  const tokens = await dex.methods.getTokens().call(); // Array of token objects [{ticker, tokenAddress}, {...}, etc]
  // We need to get every token into one single object. We use the JS function, reduce
  const tokenContracts = tokens.reduce((acc, token) => ({
      ...acc, // Accumulator
      [web3.utils.hexToUtf8(token.ticket)]: new web3.eth.Contract(
          ERC20Abi,
          token.tokenAddress
      )
  }), {});
  return { dex, ...tokenContracts }; /// ... notation, to spread all the object into one
  // Example: We have objects Dex and [A, B] -> {dex, A, B}
}

return { getWeb3, getContracts };