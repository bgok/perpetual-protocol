/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { MigrationContext, MigrationDefinition } from "../Migration"
import { ContractFullyQualifiedName } from "../ContractName"
import { ChainlinkL1 } from "../../types/ethers"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy chainlink price feed on layer 1...")
            await context.factory
                .create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1)
                .deployUpgradableContract()
        },
    ],
}

export default migration
