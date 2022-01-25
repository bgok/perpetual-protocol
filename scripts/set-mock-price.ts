import { ChainlinkL1, L2PriceFeed } from "../types/ethers"
import { ContractFullyQualifiedName } from "../publish/ContractName"
import { getCurrentTimestamp } from "hardhat/internal/hardhat-network/provider/utils/getCurrentTimestamp"
import { BigNumber } from "ethers"
import { ethers } from "hardhat"
import { Layer, Stage } from "./common"
import { MigrationContext } from "../publish/Migration"
import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { DeployConfig } from "../publish/contract/DeployConfig"
import { ContractWrapperFactory } from "../publish/contract/ContractWrapperFactory"
import { HardhatRuntimeEnvironment } from "hardhat/types"

interface SetMockPriceArgumentsInterface {
    stage: Stage,
    priceFeedKey: string,
    price: number,
    noUpdate: boolean
}

function generateContext(stage: Stage, layer: Layer): MigrationContext {
    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)

    const externalContract = settingsDao.getExternalContracts(layer)
    const deployConfig = new DeployConfig(settingsDao.stage)
    const factory = new ContractWrapperFactory(layer, systemMetadataDao, deployConfig.confirmations)
    return {
        stage,
        layer,
        settingsDao,
        systemMetadataDao,
        externalContract,
        deployConfig,
        factory,
    }
}

// price must be an integer
export async function setMockPrice(env: HardhatRuntimeEnvironment, {
    stage,
    priceFeedKey,
    price,
    noUpdate,
}: SetMockPriceArgumentsInterface) {
    const byte32PriceFeedKey = ethers.utils.formatBytes32String(priceFeedKey)

    const context = generateContext(stage, Layer.Layer1)

    console.log("Get the previous timestamp from L2PriceFeed")
    let prevTimeStamp = 0
    const priceFeed = await context.factory
        .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
        .instance()
    try {
        prevTimeStamp = (await priceFeed.getLatestTimestamp(priceFeedKey)).toNumber()
    } catch (e) {
        console.log(`L2PriceFeed doesn't have any prices for ${priceFeedKey}`)
    }
    const timeStamp = prevTimeStamp < getCurrentTimestamp() ? getCurrentTimestamp() : prevTimeStamp + 1

    console.log("Getting the mock aggregator address")
    const chainlinkL1 = await context.factory.create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1).instance()
    const aggregatorAddress = await chainlinkL1.getAggregator(byte32PriceFeedKey)
    console.log(`Aggregator found for ${priceFeedKey}: ${aggregatorAddress}`)

    const fullyQualifiedContractName = "src/mock/mocks/ChainlinkAggregatorMock.sol:ChainlinkAggregatorMock" as ContractFullyQualifiedName
    const agg = await ethers.getContractAt(fullyQualifiedContractName, aggregatorAddress)

    const decimals = await agg.decimals()
    const { roundId, answeredInRound } = await agg.latestRoundData()
    const formattedPrice = BigNumber.from(price).mul(BigNumber.from(10).pow(decimals))
    await (await agg.mockAddAnswer(
        roundId === undefined ? 0 : roundId.add(1),
        formattedPrice,
        timeStamp,
        timeStamp,
        answeredInRound === undefined ? 0 : answeredInRound.add(1),
    )).wait()
    console.log(`Price of ${priceFeedKey} set to: ${price}`)

    if (!noUpdate) {
        await (await chainlinkL1.updateLatestRoundData(byte32PriceFeedKey)).wait()
        console.log("New price added to L2PriceFeed")

        // Sanity check
        const expectedPrice = formattedPrice
            .mul(BigNumber.from(10).pow(18))
            .div(BigNumber.from(10).pow(decimals))
        const newPrice = await priceFeed.getPrice(byte32PriceFeedKey)
        console.assert(
            newPrice.eq(expectedPrice),
            `Saved price doesn't match expected value. Expected: ${expectedPrice.toString()}, Actual: ${newPrice.toString()}`,
        )
    }
}