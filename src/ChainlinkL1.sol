// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
//import { RootBridge } from "./bridge/ethereum/RootBridge.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";
import { IPriceFeed } from "./interface/IPriceFeed.sol";

contract ChainlinkL1 is IPriceFeed, PerpFiOwnableUpgrade, BlockContext {
    using SafeMath for uint256;
    using Decimal for Decimal.decimal;

    uint256 private constant TOKEN_DIGIT = 10**18;

    event RootBridgeChanged(address rootBridge);
    event PriceFeedL2Changed(address priceFeedL2);
    event PriceUpdateMessageIdSent(bytes32 messageId);
    //    event PriceUpdated(uint80 roundId, uint256 price, uint256 timestamp);
    event PriceFeedDataSet(bytes32 key, Decimal.decimal price, uint256 timestamp, uint256 roundId);

    struct PriceData {
        uint256 roundId;
        Decimal.decimal price;
        uint256 timestamp;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // key by currency symbol, eg ETH
    mapping(bytes32 => AggregatorV3Interface) public aggregatorMap;
    mapping(bytes32 => PriceData[]) public priceData;
    bytes32[] public priceFeedKeys;
    //    RootBridge public rootBridge;
    //    address public priceFeedL2Address;
    mapping(bytes32 => uint256) public prevTimestampMap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    //    function initialize(address _rootBridge, address _priceFeedL2) public initializer {
    function initialize() public initializer {
        __Ownable_init();
        //        setRootBridge(_rootBridge);
        //        setPriceFeedL2(_priceFeedL2);
    }

    //    function setRootBridge(address _rootBridge) public onlyOwner {
    //        requireNonEmptyAddress(_rootBridge);
    //        rootBridge = RootBridge(_rootBridge);
    //        emit RootBridgeChanged(_rootBridge);
    //    }

    //    function setPriceFeedL2(address _priceFeedL2) public onlyOwner {
    //        requireNonEmptyAddress(_priceFeedL2);
    //        priceFeedL2Address = _priceFeedL2;
    //        emit PriceFeedL2Changed(_priceFeedL2);
    //    }

    function addAggregator(bytes32 _priceFeedKey, address _aggregator) external onlyOwner {
        requireNonEmptyAddress(_aggregator);
        if (address(aggregatorMap[_priceFeedKey]) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        aggregatorMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
        //        priceData[_priceFeedKey] = new PriceData[];
    }

    function removeAggregator(bytes32 _priceFeedKey) external onlyOwner {
        requireNonEmptyAddress(address(getAggregator(_priceFeedKey)));
        delete aggregatorMap[_priceFeedKey];
        delete priceData[_priceFeedKey];

        uint256 length = priceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (priceFeedKeys[i] == _priceFeedKey) {
                // if the removal item is the last one, just `pop`
                if (i != length - 1) {
                    priceFeedKeys[i] = priceFeedKeys[length - 1];
                }
                priceFeedKeys.pop();
                break;
            }
        }
    }

    function getAggregator(bytes32 _priceFeedKey) public view returns (AggregatorV3Interface) {
        return aggregatorMap[_priceFeedKey];
    }

    //
    // INTERFACE IMPLEMENTATION
    //

    function updateLatestRoundData(bytes32 _priceFeedKey) external {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (uint80 roundId, int256 price, , uint256 timestamp, ) = aggregator.latestRoundData();
        require(timestamp > prevTimestampMap[_priceFeedKey], "incorrect timestamp");
        require(price >= 0, "negative answer");

        uint8 decimals = aggregator.decimals();

        Decimal.decimal memory decimalPrice = Decimal.decimal(formatDecimals(uint256(price), decimals));

        PriceData memory data = PriceData({ price: decimalPrice, timestamp: timestamp, roundId: roundId });
        priceData[_priceFeedKey].push(data);

        emit PriceFeedDataSet(_priceFeedKey, decimalPrice, timestamp, roundId);

        //        bytes32 messageId =
        //            rootBridge.updatePriceFeed(priceFeedL2Address, _priceFeedKey, decimalPrice, timestamp, roundId);
        //        emit PriceUpdateMessageIdSent(messageId);
        //        emit PriceUpdated(roundId, decimalPrice.toUint(), timestamp);

        prevTimestampMap[_priceFeedKey] = timestamp;
    }

    function getPrice(bytes32 _priceFeedKey) external view override returns (uint256) {
        //        require(isExistedKey(_priceFeedKey), "key not existed"); // it always returns true :shrug:
        uint256 len = getPriceFeedLength(_priceFeedKey);
        require(len > 0, "no price data");
        return priceData[_priceFeedKey].priceData[len - 1].price;
    }

    function getLatestTimestamp(bytes32 _priceFeedKey) public view override returns (uint256) {
        //        require(isExistedKey(_priceFeedKey), "key not existed"); // it always returns true :shrug:
        uint256 len = getPriceFeedLength(_priceFeedKey);
        if (len == 0) {
            return 0;
        }
        return priceData[_priceFeedKey].priceData[len - 1].timestamp;
    }

    function getTwapPrice(bytes32 _priceFeedKey, uint256 _interval) external view override returns (uint256) {
        //        require(isExistedKey(_priceFeedKey), "key not existed"); // it always returns true :shrug:
        require(_interval != 0, "interval can't be 0");

        // ** We assume L1 and L2 timestamp will be very similar here **
        // 3 different timestamps, `previous`, `current`, `target`
        // `base` = now - _interval
        // `current` = current round timestamp from aggregator
        // `previous` = previous round timestamp form aggregator
        // now >= previous > current > = < base
        //
        //  while loop i = 0
        //  --+------+-----+-----+-----+-----+-----+
        //         base                 current  now(previous)
        //
        //  while loop i = 1
        //  --+------+-----+-----+-----+-----+-----+
        //         base           current previous now

        uint256 len = getPriceFeedLength(_priceFeedKey);
        require(len > 0, "Not enough history");
        uint256 round = len - 1;
        PriceData memory priceRecord = priceData[_priceFeedKey].priceData[round];
        uint256 latestTimestamp = priceRecord.timestamp;
        uint256 baseTimestamp = _blockTimestamp().sub(_interval);
        // if latest updated timestamp is earlier than target timestamp, return the latest price.
        if (latestTimestamp < baseTimestamp || round == 0) {
            return priceRecord.price;
        }

        // rounds are like snapshots, latestRound means the latest price snapshot. follow chainlink naming
        uint256 cumulativeTime = _blockTimestamp().sub(latestTimestamp);
        uint256 previousTimestamp = latestTimestamp;
        uint256 weightedPrice = priceRecord.price.mul(cumulativeTime);
        while (true) {
            if (round == 0) {
                // if cumulative time is less than requested interval, return current twap price
                return weightedPrice.div(cumulativeTime);
            }

            round = round.sub(1);
            // get current round timestamp and price
            priceRecord = priceData[_priceFeedKey].priceData[round];
            uint256 currentTimestamp = priceRecord.timestamp;
            uint256 price = priceRecord.price;

            // check if current round timestamp is earlier than target timestamp
            if (currentTimestamp <= baseTimestamp) {
                // weighted time period will be (target timestamp - previous timestamp). For example,
                // now is 1000, _interval is 100, then target timestamp is 900. If timestamp of current round is 970,
                // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
                // instead of (970 - 880)
                weightedPrice = weightedPrice.add(price.mul(previousTimestamp.sub(baseTimestamp)));
                break;
            }

            uint256 timeFraction = previousTimestamp.sub(currentTimestamp);
            weightedPrice = weightedPrice.add(price.mul(timeFraction));
            cumulativeTime = cumulativeTime.add(timeFraction);
            previousTimestamp = currentTimestamp;
        }
        return weightedPrice.div(_interval);
    }

    function getPreviousPrice(bytes32 _priceFeedKey, uint256 _numOfRoundBack) public view override returns (uint256) {
        //        require(isExistedKey(_priceFeedKey), "key not existed");

        uint256 len = getPriceFeedLength(_priceFeedKey);
        require(len > 0 && _numOfRoundBack < len, "Not enough history");
        return priceData[_priceFeedKey].priceData[len - _numOfRoundBack - 1].price;
    }

    function getPreviousTimestamp(bytes32 _priceFeedKey, uint256 _numOfRoundBack)
        public
        view
        override
        returns (uint256)
    {
        //        require(isExistedKey(_priceFeedKey), "key not existed");

        uint256 len = getPriceFeedLength(_priceFeedKey);
        require(len > 0 && _numOfRoundBack < len, "Not enough history");
        return priceData[_priceFeedKey].priceData[len - _numOfRoundBack - 1].timestamp;
    }

    //
    // END OF INTERFACE IMPLEMENTATION
    //

    //
    // REQUIRE FUNCTIONS
    //

    function requireNonEmptyAddress(address _addr) internal pure {
        require(_addr != address(0), "empty address");
    }

    //
    // END OF REQUIRE FUNCTIONS
    //

    //
    // INTERNAL VIEW FUNCTIONS
    //
    function formatDecimals(uint256 _price, uint8 _decimals) internal pure returns (uint256) {
        return _price.mul(TOKEN_DIGIT).div(10**uint256(_decimals));
    }

    // @dev there's no purpose for a registered priceFeed with 0 priceData so it will revert directly
    function getPriceFeedLength(bytes32 _priceFeedKey) public view returns (uint256 length) {
        return priceData[_priceFeedKey].priceData.length;
    }

    function getLatestRoundId(bytes32 _priceFeedKey) internal view returns (uint256) {
        uint256 len = getPriceFeedLength(_priceFeedKey);
        if (len == 0) {
            return 0;
        }
        return priceData[_priceFeedKey].priceData[len - 1].roundId;
    }

    //    function isExistedKey(bytes32 _priceFeedKey) private view returns (bool) {
    //        return true; //priceFeedMap[_priceFeedKey].registered;
    //    }
    //
    //    function requireKeyExisted(bytes32 _key, bool _existed) private view {
    //                if (_existed) {
    //                    require(isExistedKey(_key), "key not existed");
    //                } else {
    //                    require(!isExistedKey(_key), "key existed");
    //                }
    //    }
}
