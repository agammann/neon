// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @notice Local-chain fixture. Anyone may change the price; never use for real funds.
contract MockEthUsdOracle {
    uint8 public constant decimals = 8;
    int256 public answer;
    uint256 public updatedAt;
    bool public broken;

    constructor(int256 initialPrice8) {
        setPrice(initialPrice8);
    }

    function setPrice(int256 price8) public {
        answer = price8;
        updatedAt = block.timestamp;
    }

    function setBroken(bool value) external { broken = value; }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "oracle unavailable");
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
