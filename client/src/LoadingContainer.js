import React, { useState, useEffect } from "react";
import { getWeb, getContracts } from "./utils.js";
import App from "./App.js";

function LoadingContainer() {
    // Define the state
    const [web3, setWeb3] = useState(undefined);
    const [accounts, setAccounts] = useState([]);
    const [contracts, setContracts] = useState(undefined);

    useEffect(() => {
        // We cant use the async directly in the callback like (useEffect(async () => ))
        const init = async () => {
            // Get the data
            const web3 = await getWeb3();
            const contracts = await getContracts();
            const accounts = await web3.eth.getAccounts();
            // Save the state
            setWeb3(web3);
            setContracts(contracts);
            setAccounts(accounts);
        };
        init();
    }, []); 

    const isReady = () => {
        return (
            typeof web3 !== "undefined"
            && typeof contracts !== "undefined";
            && accounts.length > 0
        );
    }

    if (!isReady()) {
        return <div>Loading...</div>;
    }

    return (
        <App
            web3={web3}
            accounts={accounts}
            contracts={contracts}
        />
    );
}

export default LoadingContainer;