import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData, CurveCalculator } from '@raydium-io/raydium-sdk-v2'
import { initSdk } from '../config'
import BN from 'bn.js'
import { isValidCpmm } from './utils'
import { NATIVE_MINT } from '@solana/spl-token'
import { printSimulateInfo } from '../util'
import { Connection, Keypair, clusterApiUrl, Signer, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { web3, Wallet } from "@project-serum/anchor";
import bs58 from 'bs58'

export const swap = async (walletAddress: string) => {
    try {
        const raydium = await initSdk()

        // SOL - NARA pool
        const poolId = 'BkTTZ5K2QJUtDyRhFfbTHMQ5B9XK5tm4dvEcJf9HZAK4'
        const inputAmount = new BN('2000000000000000')
        const inputMint = "2u9ZQVaSTVxCBVoyw75QioxivBnhLkCsJzvFTR8oGjAH"
      
        let poolInfo: ApiV3PoolInfoStandardItemCpmm
        let poolKeys: CpmmKeys | undefined
        let rpcData: CpmmRpcData
      
        if (raydium.cluster === 'mainnet') {
            const data = await raydium.api.fetchPoolById({ ids: poolId })
            poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
            if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
            rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true)
        } else {
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
            poolInfo = data.poolInfo
            poolKeys = data.poolKeys
            rpcData = data.rpcData
        }
      
        if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
            throw new Error('input mint does not match pool')
      
        const baseIn = inputMint === poolInfo.mintA.address
      
        // swap pool mintA for mintB
        const swapResult = CurveCalculator.swap(
            inputAmount,
            baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
            baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
            rpcData.configInfo!.tradeFeeRate
        )

        console.log(swapResult.destinationAmountSwapped.toString(), "++++++++++++")
      
        const { execute } = await raydium.cpmm.swap({
            poolInfo,
            poolKeys,
            inputAmount,
            swapResult,
            slippage: 0.001,
            baseIn,
            computeBudgetConfig: {
                units: 700000,
                microLamports: 5659150,
            },
        })
      
        // printSimulateInfo()
        const { txId } = await execute({ sendAndConfirm: true })
        console.log(`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`, {
            txId: `https://explorer.solana.com/tx/${txId}`,
        })

        const connection = new Connection('https://api.mainnet-beta.solana.com', "confirmed")
        const owner = Keypair.fromSecretKey(bs58.decode((process.env.PRIVATE_KEY as string)))  
        const wallet = new Wallet(owner)

        await transferSOL(wallet, walletAddress, connection, swapResult.destinationAmountSwapped.toNumber())

        console.log("\n\n ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ \n\n")

        // process.exit() // if you don't want to end up node execution, comment this line
    } catch (error) {
        console.log(error)
    } 
}

async function transferSOL(wallet: Wallet, to: string, connection: Connection, amount: number){
    try {
        console.log("Transferring SOL to", to, "Amount:", amount);

        const destPublicKey = new PublicKey(to);
        
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: destPublicKey,
                lamports: amount,
            })
        );

        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        await transaction.sign(wallet.payer);

        const txId = await connection.sendTransaction(transaction, [wallet.payer], { skipPreflight: false });
        console.log("Transaction Signature:", txId);        

        await connection.confirmTransaction(txId);

        console.log("Transfer complete");
    } catch (error) {
        console.log(error);
    }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const runSwaps = async () => {
    const walletAddresses = [
        "5K7nBrzzzY1QcMwhbweqSEReYwUFGbs8bEoQJ9YYGFDm",
        "4g8aJK5JjCozPv4GwF43Dp2bLW8c6yzK8xjs2XqRKyoY", // Replace with the second wallet address
    ];

    for (let i = 0; i < 10; i++) {
        const walletAddress = walletAddresses[i % 2]; // Alternate between the two addresses
        // console.log(walletAddress)
        await swap(walletAddress);
        //add a delay of 300 seconds
        await delay(50000);
    }
}

runSwaps();