// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Local-chain fixture. Anyone may change the price; never use for real funds.
contract MockEthUsdOracle {
    uint8 public constant decimals = 8;
    int256 public answer;
    uint256 public updatedAt;
    bool public broken;
    uint8 public malformedMode;

    constructor(int256 initialPrice8) {
        setPrice(initialPrice8);
    }

    function setPrice(int256 price8) public {
        answer = price8;
        updatedAt = block.timestamp;
    }

    // Synthetic rounds for testing invalid and future oracle timestamps.
    function setRound(int256 price8, uint256 timestamp) external {
        answer = price8;
        updatedAt = timestamp;
    }

    function setBroken(bool value) external { broken = value; }
    function setMalformedMode(uint8 mode) external { malformedMode = mode; }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "oracle unavailable");
        if (malformedMode == 1) assembly { return(0, 0) }
        if (malformedMode == 2) assembly { mstore(0, shl(80, 1)) return(0, 160) }
        if (malformedMode == 3) assembly { return(0, 65536) }
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
