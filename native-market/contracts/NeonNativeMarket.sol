// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUsdOracle {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Test-only bilateral ETH/USD market. Native ETH is the sole margin and payout asset.
/// @dev No owner, upgrade, fee recipient, operator withdrawal, or offchain settlement authority.
contract NeonNativeMarket {
    error InvalidChain();
    error InvalidOracle();
    error InvalidAmount();
    error InvalidOffer();
    error InvalidPosition();
    error Unauthorized();
    error PriceUnavailable();
    error InsufficientOracleGas();
    error PriceOutsideBounds();
    error NotLiquidatable();
    error TransferFailed();

    uint256 public constant MIN_MARGIN = 0.01 ether;
    uint256 public constant MAX_MARGIN = 10 ether;
    uint256 public constant MAX_ORACLE_AGE = 1 hours;
    uint256 public constant STALE_REFUND_AGE = 24 hours;
    uint256 public constant PRICE_CAP = 1e16; // USD with 8 decimals; bounds arithmetic.
    uint256 public constant MAX_ORACLE_READ_GAS = 100_000;
    uint8 public constant MAX_LEVERAGE = 5;
    IUsdOracle public immutable oracle;
    uint256 public oracleOutageObservedAt;

    uint256 public nextOfferId = 1;
    uint256 public nextPositionId = 1;
    uint256 public totalLiabilityWei;
    mapping(address => uint256) public availableWei;

    struct Offer {
        address maker;
        uint256 marginWei;
        uint256 referencePrice8;
        uint64 expiresAt;
        uint16 maxDeviationBps;
        uint8 leverage;
        bool makerIsLong;
        bool active;
    }

    struct Position {
        address longTrader;
        address shortTrader;
        uint256 marginWei;
        uint256 entryPrice8;
        uint8 leverage;
        uint64 openedAt;
        bool active;
    }

    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Position) public positions;
    bool private withdrawing;

    event Deposited(address indexed trader, uint256 amountWei);
    event Withdrawn(address indexed trader, uint256 amountWei);
    event OfferPosted(uint256 indexed offerId, address indexed maker, bool makerIsLong, uint256 marginWei, uint8 leverage, uint256 referencePrice8);
    event OfferCancelled(uint256 indexed offerId);
    event PositionOpened(uint256 indexed positionId, uint256 indexed offerId, address indexed longTrader, address shortTrader, uint256 entryPrice8);
    event PositionSettled(uint256 indexed positionId, uint256 exitPrice8, uint256 longPayoutWei, uint256 shortPayoutWei, bool liquidated);
    event PositionStaleRefunded(uint256 indexed positionId);
    event OracleObservation(bool healthy, uint256 outageObservedAt);

    constructor(address oracleAddress) {
        if (block.chainid != 31337) revert InvalidChain();
        if (oracleAddress == address(0) || oracleAddress.code.length == 0) revert InvalidOracle();
        oracle = IUsdOracle(oracleAddress);
        if (oracle.decimals() != 8) revert InvalidOracle();
    }

    function deposit() external payable {
        if (msg.value == 0) revert InvalidAmount();
        availableWei[msg.sender] += msg.value;
        totalLiabilityWei += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amountWei) external {
        if (withdrawing) revert Unauthorized();
        if (amountWei == 0 || amountWei > availableWei[msg.sender]) revert InvalidAmount();
        withdrawing = true;
        availableWei[msg.sender] -= amountWei;
        totalLiabilityWei -= amountWei;
        (bool ok,) = msg.sender.call{value: amountWei}("");
        withdrawing = false;
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amountWei);
    }

    function postOffer(bool makerIsLong, uint256 marginWei, uint8 leverage, uint64 expiresAt, uint16 maxDeviationBps) external returns (uint256 offerId) {
        if (marginWei < MIN_MARGIN || marginWei > MAX_MARGIN || marginWei > availableWei[msg.sender]) revert InvalidAmount();
        if (leverage == 0 || leverage > MAX_LEVERAGE || maxDeviationBps > 500) revert InvalidOffer();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + 7 days) revert InvalidOffer();
        uint256 price = currentPrice8();
        _clearOracleOutage();
        availableWei[msg.sender] -= marginWei;
        offerId = nextOfferId++;
        offers[offerId] = Offer(msg.sender, marginWei, price, expiresAt, maxDeviationBps, leverage, makerIsLong, true);
        emit OfferPosted(offerId, msg.sender, makerIsLong, marginWei, leverage, price);
    }

    function cancelOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert InvalidOffer();
        if (msg.sender != offer.maker && block.timestamp <= offer.expiresAt) revert Unauthorized();
        offer.active = false;
        availableWei[offer.maker] += offer.marginWei;
        emit OfferCancelled(offerId);
    }

    function matchOffer(uint256 offerId, uint256 minPrice8, uint256 maxPrice8) external returns (uint256 positionId) {
        Offer storage offer = offers[offerId];
        if (!offer.active || block.timestamp > offer.expiresAt || msg.sender == offer.maker) revert InvalidOffer();
        if (availableWei[msg.sender] < offer.marginWei) revert InvalidAmount();
        uint256 price = currentPrice8();
        _clearOracleOutage();
        if (price < minPrice8 || price > maxPrice8) revert PriceOutsideBounds();
        uint256 difference = price > offer.referencePrice8 ? price - offer.referencePrice8 : offer.referencePrice8 - price;
        if (difference * 10_000 > offer.referencePrice8 * offer.maxDeviationBps) revert PriceOutsideBounds();
        offer.active = false;
        availableWei[msg.sender] -= offer.marginWei;
        positionId = nextPositionId++;
        address longTrader = offer.makerIsLong ? offer.maker : msg.sender;
        address shortTrader = offer.makerIsLong ? msg.sender : offer.maker;
        positions[positionId] = Position(longTrader, shortTrader, offer.marginWei, price, offer.leverage, uint64(block.timestamp), true);
        emit PositionOpened(positionId, offerId, longTrader, shortTrader, price);
    }

    function closePosition(uint256 positionId) external {
        Position storage position = positions[positionId];
        if (!position.active) revert InvalidPosition();
        if (msg.sender != position.longTrader && msg.sender != position.shortTrader) revert Unauthorized();
        uint256 price = currentPrice8();
        _clearOracleOutage();
        _settle(positionId, price, false);
    }

    function liquidate(uint256 positionId) external {
        Position storage position = positions[positionId];
        if (!position.active) revert InvalidPosition();
        uint256 price = currentPrice8();
        _clearOracleOutage();
        uint256 delta = price > position.entryPrice8 ? price - position.entryPrice8 : position.entryPrice8 - price;
        uint256 lossWei = position.marginWei * position.leverage * delta / price;
        if (lossWei < position.marginWei * 8 / 10) revert NotLiquidatable();
        _settle(positionId, price, true);
    }

    /// @notice Record the oracle's present health; anyone may report an observation.
    /// @dev A healthy observation resets the timer. It cannot prove uninterrupted
    /// failure between transactions because this oracle interface has no history.
    function observeOracle() external returns (bool healthy) {
        (healthy,) = _readPrice();
        if (healthy) _clearOracleOutage();
        else if (oracleOutageObservedAt == 0) oracleOutageObservedAt = block.timestamp;
        emit OracleObservation(healthy, oracleOutageObservedAt);
    }

    /// @notice Neutral refund after an observed outage has aged for a full day.
    /// @dev Requires an invalid current reading and no later recorded healthy
    /// observation. Unobserved recovery is not detectable; this sacrifices PnL.
    function refundStalePosition(uint256 positionId) external {
        Position storage position = positions[positionId];
        if (!position.active) revert InvalidPosition();
        if (block.timestamp <= uint256(position.openedAt) + STALE_REFUND_AGE) revert PriceUnavailable();
        if (oracleOutageObservedAt == 0 || block.timestamp <= oracleOutageObservedAt + STALE_REFUND_AGE) revert PriceUnavailable();
        (bool healthy,) = _readPrice();
        if (healthy) revert PriceUnavailable();
        position.active = false;
        availableWei[position.longTrader] += position.marginWei;
        availableWei[position.shortTrader] += position.marginWei;
        emit PositionStaleRefunded(positionId);
    }

    function currentPrice8() public view returns (uint256 price8) {
        (bool healthy, uint256 price) = _readPrice();
        if (!healthy) revert PriceUnavailable();
        return price;
    }

    function _readPrice() private view returns (bool healthy, uint256 price8) {
        // Decode explicitly: a Solidity try/catch does not catch every ABI
        // decoding failure. Bound both the external call and copied return data.
        // Guarantee the full oracle budget and enough gas to record a result;
        // otherwise a caller could manufacture an outage with too little gas.
        if (gasleft() < MAX_ORACLE_READ_GAS + 60_000) revert InsufficientOracleGas();
        address target = address(oracle);
        bytes memory request = abi.encodeWithSelector(IUsdOracle.latestRoundData.selector);
        bytes memory data = new bytes(160);
        bool ok;
        uint256 size;
        assembly ("memory-safe") {
            ok := staticcall(MAX_ORACLE_READ_GAS, target, add(request, 32), mload(request), add(data, 32), 160)
            size := returndatasize()
        }
        if (!ok || size != 160) return (false, 0);
        uint256 roundId;
        int256 answer;
        uint256 updatedAt;
        uint256 answeredInRound;
        assembly ("memory-safe") {
            roundId := mload(add(data, 32))
            answer := mload(add(data, 64))
            updatedAt := mload(add(data, 128))
            answeredInRound := mload(add(data, 160))
        }
        if (roundId > type(uint80).max || answeredInRound > type(uint80).max || answer <= 0 || uint256(answer) > PRICE_CAP || updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > MAX_ORACLE_AGE) return (false, 0);
        return (true, uint256(answer));
    }

    function _clearOracleOutage() private {
        if (oracleOutageObservedAt != 0) oracleOutageObservedAt = 0;
    }

    function _settle(uint256 positionId, uint256 exitPrice8, bool wasLiquidated) private {
        Position storage position = positions[positionId];
        uint256 delta = exitPrice8 > position.entryPrice8 ? exitPrice8 - position.entryPrice8 : position.entryPrice8 - exitPrice8;
        uint256 changeWei = position.marginWei * position.leverage * delta / exitPrice8;
        if (changeWei > position.marginWei) changeWei = position.marginWei;
        uint256 longPayout = exitPrice8 >= position.entryPrice8 ? position.marginWei + changeWei : position.marginWei - changeWei;
        uint256 shortPayout = 2 * position.marginWei - longPayout;
        position.active = false;
        availableWei[position.longTrader] += longPayout;
        availableWei[position.shortTrader] += shortPayout;
        emit PositionSettled(positionId, exitPrice8, longPayout, shortPayout, wasLiquidated);
    }
}
