// SPDX-License-Identifier: UNLICENSED
//pragma solidity ^0.6.3;
pragma solidity ^0.8.0;

//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20Detailed.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//contract Dai is ERC20, ERC20Detailed {
contract Dai is ERC20 {
    //constructor() ERC20Detailed("DAI", "Dai Stablecoin", 18) public {}
    constructor() ERC20("DAI", "Dai Stablecoin") {}

    // Faucet: Mechanism to get some free tokens for testing our smart contract
    function faucet (address to, uint amount) external {
        _mint(to, amount); 

        // ERC20 function
        /** @dev Creates `amount` tokens and assigns them to `account`, increasing
         * the total supply.
         *
         * Emits a {Transfer} event with `from` set to the zero address.
         *
         * Requirements:
         *
         * - `account` cannot be the zero address.
         */
        /*function _mint(address account, uint256 amount) internal virtual {
            require(account != address(0), "ERC20: mint to the zero address");

            _beforeTokenTransfer(address(0), account, amount);

            _totalSupply += amount;
            unchecked {
                // Overflow not possible: balance + amount is at most totalSupply + amount, which is checked above.
                _balances[account] += amount;
            }
            emit Transfer(address(0), account, amount);

            _afterTokenTransfer(address(0), account, amount);
        }*/
    }
}