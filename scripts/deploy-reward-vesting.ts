import { ethers, upgrades } from "hardhat"
import { ContractFullyQualifiedName } from "../publish/ContractName"

async function main() {
    const perpAddress = "0x0078371BDeDE8aAc7DeBfFf451B74c5EDB385Af7" // Fixme Get this from the metadata file
    const Vesting = await ethers.getContractFactory(ContractFullyQualifiedName.PerpRewardVesting)
    const instance = await upgrades.deployProxy(Vesting, [perpAddress])
    await instance.deployed()
}

main()
