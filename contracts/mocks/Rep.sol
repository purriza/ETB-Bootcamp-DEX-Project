// SPDX-License-Identifier: UNLICENSED
//pragma solidity ^0.6.3;
pragma solidity ^0.8.0;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20Detailed.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//contract Rep is ERC20, ERC20Detailed {
contract Rep is ERC20 {
    //constructor() ERC20Detailed("REP", "Augur token", 18) public {}
    constructor() ERC20("REP", "Augur token") {}

    function faucet(address to, uint amount) external {
        _mint(to, amount);
    }
}