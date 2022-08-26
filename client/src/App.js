import React, { useState, useEffect } from "react";
import Header from "./Header.js";
import Footer from "./Footer.js" ;
import Wallet from "./Wallet.js";
import NewOrder from "./NewOrder.js";
import AllOrders from "./AllOrders.js";
import MyOrders from "./MyOrders.js";
import AllTrades from "./AllTrades.js";

const SIDE = {
  BUY: 0,
  SELL: 1
}

function App({web3, accounts, contracts}) {
  const [tokens, setTokens] = useState([]);
  const [user, setUser] = useState({
    accounts: [],
    balances: {
      tokenDex: 0,
      tokenWallet: 0
    }
    selectedToken: undefined
  });
  const [orders, setOrders] = useState({
    buy: [],
    sell: []
  });
  const [trades, setTrades] = useState([]);
  const [listener, setListener] = useState(undefined))

  const getBalances = async (account, token) => {
    const tokenDex = await contracts.dex.methods
      .traderBalances(account, web3.utils.fromAscii(token.ticker))
      .call();
    const tokenWallet = await contracts[token.ticker].methods
      .balanceOf(account)
      .call();
    return {tokenDex, tokenWallet};
  }

  const getOrders = async token => {
    const orders = await Promise.all([
      contracts.dex.methods
        .getOrders(web.utils.fromAscii(token.ticker), SIDE.BUY)
        .call(),
      contracts.dex.methods
        .getOrders(web3.utils.fromAscii(token.ticker), SIDE.SELL)
        .call(),
    ]);
    return {buy: orders[0], sell: orders[1]};
  }

  const listenToTrades = token => {
    const tradeIds = new Set();
    // In case that the selected token has changed we have to reset the trades array
    setTrades([]);
    // We set an object which we want to listen to ("indexed" fields of the Event)
    // Creating a web socket connection and storing it in order to be able to kill it when 
    // the selected token changes
    const listener = contracts.dex.events.NewTrade(
      { 
        filter: {ticker: web3.utils.fromAscii(token.ticker)},
        fromBlock: 0
      }
    )
    // "Data" we set a callback function in order to add the emited trade to all the trades
    .on("data", newTrade => {
      if (tradeIds.has(newTrade.returnValues.tradeId)) {
        return;
      }
      tradeIds.add(newTrade.returnValues.tradeId);
      setTrades(trade => ([...trades, newTrade.returnValues]));
    });
    setListener(listener);
  }

  const selectToken = token => {
    setUser({...user, selectedToken: token});
  }

  const deposit = async amount => {
    await contracts[user.selectedToken].methods
      .approve(contracts.dex.options.address, amount)
      .send({from: user.accounts[0]});
    await contracts.dex.methods
      .deposit(
        amount,
        web3.utils.fromAscii(user.selectedToken.ticker)
      )
      .send({from: user.accounts[0]});
    const balances = await getBalances(
      user.accounts[0],
      user.selectedToken.ticker
    );
    setUser(user => ({...userm balances}));
  }

  const withdraw = async amount => {
    await contracts.dex.methods
      .withdraw(
        amount,
        web3.utils.fromAscii(user.selectedToken.ticker)
      )
      .send({from: user.accounts[0]});
    const balances = await getBalances(
      user.accounts[0],
      user.selectedToken.ticker
    );
    setUser(user => ({...userm balances}));
  }

  const createMarketOrder = async(amount, side) => {
    await contracts.dex.methods
      .createMarketOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount, 
        side
      )
      .send({from: user.accounts[0]});
      const orders = await getOrders(user.selectedToken);
      setOrders(orders);
  }

  const createLimitOrder = async(amount, price, side) => {
    await contracts.dex.methods
      .createLimitOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount, 
        price,
        side
      )
      .send({from: user.accounts[0]});
      const orders = await getOrders(user.selectedToken);
      setOrders(orders);
  }

  // useEffect hook - value = [] -> Initial rendering
  useEffect(() => {
    const init = async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map(token => ({
        ...token, // Pass the same object
        ticker: web.utils.hexToUtf8(token.ticker) // But changing one field
      }));
      //const balances = await getBalances(accounts[0], tokens[0]);
      //const orders = await getOrders(tokens[0]);
      const [balances, orders] = await Promise.all([
        getBalances(accounts[0], tokens[0]),
        getOrders(tokens[0])
      ]);

      listenToTrades(tokens[0]);
      setTokens(tokens);
      setUser({accounts, balances, selectedToken:tokens[0]});
      setOrders(orders);
    }
    init();
  }, []); // Empty array to get it executed at the initial rendering

  // useEffect hook - value = user.selectedToken -> When this value changes
  useEffect(() => {
    const init = async () => {
      const [balances, orders] = await Promise.all([
        getBalances(accounts[0], user.selectedToken),
        getOrders(user.selectedToken)
      ]);
      listenToTrades(user.selectedToken);
      setUser(user => ({...user, balances}));
      setOrders(orders);
    };
    if(typeof user.selectedToken !== "undefined") {
      init();
    }
  }, [user.selectedToken], () => {
    listener.unsubscribe(); // We stop the socket connection for the trades
  }) // Optional argument, callback that is executed every time this hook is executed

  if(typeof user.selectedToken === "undefined") {
    return <div>Loading...</div>;
  }

  return (
    <div id="app">
      <Header
        contracts={contracts}
        tokens={tokens}
        user={user}
        selectedToken={selectedToken}
      / >
      <main className="container-fluid">
        <div className="row">
          <div className="col-sm-4 first-col">
            <Wallet
              deposit={deposit}
              withdraw={withdraw}
              user={user}
            />
            {user.selectedToken.ticker !== "DAI" ? (
              <NewOrder
                createMarketOrder={createMarketOrder},
                createLimitOrder={createLimitOrder}
              />
            ) : null}
          </div>
          {user.selectedToken !== "DAI" ? (
            <div className="col-sm-8">
              <AllTrades
                trades={trades}
              />
              <AllOrders
                orders={orders}
              />
              <MyOrders
                orders={
                  buy: orders.buy.filter(
                    order, => order.trader.toLoweCase() === user.accounts[0].toLowerCase
                  )
                  sell: orders.sell.filter(
                    order => order.trader.toLoweCase() === user.accounts[0].toLowerCase
                  ),
                }
              />
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;