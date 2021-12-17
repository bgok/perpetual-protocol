/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BigNumber } from "ethers"
import { ethers } from "hardhat"
import { Amm, IPriceFeed } from "../../types/ethers"
import { ContractWrapper } from "./ContractWrapper"
import { AmmDeployArgs } from "./DeployConfig"

async function fetchPrice(feedAddress: string, feedKey: string): Promise<BigNumber> {
    // FIXME
    // const priceContract = (await ethers.getContractAt("IPriceFeed", feedAddress)) as IPriceFeed
    // try {
    //     return priceContract.getPrice(feedKey)
    // } catch {
    //     throw new Error("Wrong price feed address or key")
    // }
    let rate:BigNumber
    switch (feedKey) {
        case "ETH":
            rate = BigNumber.from(4000).mul(BigNumber.from(10).pow(18))
            break;
        case "BTC":
            rate = BigNumber.from(48000).mul(BigNumber.from(10).pow(18))
            break
        default:
            throw new Error("Unknown symbol")
    }

    return Promise.resolve(rate)
}

export class AmmContractWrapper extends ContractWrapper<Amm> {
    async deployUpgradableContract(
        ammDeployArgs: AmmDeployArgs,
        priceFeedAddress: string,
        quoteAssetAddress: string,
    ): Promise<Amm> {
        const {
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            fluctuation,
            priceFeedKey,
            tollRatio,
            spreadRatio,
        } = ammDeployArgs

        const priceFeedKeyBytes = ethers.utils.formatBytes32String(priceFeedKey.toString())
        // FIXME
        // const priceInWei = await fetchPrice(priceFeedAddress, priceFeedKeyBytes)
        const priceInWei = await fetchPrice(priceFeedAddress, priceFeedKey.toString())
        const updatedQuoteAssetReserve = baseAssetReserve.mul(priceInWei).div(BigNumber.from(10).pow(18))

        const args = [
            updatedQuoteAssetReserve.toString(),
            baseAssetReserve.toString(),
            tradeLimitRatio.toString(),
            fundingPeriod.toString(),
            priceFeedAddress,
            priceFeedKeyBytes.toString(),
            quoteAssetAddress.toString(),
            fluctuation.toString(),
            tollRatio.toString(),
            spreadRatio.toString(),
        ]
        return super.deployUpgradableContract(...args)
    }
}
