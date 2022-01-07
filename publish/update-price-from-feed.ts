import { Contract, ethers } from "ethers"
import { Fragment, JsonFragment } from "@ethersproject/abi"
import { ChainlinkL1 } from "../types/ethers"
import { artifacts } from "hardhat"
import { ContractFullyQualifiedName, ContractName } from "./ContractName"
import { SettingsDao } from "./SettingsDao"
import { SystemMetadataDao } from "./SystemMetadataDao"
import { Layer, Network } from "../scripts/common"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

// const provider = new ethers.providers.JsonRpcProvider(TBSC_URL)

// string | Array<Fragment | JsonFragment | string> | Interface;
function instance(address: string, abi: Array<string | Fragment | JsonFragment>, signer: SignerWithAddress): Contract {
    return new ethers.Contract(address, abi, signer) as Contract
}

const BTC = web3.utils.asciiToHex("BTC".padEnd(32, "\0"))

export async function updatePriceFromFeed(env: HardhatRuntimeEnvironment) {
    const network = env.network.name as Network

    console.log(network)

    const settingsDao = new SettingsDao("staging")
    const systemMetadataDao = new SystemMetadataDao(settingsDao)

    const metadata = systemMetadataDao.getContractMetadata(Layer.Layer1, ContractName.ChainlinkL1)
    const address = metadata.address
    const artifact = await artifacts.readArtifact(ContractFullyQualifiedName.ChainlinkL1)
    // console.log(JSON.stringify(artifact.abi.filter(i => i.name === 'updateLatestRoundData')))
    // console.log(JSON.stringify(artifact.abi))

    //Get signer information
    const accounts = await env.ethers.getSigners()
    const signer = accounts[0]

    const contract = instance(address, artifact.abi, signer) as ChainlinkL1

    // await contract.updateLatestRoundData(web3.utils.asciiToHex("BTC".padEnd(32, '\0')))
    // await contract.updateLatestRoundData(web3.utils.asciiToHex("ETH".padEnd(32, '\0')))

    // AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
    const aggregatorAddress = await contract.getAggregator(BTC)
    const aggABI = [{
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function",
    }, {
        "inputs": [],
        "name": "description",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function",
    }, {
        "inputs": [{ "internalType": "uint80", "name": "_roundId", "type": "uint80" }],
        "name": "getRoundData",
        "outputs": [{ "internalType": "uint80", "name": "roundId", "type": "uint80" }, {
            "internalType": "int256",
            "name": "answer",
            "type": "int256",
        }, { "internalType": "uint256", "name": "startedAt", "type": "uint256" }, {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256",
        }, { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }],
        "stateMutability": "view",
        "type": "function",
    }, {
        "inputs": [],
        "name": "latestRoundData",
        "outputs": [{ "internalType": "uint80", "name": "roundId", "type": "uint80" }, {
            "internalType": "int256",
            "name": "answer",
            "type": "int256",
        }, { "internalType": "uint256", "name": "startedAt", "type": "uint256" }, {
            "internalType": "uint256",
            "name": "updatedAt",
            "type": "uint256",
        }, { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }],
        "stateMutability": "view",
        "type": "function",
    }, {
        "inputs": [],
        "name": "version",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function",
    }]
    const aggregatorContract = instance(aggregatorAddress, aggABI, signer)

    // (uint80 roundId, int256 price, , uint256 timestamp, ) = aggregator.latestRoundData();
    const [roundId, price, , timestamp] = await aggregatorContract.latestRoundData()

    console.log(roundId.toString(), price.toString(), timestamp.toString())

    // bytes32 messageId = rootBridge.updatePriceFeed(priceFeedL2Address, _priceFeedKey, decimalPrice, timestamp, roundId)
    const rbMetadata = systemMetadataDao.getContractMetadata(Layer.Layer1, ContractName.RootBridge)
    const rbAddress = rbMetadata.address
    const rbArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.RootBridge)
    const rbContract = instance(rbAddress, rbArtifact.abi, signer)

    const pfMetadata = systemMetadataDao.getContractMetadata(Layer.Layer2, ContractName.L2PriceFeed)
    const pfAddress = pfMetadata.address

    const result = await rbContract.updatePriceFeed(pfAddress, BTC, price, timestamp, roundId)
    console.log(result)

}
