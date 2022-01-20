import { Layer, Stage } from "./common"
import { MigrationContext } from "../publish/Migration"
import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { DeployConfig } from "../publish/contract/DeployConfig"
import { ContractWrapperFactory } from "../publish/contract/ContractWrapperFactory"
import { AmmInstanceName, ContractFullyQualifiedName } from "../publish/ContractName"
import { ChainlinkL1, L2PriceFeed } from "../types/ethers"
import { ethers } from "hardhat"

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

async function getPrices() {
    const byte32PriceFeedKey = ethers.utils.formatBytes32String("ETH")

    const context = generateContext("staging", Layer.Layer1)

    const amm = await context.factory.createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm).instance()
    console.log("Price From AMM:", (await amm.getUnderlyingPrice()).toString())
    console.log("TWAP From AMM:", (await amm.getUnderlyingTwapPrice(300)).toString())

    const chainlink = await context.factory.create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1).instance()
    const aggregatorAddress = await chainlink.getAggregator(byte32PriceFeedKey)

    const fullyQualifiedContractName = "src/mock/mocks/ChainlinkAggregatorMock.sol:ChainlinkAggregatorMock" as ContractFullyQualifiedName
    const aggregator = await ethers.getContractAt(fullyQualifiedContractName, aggregatorAddress)
    const decimals = await aggregator.decimals()
    console.log("Decimals from aggregator:", decimals)

    const priceFeed = await context.factory.create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed).instance()
    console.log("Price From L2PriceFeed:", (await priceFeed.getPrice(byte32PriceFeedKey)).toString())
    console.log("TWAP From L2PriceFeed:", (await priceFeed.getTwapPrice(byte32PriceFeedKey, 300)).toString())
}

if (require.main === module) {
    getPrices()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
