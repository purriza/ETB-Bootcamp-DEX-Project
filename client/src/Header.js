import React from "react";
import Dropdown from "./Dropdown.js";

function Header({
    user, 
    tokens,
    contracts,
    selectToken
}) {
    return (
        <header id="header" className="card">
            <div className="row">
            <div className="col-sm-3 flex">
                <Dropdown
                    items={tokens.map(token => ({
                        label: token.ticker,
                        value: token
                    }))}
                    activeItem={{
                        label: user.selectedToken.ticker,
                        value: user.selectedToken
                    }}
                    onSelect={selectToken}
                />
            </div>
            <div className="col-sm9 flex">
                <h1 className="header-title">
                Dex - <span className="contract-address">Contract Address: <span className="address">{contracts.dex.options.address}</span></span>
            </div>
        </header>
    );
}

export default Header;