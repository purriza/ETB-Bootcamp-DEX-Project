// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.0;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/SafeMath.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Dex {

    using SafeMath for uint32;
    using SafeMath for uint256;

    address public admin;
    bytes32 constant DAI = bytes32("DAI");

    // Token management
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    } 
    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList; // List to keep track of the Tickers in order to be able to loop through the mapping

    // Wallet management
    mapping(address => mapping(bytes32 => uint256)) public traderBalances; // Address => Ticker => Amount

    // Limit orders management
    enum Side{
        BUY, 
        SELL
    }

    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }
    mapping(bytes32 => mapping(uint => Order[])) public orderBook; // Ticker => Side (buy(0)/sell(1)) => Orders 
    uint public nextOrderId;

    // Market orders management
    uint nextTradeId; 

    // It will be used on the frontend to display the trades in real time
    event NewTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed ticker, // indexed == It allows to filter the events in the frontend
        address indexed trader1,
        address indexed trader2,
        uint amount, 
        uint price,
        uint date
    );

    constructor() {
        admin = msg.sender;
    }

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier tokenExist(bytes32 ticker) {
        // You still can access a value that hasnt been added to a mapping, it will be the default address (address(0))
        require(tokens[ticker].tokenAddress != address(0), "This token does not exist"); 
        _;
    }

    modifier tokenIsNotDAI(bytes32 ticker) {
        require(ticker != DAI, "Cannot trade DAI");
        _;
    }

    // Token management
    function addToken(bytes32 ticker, address tokenAddress) onlyAdmin() external {
        tokens[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function getTokens() external view returns (Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);

        for (uint i = 0; i < tokenList.length; i++) {
            // PUI Code
            //_tokens.push(tokens[tokenList[i]]); ?

            // // ETB Code
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }

        return _tokens;
    }

    // Wallet management
    function deposit(uint amount, bytes32 ticker) tokenExist(ticker) external {
        // Before calling the deposit function the trader needs to call the approve function 
        // on his ERC token with the address of the DEX and the amount he wants to transfer
        IERC20(tokens[ticker].tokenAddress).transferFrom(msg.sender, address(this), amount);

        // OpenZeppelin SafeMath to prevent overflows
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].add(amount);
    }

    function withdraw(uint amount, bytes32 ticker) tokenExist(ticker) external {
        require(traderBalances[msg.sender][ticker] >= amount, "Balance too low");

        // OpenZeppelin SafeMath to prevent overflows
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(amount);
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    // Limit order management
    function createLimitOrder(bytes32 ticker, uint amount, uint price, Side side) tokenExist(ticker) tokenIsNotDAI(ticker) external {
        // We should not be able to buy/sell DAI itself (Modifier)
        //require(ticker != DAI, "Cannot trade DAI");

        if (side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, "Token balance too low");

        }
        else {
            // OpenZeppelin SafeMath to prevent overflows
            require(traderBalances[msg.sender][DAI] >= amount.mul(price), "DAI balance too low");
        }

        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(
            nextOrderId,
            msg.sender,
            side,
            ticker,
            amount,
            0,
            price,
            block.timestamp
        ));

        // We need to keep the orders in price order (Bubble algorithm)
        uint i = orders.length > 0 ? orders.length - 1 : 0;
        while(i > 0) {
            if (side == Side.BUY && orders[i - 1].price > orders[i].price) { // For the sell orders we have to order from lower to lowe price
                break;
            }
            if (side == Side.SELL && orders[i - 1].price < orders[i].price) { // For the sell orders we have to order from lower to lowe price
                break;
            }
            // We swap the elements
            Order memory order = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = order;

            //i--; It's never supposed to be 0 but...
            // OpenZeppelin SafeMath to prevent overflows
            i = i.sub(1);
        }

        // OpenZeppelin SafeMath to prevent overflows
        nextOrderId = nextOrderId.add(1);
    }

    function getOrders(bytes32 ticker, Side side) external view returns (Order[] memory) {
        return orderBook[ticker][uint(side)];
    }

    // Market order management
    function createMarketOrder(bytes32 ticker, uint amount, Side side) tokenExist(ticker) tokenIsNotDAI(ticker) external {
        // PUI: Duplicated code, could be a point of enhancement
        if (side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, "Token balance too low");
        }
        else {
            // PENDING: This check has to use the limitOrder price
            //require(traderBalances[msg.sender][DAI] >= amount * price, "DAI balance too low");
        }

        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)]; // If it is a sell we want the BUY Orders
        uint i;
        uint remaining = amount;

        // Matching process between orders
        while(i < orders.length && remaining > 0) {
            uint available = orders[i].amount.sub(orders[i].filled);
            // If the actual order has less available than our remaining then we matched the whole available. If it hasnt, then we matched the remaining and end
            uint matched = (remaining > available) ? available : remaining; 
            // OpenZeppelin SafeMath to prevent overflows
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);

            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker, 
                orders[i].trader,
                msg.sender,
                matched, 
                orders[i].price,
                block.timestamp
            );

            // OpenZeppelin SafeMath to prevent overflows (Replacing += and -=, less readable but safer)
            if (side == Side.SELL) {
                // Sender/seller balances
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].
                    sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].
                    add(matched.mul(orders[i].price));

                // Buyer balances
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker].
                    add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI].
                    sub(matched.mul(orders[i].price));
            }
            else { // side == Side.BUY
                require(traderBalances[msg.sender][DAI] >= matched.mul(orders[i].price), "DAI balance too low");

                // Sender/buyer balances
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].
                    add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].
                    sub(matched.mul(orders[i].price));

                // Seller balances
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker].
                    add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI].
                    sub(matched.mul(orders[i].price));
            }

            nextTradeId = nextTradeId.add(1);
            i = i.add(1);
        }

        // We should check if there are orders that are completely filled, in that case we should remove them from the order book
        // The order book is executed in order so, if we find an unfilled order, we can skip the loop. Meanwhile we shift the values
        i = 0;
        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i = i.add(1);
        }
    }
}