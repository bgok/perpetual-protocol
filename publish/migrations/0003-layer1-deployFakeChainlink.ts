/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from "ethers"
import { AggregatorV3Interface, ChainlinkL1 } from "../../types/ethers"
import { PriceFeedKey } from "../contract/DeployConfig"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

async function createMockPriceFeedAggregator(priceFeedKey: string, context: MigrationContext) {
    console.log(`Deploy mock aggregator for ${priceFeedKey}`)
    const mockAggregator = await context.factory.create<AggregatorV3Interface>(
        `src/mock/mocks/ChainlinkAggregatorMock.sol:ChainlinkAggregatorMock${priceFeedKey}` as ContractFullyQualifiedName,
    )
        .deployImmutableContract(8, `Mock aggregator of ${priceFeedKey} prices`)

    const chainlink = await context.factory
        .create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1)
        .instance()
    try {
        const rcpt = await chainlink.removeAggregator(priceFeedKey)
        await rcpt.wait()
        console.log(`Previously registered ${priceFeedKey} Aggregator was removed`)
    } catch (e) {
        console.log(`no ${priceFeedKey} Aggregator was previously registered`)
    }

    console.log("Register the mock aggregator")
    const rcpt = await chainlink.addAggregator(ethers.utils.formatBytes32String(priceFeedKey), mockAggregator.address)
    await rcpt.wait(context.deployConfig.confirmations)
}

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            await createMockPriceFeedAggregator(PriceFeedKey.ETH.toString(), context)
        },
        async (): Promise<void> => {
            await createMockPriceFeedAggregator(PriceFeedKey.BTC.toString(), context)
        },
    ],
}

export default migration
