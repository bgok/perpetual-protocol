import { MigrationContext, MigrationDefinition } from "../Migration"
import { Layer } from "../../scripts/common"
import { ContractFullyQualifiedName, ContractName } from "../ContractName"
import { ChainlinkL1, ClearingHouse, InsuranceFund, MetaTxGateway, RootBridge } from "../../types/ethers"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy debug version of ClearingHouse")
            const insuranceFundContract = context.factory.create<InsuranceFund>(
                ContractFullyQualifiedName.InsuranceFund,
            )
            const metaTxGatewayContract = context.factory.create<MetaTxGateway>(
                ContractFullyQualifiedName.MetaTxGateway,
            )
            await context.factory
                .create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
                .upgradeContract(
                    context.deployConfig.initMarginRequirement,
                    context.deployConfig.maintenanceMarginRequirement,
                    context.deployConfig.liquidationFeeRatio,
                    insuranceFundContract.address!,
                    metaTxGatewayContract.address!,
                )

        },
    ]
}

export default migration