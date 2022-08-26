const { expectRevert } = require("@openzeppelin/test-helpers");

// First we deploy mock ERC20 tokens
const Dai = artifacts.require("mocks/Dai.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Dex = artifacts.require("Dex.sol");

const SIDE = {
    BUY: 0,
    SELL: 1
}

contract("Dex", (accounts) => {
    let dai, bat, rep, zrx, dex;
    const [trader1, trader2] = [accounts[1], accounts[2]]; // accounts[0] == admin
    // Getting the bytes32 representation of the token tickers
    const [DAI, BAT, REP, ZRX] = ["DAI", "BAT", "REP", "ZRX"]
        .map(ticker => web3.utils.fromAscii(ticker));
    
    beforeEach(async () => {
        // We instantiate our ERC20 tokens
        ([dai, bat, rep, zrx ] = await Promise.all([
            Dai.new(),
            Bat.new(),
            Rep.new(),
            Zrx.new()
        ]));

        dex = await Dex.new();
        // Configure the ERC20 token in the Dex
        // Using Promise because it's the same function for all of them
        await Promise.all([
            dex.addToken(DAI, dai.address),
            dex.addToken(BAT, bat.address),
            dex.addToken(REP, rep.address),
            dex.addToken(ZRX, zrx.address)
        ]);

        const amount = web3.utils.toWei("1000");
        // Define a function in order to approve the tokento an account inside the dex
        const seedTokenBalance = async (token, trader) => {
            await token.faucet(trader, amount);
            await token.approve(
                dex.address,
                amount, 
                {from: trader}
            );
        };

        // Set the inicial balances of the traders through a Promise + map of the tokens
        await Promise.all([
            [dai, bat, rep, zrx].map(
                token => seedTokenBalance(token, trader1)
            )
        ]);
        await Promise.all([
            [dai, bat, rep, zrx].map(
                token => seedTokenBalance(token, trader2)
            )
        ]);
    });

    describe("Deposit function", function () {
        it("Should deposit tokens", async () => {
            const amount = web3.utils.toWei("100");

            await dex.deposit( // Da error, no está aprobando correctamente el token
                amount, 
                DAI,
                {from: trader1}
            );

            // PUI Code: No se puede acceder asi?
            // const balance = await dex.traderBalances[trader1][DAI];

            // ETB Code
            const balance = await dex.traderBalances(trader1, DAI);

            assert(balance.toString() === amount);
        });
        it("Should NOT deposit tokens if token does not exist", async () => {
            const amount = web3.utils.toWei("100");

            await expectRevert(
                dex.deposit(
                    amount, 
                    web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
                    {from: trader1}
                ), 
                "This token does not exist"
            );
        });
    });
    
    describe("Withdraw function", function () {
        it("Should withdraw tokens", async () => {
            const amount = web3.utils.toWei("100");
            // PUI Code
            // const initialBalance = await dex.traderBalances(trader1, DAI);

            await dex.deposit( // Da error, no está aprobando correctamente el token
                amount, 
                DAI,
                {from: trader1}
            );
            await dex.withdraw(
                amount,
                DAI,
                {from: trader1}
            );

            // PUI Code: No tiene mucho sentido comprobar que no ha habido cambios
            // const finalBalance = await dex.traderBalances(trader1, DAI);

            // ETB Code
            const [balanceDex, balanceDai] = await Promise.all([
                dex.traderBalances(trader1, DAI),
                dex.balanceOf(trader1)
            ]);

            assert(balanceDex.isZero());
            assert(balanceDai.toString() === web3.utils.toWei("1000"));
        });
        it("Should NOT withdraw tokens if token does not exist", async () => {
            const amount = web3.utils.toWei("100");

            await expectRevert(
                await dex.withdraw(
                    amount,
                    web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
                    {from: trader1}
                ),
                "This token does not exist"
            );
        });
        it("Should NOT withdraw tokens if token balance is too low", async () => {
            const amount = web3.utils.toWei("100");
            const amountTooBig = web3.utils.toWei("1000");

            await dex.deposit(
                amount, 
                DAI,
                {from: trader1}
            );

            await expectRevert(
                await dex.withdraw(
                    amountTooBig, 
                    DAI,
                    {from: trader1}
                ), 
                "Balance too low"
            );
        });
    });

    describe("CreateLimitOrder function", function () {
        it("Should create limit order", async () => {
            // Test 1: Save a limit order with the correct value
            await dex.deposit( 
                web3.utils.toWei("100"), 
                DAI,
                {from: trader1}
            );

            await dex.CreateLimitOrder(
                REP,
                web3.utils.toWei("10"),
                10,
                SIDE.BUY,
                {from: trader1}
            );

            let buyOrders = await dex.getOrders(REP, SIDE.BUY);
            let sellOrders = await dex.getOrders(REP, SIDE.SELL);

            assert(buyOrders.length === 1);
            assert(buyOrders[0].trader === trader1);
            assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64)); // The smart contract returns the ticker with 0s
            assert(buyOrders[0].price === "10");
            assert(buyOrders[0].amount === web3.utils.toWei("10"));
            assert(sellOrders.length === 0);

            // Test 2: Check if new limit order is added in the correct place (Better price)
            await dex.deposit( 
                web3.utils.toWei("200"), 
                DAI,
                {from: trader2}
            );

            await dex.CreateLimitOrder(
                REP,
                web3.utils.toWei("10"),
                11,
                SIDE.BUY,
                {from: trader2}
            );

            buyOrders = await dex.getOrders(REP, SIDE.BUY);
            sellOrders = await dex.getOrders(REP, SIDE.SELL);

            assert(buyOrders.length === 2);
            // The second limit order has better price so, should be before the first limit order
            assert(buyOrders[0].trader === trader2);
            assert(buyOrders[1].trader === trader1);
            assert(sellOrders.length === 0);

            // Test 3: Check if new limit order is added in the correct place (Worse price)
            await dex.CreateLimitOrder(
                REP,
                web3.utils.toWei("10"),
                9,
                SIDE.BUY,
                {from: trader2}
            );

            buyOrders = await dex.getOrders(REP, SIDE.BUY);
            buyOrders = await dex.getOrders(REP, SIDE.SELL);

            assert(buyOrders.length === 3);
            assert(buyOrders[0].price === "11");
            assert(buyOrders[1].price === "10");
            assert(buyOrders[2].price === "9");
            assert(sellOrders.length === 0);
        });
        it("Should NOT create limit order if token does not exist", async () => {
            await expectRevert(
                await dex.CreateLimitOrder(
                    web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
                    web3.utils.toWei("10"),
                    10,
                    SIDE.BUY,
                    {from: trader1}
                ),
                "This token does not exist"
            );
        });
        it("Shoult NOT create limit order if token is DAI", async () => {
            await expectRevert(
                await dex.CreateLimitOrder(
                    DAI,
                    web3.utils.toWei("10"),
                    10,
                    SIDE.BUY,
                    {from: trader1}
                ),
                "Cannot trade DAI"
            );
        });
        it("Should NOT create limit order if it is a SELL order & token balance is too low", async () => {
            await dex.deposit( 
                web3.utils.toWei("200"), 
                REP,
                {from: trader1}
            );

            await expectRevert(
                await dex.CreateLimitOrder(
                    REP,
                    web.utils.toWei("300"), 
                    10, 
                    SIDE.SELL,
                    {from: trader1}
                ),
                "Token balance too low"
            );
        });
        it("Should NOT create limit order if it is a BUY order & DAI balance is too low", async () => {
            await dex.deposit( 
                web3.utils.toWei("200"), 
                DAI,
                {from: trader1}
            );

            await expectRevert(
                await dex.CreateLimitOrder(
                    REP,
                    web.utils.toWei("30"), 
                    10, 
                    SIDE.BUY,
                    {from: trader1}
                ),
                "DAI balance too low"
            );
        });
    });
    
    describe("CreateMarketOrder function", function () {
        it("Should create market order & match against existing limit order", async () => {
            // Prepare trader1 (buyer)
            await dex.deposit(
                web3.utils.toWei("100"),
                DAI,
                {from: trader1}
            );

            await des.createLimitOrder(
                REP,
                web.utils.toWei("10"),
                10,
                SIDE.BUY,
                {from: trade1}
            );

            // Prepare trader2 (seller)
            await dex.deposit(
                web3.utils.toWei("100"),
                REP,
                {from: trader2}
            );
            await dex.createMarketOrder(
                REP,
                web3.utils.toWei("5"),
                SIDE.SELL,
                {from: trader2}
            );

            // Check if the market order and the limit order matched
            const trader1DAIBalance = await dex.traderBalances(trader1, DAI);
            const trader1REPBalance = await dex.traderBalances(trader1, REP);
            const trader2DAIBalance = await dex.traderBalances(trader2, DAI);
            const trader2REPBalance = await dex.traderBalances(trader2, REP);

            // ETB Code
            const balances = await Promise.all([
                dex.traderBalances(trader1, DAI),
                dex.traderBalances(trader1, REP),
                dex.traderBalances(trader2, DAI),
                dex.traderBalances(trader2, REP)
            ]);
            const buyOrders = await dex.getOrders(REP, SIDE.BUY);

            assert(buyOrders[0].filled === web3.utils.toWei("5"));
            assert(buyOrders[0].amount === web3.utils.toWei("5"));
            assert(trader1DAIBalance.toString() === web3.utils.toWei("50"));
            assert(trader1REPBalance.toString() === web3.utils.toWei("5"));
            assert(trader2DAIBalance.toString() === web3.utils.toWei("50"));
            assert(trader2REPBalance.toString() === web3.utils.toWei("95"));
        });
        it("Should NOT create market order if token does not exist", async () => {
            await expectRevert(
                await dex.createMarketOrder(
                    web3.utils.fromAscii("TOKEN-DOES-NOT-EXIST"),
                    web3.utils.toWei("5"),
                    SIDE.SELL,
                    {from: trader2}
                ),
                "Token does not exist"
            );
        });
        it("Should NOT create market order if token is DAI", async () => {
            await expectRevert(
                await dex.createMarketOrder(
                    DAI, 
                    web3.utils.toWei("5"),
                    SIDE.SELL,
                    {from: trader2}
                ),
                "Cannot trade DAI"
            );
        });
        it("Should NOT create market order if it is a SELL order & token balance is too low", async () => {
            await dex.deposit(
                web3.utils.toWei("100"),
                REP,
                {from: trader1}
            );

            await expectRevert(
                await dex.createMarketOrder(
                    REP,
                    web3.utils.toWei("200"),
                    SIDE.SELL,
                    {from: trader1}
                ),
                "Token balance too low"
            );
        });
        it("Should NOT create market order if it is a BUY order & DAI balance is too low", async () => {
            await dex.deposit(
                web3.utils.toWei("100"),
                REP,
                {from: trader1}
            );

            await dex.createLimitOrder(
                REP,
                web.utils.toWei("100"),
                10,
                SIDE.SELL,
                {from: trader1}
            );

            await dex.deposit(
                web.utils.toWei("500"),
                DAI,
                {from: trader2}
            )

            await expectRevert(
                await dex.createMarketOrder(
                    REP,
                    web.utils.toWei("50"),
                    SIDE.BUY,
                    {from: trader2}
                ),
                "DAI balance too low"
            );
        });
    });
});