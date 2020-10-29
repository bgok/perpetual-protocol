// all lower-case, no dash; otherwise AWS deployment might fail
export type Stage = "production" | "staging" | "test"
export type Network = "homestead" | "rinkeby" | "ropsten" | "kovan" | "xdai" | "sokol" | "localhost"
export type Layer = "layer1" | "layer2"

// TODO deprecated
export enum DeployMode {
    Init = "init",
    Upgrade = "upgrade",
}

export interface ContractMetadata {
    name: string
    address: string
}

export interface AccountMetadata {
    privateKey: string
    balance: string
}

export interface EthereumMetadata {
    contracts: Record<string, ContractMetadata>
    accounts: AccountMetadata[]
    network: Network
}

export interface LayerMetadata extends EthereumMetadata {
    externalContracts: ExternalContracts
}

export interface SystemMetadata {
    layers: {
        [key in Layer]?: LayerMetadata
    }
}

export interface ExternalContracts {
    // default is gnosis multisig (old version)
    foundationMultisig?: string

    // default is gnosis multisig safe
    foundationTreasury?: string

    keeper?: string
    arbitrageur?: string

    ambBridgeOnXDai?: string
    ambBridgeOnEth?: string
    multiTokenMediatorOnXDai?: string
    multiTokenMediatorOnEth?: string

    tether?: string
    usdc?: string
    perp?: string

    balancerCrpFactory?: string
    balancerPoolFactory?: string
    balancerPerpUsdcCrp?: string

    testnetFaucet?: string
}

export interface LayerDeploySettings {
    chainId: number
    network: Network
    externalContracts: ExternalContracts
    version: string
}

export interface SystemDeploySettings {
    layers: {
        [key in Layer]?: LayerDeploySettings
    }
}

export const TASK_DEPLOY_LAYER = "deploy:layer"