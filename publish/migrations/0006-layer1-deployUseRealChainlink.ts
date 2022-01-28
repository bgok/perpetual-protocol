/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from "ethers"
import { ChainlinkL1 } from "../../types/ethers"
import { PriceFeedKey } from "../contract/DeployConfig"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

async function useRealChainlinkAggregator(priceFeedKey: string, context: MigrationContext) {
    const chainlink = await context.factory
        .create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1)
        .instance()
    try {
        const rcpt = await chainlink.removeAggregator(ethers.utils.formatBytes32String(priceFeedKey))
        await rcpt.wait()
        console.log(`Previously registered ${priceFeedKey} Aggregator was removed`)
    } catch (e) {
        console.log(`no ${priceFeedKey} Aggregator was previously registered`)
    }

    console.log("Register the real aggregator")
    const address = context.deployConfig.chainlinkMap[priceFeedKey]
    console.log("Aggregator address:", address.toString())
    const rcpt = await chainlink.addAggregator(ethers.utils.formatBytes32String(priceFeedKey), address)
    await rcpt.wait(context.deployConfig.confirmations)
}

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            await useRealChainlinkAggregator(PriceFeedKey.ETH.toString(), context)
        },
        async (): Promise<void> => {
            await useRealChainlinkAggregator(PriceFeedKey.BTC.toString(), context)
        },
    ],
}

export default migration
