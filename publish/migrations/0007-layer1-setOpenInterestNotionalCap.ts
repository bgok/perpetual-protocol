/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"
import { DEFAULT_DIGITS } from "../contract/DeployConfig"

// TODO Before deploy to prod set the corrrect values in DeployConfig.ts and delete this migration

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("set ETH amm Cap...")
            const amm = await context.factory
                .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
                .instance()

            const maxHoldingBaseAsset = DEFAULT_DIGITS.mul(40) // 40 ETH ~= $112K
            const openInterestNotionalCap = DEFAULT_DIGITS.mul(0) // disabled

            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("set BTC amm Cap...")
            const amm = await context.factory
                .createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
                .instance()

            const maxHoldingBaseAsset = DEFAULT_DIGITS.mul(3) // 3 BTC ~= $120K
            const openInterestNotionalCap = DEFAULT_DIGITS.mul(0) // disabled

            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
    ],
}

export default migration
