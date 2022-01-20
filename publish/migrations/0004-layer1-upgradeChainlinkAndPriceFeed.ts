/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("Upgrade L2PriceFeed implementation")
            const chainlinkAddress = (await context.factory.create(ContractFullyQualifiedName.ChainlinkL1).instance()).address
            const priceFeed = await context.factory.create(ContractFullyQualifiedName.L2PriceFeed)
            await priceFeed.prepareUpgradeContract(chainlinkAddress)
            await priceFeed.upgradeContract(chainlinkAddress)
        },
        async (): Promise<void> => {
            console.log("Upgrade ChainlinkL2 implementation")
            const chainlinkL1 = await context.factory.create(ContractFullyQualifiedName.ChainlinkL1)
            await chainlinkL1.prepareUpgradeContract()
            await chainlinkL1.upgradeContract()
        },
    ],
}

export default migration
