/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from "hardhat"
import { Layer } from "../../scripts/common"
import {
    AmmReader,
    ChainlinkL1,
    ClearingHouse,
    ClearingHouseViewer,
    InsuranceFund,
    L2PriceFeed,
    MetaTxGateway,
} from "../../types/ethers"
import { PriceFeedKey } from "../contract/DeployConfig"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"
import { OzContractDeployer } from "../OzContractDeployer"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy metaTxGateway...")
            const chainId = context.settingsDao.getChainId(Layer.Layer1)
            await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .deployUpgradableContract("Perp", "1", chainId)
        },
        async (): Promise<void> => {
            console.log("deploy insuranceFund...")
            await context.factory
                .create<InsuranceFund>(ContractFullyQualifiedName.InsuranceFund)
                .deployUpgradableContract()
        },
        async (): Promise<void> => {
            console.log("deploy L2PriceFeed")
            const chainlinkAddr = context.factory.create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1).address
            await context.factory
                .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
                .deployUpgradableContract(chainlinkAddr!)
        },
        async (): Promise<void> => {
            console.log("set L2PriceFeed in ChainlinkL1")
            const l2PriceFeedAddr = context.systemMetadataDao.getContractMetadata(
                Layer.Layer1,
                ContractName.L2PriceFeed,
            ).address
            const chainlinkL1 = await context.factory
                .create<ChainlinkL1>(ContractFullyQualifiedName.ChainlinkL1)
                .instance()
            await (await chainlinkL1.setPriceFeedL2(l2PriceFeedAddr)).wait()
        },
        async (): Promise<void> => {
            console.log("deploy clearing house...")
            const insuranceFundContract = context.factory.create<InsuranceFund>(
                ContractFullyQualifiedName.InsuranceFund,
            )
            const metaTxGatewayContract = context.factory.create<MetaTxGateway>(
                ContractFullyQualifiedName.MetaTxGateway,
            )
            await context.factory
                .create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
                .deployUpgradableContract(
                    context.deployConfig.initMarginRequirement,
                    context.deployConfig.maintenanceMarginRequirement,
                    context.deployConfig.liquidationFeeRatio,
                    insuranceFundContract.address!,
                    metaTxGatewayContract.address!,
                )
        },
        async (): Promise<void> => {
            console.log("metaTxGateway.addToWhitelists...")
            const clearingHouse = context.factory.create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
            const metaTxGateway = await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .instance()
            await (await metaTxGateway.addToWhitelists(clearingHouse.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("insuranceFundContract.setBeneficiary...")
            const clearingHouse = context.factory.create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
            const insuranceFund = await context.factory
                .create<InsuranceFund>(ContractFullyQualifiedName.InsuranceFund)
                .instance()
            await (await insuranceFund.setBeneficiary(clearingHouse.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("clearingHouse add arb to whitelist...")
            const clearingHouse = await context.factory
                .create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
                .instance()
            await (
                await clearingHouse.setWhitelist(context.settingsDao.getExternalContracts(Layer.Layer2).arbitrageur!)
            ).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("deploy ETHUSDC amm...")
            const ammName = AmmInstanceName.ETHUSDC
            const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
            const ammContract = context.factory.createAmm(ammName, ContractFullyQualifiedName.Amm)
            const quoteTokenAddr = context.externalContract.usdc!
            await ammContract.deployUpgradableContract(
                context.deployConfig.legacyAmmConfigMap[ammName].deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log("deploy BTCUSDC amm...")
            const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
            const ammName = AmmInstanceName.BTCUSDC
            const ammContract = context.factory.createAmm(ammName, ContractFullyQualifiedName.Amm)
            const quoteTokenAddr = context.externalContract.usdc!
            await ammContract.deployUpgradableContract(
                context.deployConfig.legacyAmmConfigMap[ammName].deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log("deploy clearingHouseViewer...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.ClearingHouse,
            )
            const clearingHouseViewerContract = context.factory.create<ClearingHouseViewer>(
                ContractFullyQualifiedName.ClearingHouseViewer,
            )
            await clearingHouseViewerContract.deployImmutableContract(clearingHouseContract.address!)
        },
        async (): Promise<void> => {
            console.log("deploy ammReader...")
            const ammReaderContract = context.factory.create<AmmReader>(ContractFullyQualifiedName.AmmReader)
            await ammReaderContract.deployImmutableContract()
        },
        async (): Promise<void> => {
            console.log("add ETH aggregators to L2PriceFeed")
            const l2PriceFeed = await context.factory
                .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
                .instance()
            await (await l2PriceFeed.addAggregator(ethers.utils.formatBytes32String(PriceFeedKey.ETH.toString()))).wait(
                context.deployConfig.confirmations,
            )
        },
        async (): Promise<void> => {
            console.log("add BTC aggregators to L2PriceFeed")
            const l2PriceFeed = await context.factory
                .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
                .instance()
            await (await l2PriceFeed.addAggregator(ethers.utils.formatBytes32String(PriceFeedKey.BTC.toString()))).wait(
                context.deployConfig.confirmations,
            )
        },
        async (): Promise<void> => {
            console.log("set ETH amm Cap...")
            const amm = await context.factory
                .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = context.deployConfig.legacyAmmConfigMap[
                AmmInstanceName.ETHUSDC
            ].properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("ETH amm.setCounterParty...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.ClearingHouse,
            )
            const amm = await context.factory
                .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("insuranceFund.add ETH amm...")
            const insuranceFundContract = context.factory.create<InsuranceFund>(
                ContractFullyQualifiedName.InsuranceFund,
            )
            const ammContract = context.factory.createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
            const insuranceFund = await insuranceFundContract.instance()
            await (await insuranceFund.addAmm(ammContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("set BTC amm Cap...")
            const amm = await context.factory
                .createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = context.deployConfig.legacyAmmConfigMap[
                AmmInstanceName.BTCUSDC
            ].properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("BTC amm.setCounterParty...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.ClearingHouse,
            )
            const amm = await context.factory
                .createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("insuranceFund.add BTC amm...")
            const insuranceFundContract = context.factory.create<InsuranceFund>(
                ContractFullyQualifiedName.InsuranceFund,
            )
            const ammContract = context.factory.createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
            const insuranceFund = await insuranceFundContract.instance()
            await (await insuranceFund.addAmm(ammContract.address!)).wait(context.deployConfig.confirmations)
        },
        // async (): Promise<void> => {
        //     console.log("l2priceFeed setChainlink...")
        //     const l2PriceFeed = await context.factory
        //         .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
        //         .instance()
        //     await (
        //         await l2PriceFeed!.setChainlink(
        //             context.systemMetadataDao.getContractMetadata(Layer.Layer1, ContractName.ChainlinkL1).address,
        //         )
        //     ).wait(context.deployConfig.confirmations)
        // },
        async (): Promise<void> => {
            console.log("opening Amm ETHUSDC...")
            const ethUsdc = await context.factory
                .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await ethUsdc.setOpen(true)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("opening Amm BTCUSDC...")
            const btcUsdc = await context.factory
                .createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await btcUsdc.setOpen(true)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring metaTxGateway's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const metaTxGateway = await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .instance()
            await (await metaTxGateway.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring insuranceFund's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const insuranceFund = await context.factory
                .create<InsuranceFund>(ContractFullyQualifiedName.InsuranceFund)
                .instance()
            await (await insuranceFund.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring l2PriceFeed's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const l2PriceFeed = await context.factory
                .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
                .instance()
            await (await l2PriceFeed.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring clearingHouse's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const clearingHouse = await context.factory
                .create<ClearingHouse>(ContractFullyQualifiedName.ClearingHouse)
                .instance()
            await (await clearingHouse.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring ETHUSDC owner to governance=${gov}...please remember to claim the ownership`)
            const ETHUSDC = await context.factory
                .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await ETHUSDC.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring BTCUSDC owner to governance=${gov}...please remember to claim the ownership`)
            const BTCUSDC = await context.factory
                .createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.Amm)
                .instance()
            await (await BTCUSDC.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            if (context.settingsDao.inSameLayer()) {
                return
            }
            const governance = context.externalContract.foundationGovernance!
            await OzContractDeployer.transferProxyAdminOwnership(governance)
        },
    ],
}

export default migration
