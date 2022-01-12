import { web3 } from "hardhat"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { expect, use } from "chai"
import { ChainlinkAggregatorMockInstance, ChainlinkL1Instance, L2PriceFeedMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployChainlinkL1, deployL2MockPriceFeed } from "../helper/contract"
import { deployChainlinkAggregatorMock } from "../helper/mockContract"

use(assertionHelper)

describe("chainlinkL1 Spec", () => {
    let addresses: string[]
    let chainlinkL1!: ChainlinkL1Instance
    let chainlinkAggregator!: ChainlinkAggregatorMockInstance
    let priceFeedL2!: L2PriceFeedMockInstance
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        chainlinkAggregator = await deployChainlinkAggregatorMock()
        priceFeedL2 = await deployL2MockPriceFeed(new BN(4123.45))
    })

    function stringToBytes32(str: string): string {
        return web3.utils.asciiToHex(str)
    }

    function fromBytes32(str: string): string {
        return web3.utils.hexToUtf8(str)
    }

    describe("initialize()", () => {
        it("force error, PriceFeedL2 address cannot be address(0)", async () => {
            await expectRevert(deployChainlinkL1(EMPTY_ADDRESS), "empty address")
        })
    })

    describe("setPriceFeedL2()", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(priceFeedL2.address)
        })

        it("set the address of PriceFeedL2", async () => {
            const receipt = await chainlinkL1.setPriceFeedL2(priceFeedL2.address)
            await expectEvent.inTransaction(receipt.tx, chainlinkL1, "PriceFeedL2Changed", {
                priceFeedL2: priceFeedL2.address,
            })
            expect(await chainlinkL1.priceFeedL2()).eq(priceFeedL2.address)
        })

        it("force error, PriceFeedL2 address cannot be address(0)", async () => {
            await expectRevert(chainlinkL1.setPriceFeedL2(EMPTY_ADDRESS), "empty address")
        })
    })

    describe("addAggregator", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(priceFeedL2.address)
        })

        it("getAggregator with existed aggregator key", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(chainlinkAggregator.address)
        })

        it("getAggregator with non-existed aggregator key", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            expect(await chainlinkL1.getAggregator(stringToBytes32("BTC"))).eq(EMPTY_ADDRESS)
        })

        it("add multi aggregators", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            await chainlinkL1.addAggregator(stringToBytes32("BTC"), addresses[1])
            await chainlinkL1.addAggregator(stringToBytes32("LINK"), addresses[2])
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(chainlinkAggregator.address)
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(2))).eq("LINK")
            expect(await chainlinkL1.getAggregator(stringToBytes32("LINK"))).eq(addresses[2])
        })

        it("force error, addAggregator with zero address", async () => {
            await expectRevert(chainlinkL1.addAggregator(stringToBytes32("ETH"), EMPTY_ADDRESS), "empty address")
        })
    })

    describe("removeAggregator", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(priceFeedL2.address)
        })

        it("remove 1 aggregator when there's only 1", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            await chainlinkL1.removeAggregator(stringToBytes32("ETH"))

            // cant use expectRevert because the error message is different between CI and local env
            let error
            try {
                await chainlinkL1.priceFeedKeys(0)
            } catch (e) {
                error = e
            }
            expect(error).not.eq(undefined)

            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
        })

        it("remove 1 aggregator when there're 2", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            await chainlinkL1.addAggregator(stringToBytes32("BTC"), chainlinkAggregator.address)
            await chainlinkL1.removeAggregator(stringToBytes32("ETH"))
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("BTC")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
            expect(await chainlinkL1.getAggregator(stringToBytes32("BTC"))).eq(chainlinkAggregator.address)
        })
    })

    describe("updateLatestRoundData()", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(priceFeedL2.address)
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkAggregator.address)
            await chainlinkAggregator.mockAddAnswer(8, 12345678, 1, 200000000000, 1)
        })

        it("get latest data", async () => {
            const receipt = await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"))
            await expectEvent.inTransaction(receipt.tx, chainlinkL1, "PriceUpdated", {
                roundId: "8",
                price: "123456780000000000",
                timestamp: "200000000000",
            })
            await expectEvent.inTransaction(receipt.tx, priceFeedL2, "PriceFeedDataSet", {
                key: stringToBytes32("ETH").padEnd(66, "0"),
                roundId: "8",
                price: "12345678",
                timestamp: "200000000000",
            })

        })

        it("get latest data, a specified keeper is not required", async () => {
            const receipt = await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"), { from: addresses[1] })
            await expectEvent.inTransaction(receipt.tx, chainlinkL1, "PriceUpdated", {
                roundId: "8",
                price: "123456780000000000",
                timestamp: "200000000000",
            })
        })

        // expectRevert section
        it("force error, get non-existing aggregator", async () => {
            const _wrongPriceFeedKey = "Ha"
            await expectRevert(chainlinkL1.updateLatestRoundData(stringToBytes32(_wrongPriceFeedKey)), "empty address")
        })

        it("force error, timestamp equal to 0", async () => {
            await chainlinkAggregator.mockAddAnswer(8, 41, 1, 0, 1)
            await expectRevert(chainlinkL1.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })

        it("force error, same timestamp as previous", async () => {
            // first update should pass
            await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"))
            expect(await chainlinkL1.prevTimestampMap(stringToBytes32("ETH"))).eq(new BN(200000000000))
            // second update with the same timestamp should fail
            await expectRevert(chainlinkL1.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })
    })
})
