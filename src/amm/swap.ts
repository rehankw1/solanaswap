import { ApiV3PoolInfoStandardItem, AmmV4Keys, AmmRpcData } from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from '../config'
import BN from 'bn.js'
import { isValidAmm } from './utils'
import Decimal from 'decimal.js'
import { NATIVE_MINT } from '@solana/spl-token'
import { printSimulateInfo } from '../util'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import bs58 from 'bs58'
import * as splToken from "@solana/spl-token";
import { web3, Wallet } from "@project-serum/anchor";
import 'dotenv/config'



export const swap = async () => {

  const raydium = await initSdk()
  const amountIn = 100000 // 0.0001 SOL
  const inputMint = NATIVE_MINT.toBase58()
  const poolId = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' // SOL-USDC pool

  let poolInfo: ApiV3PoolInfoStandardItem | undefined
  let poolKeys: AmmV4Keys | undefined
  let rpcData: AmmRpcData

  if (raydium.cluster === 'mainnet') {
    // note: api doesn't support get devnet pool info, so in devnet else we go rpc method
    // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoStandardItem
    if (!isValidAmm(poolInfo.programId)) throw new Error('target pool is not AMM pool')
    poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId)
    rpcData = await raydium.liquidity.getRpcPoolInfo(poolId)
  } else {
    // note: getPoolInfoFromRpc method only return required pool data for computing not all detail pool info
    const data = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
    rpcData = data.poolRpcData
  }
  const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

  if (poolInfo.mintA.address !== inputMint && poolInfo.mintB.address !== inputMint)
    throw new Error('input mint does not match pool')

  const baseIn = inputMint === poolInfo.mintA.address
  const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amountIn),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
  })

  console.log(
    `computed swap ${new Decimal(amountIn)
      .div(10 ** mintIn.decimals)
      .toDecimalPlaces(mintIn.decimals)
      .toString()} ${mintIn.symbol || mintIn.address} to ${new Decimal(out.amountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)
      .toString()} ${mintOut.symbol || mintOut.address}, minimum amount out ${new Decimal(out.minAmountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
  )

  const { execute } = await raydium.liquidity.swap({
    poolInfo,
    poolKeys,
    amountIn: new BN(amountIn),
    amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
    fixedSide: 'in',
    inputMint: mintIn.address,
    txVersion,

    // optional: set up token account
    // config: {
    //   inputUseSolBalance: true, // default: true, if you want to use existed wsol token account to pay token in, pass false
    //   outputUseSolBalance: true, // default: true, if you want to use existed wsol token account to receive token out, pass false
    //   associatedOnly: true, // default: true, if you want to use ata only, pass true
    // },

    // optional: set up priority fee here
    computeBudgetConfig: {
      units: 600000,
      microLamports: 46591500,
    },
  })

  printSimulateInfo()
  // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute

  // const { txId } = await execute({ sendAndConfirm: true }) //uncomment this to execute swap

  // console.log(`swap successfully in amm pool:`, { txId: `https://explorer.solana.com/tx/${txId}` })


  //now transfer the token to another account
  const connection = new Connection('https://responsive-nameless-shard.solana-devnet.quiknode.pro/f985c1f24f91c95c23513b4bf4dd1ec1f7b6df9d', "finalized")

  const owner = Keypair.fromSecretKey(bs58.decode((process.env.PRIVATE_KEY as string)))

  const wallet = new Wallet(owner)
  await transfer("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", wallet, "8RrKCuR8CkoBorq6zvRAX9Q9EYqqUtQcgbkbamSJV8NN", connection, 100000)
  

  process.exit() // if you don't want to end up node execution, comment this line
}

async function transfer(tokenMintAddress: string, wallet: Wallet, to: string, connection: web3.Connection, amount: any) {
  try {
    console.log("transfering token");
    const mintPublicKey = new web3.PublicKey(tokenMintAddress);  
    const {TOKEN_PROGRAM_ID} = splToken
  
    const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mintPublicKey,
      wallet.publicKey
    );

    console.log("fromTokenAccount", fromTokenAccount.address.toBase58());


    const destPublicKey = new web3.PublicKey(to);  
    const associatedDestinationTokenAddr = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mintPublicKey,
      destPublicKey
    );   
  
    const receiverAccount = await connection.getAccountInfo(associatedDestinationTokenAddr.address);          
    const instructions: web3.TransactionInstruction[] = [];   
    
    instructions.push(
      splToken.createTransferInstruction(
        fromTokenAccount.address,
        associatedDestinationTokenAddr.address,
        wallet.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  
    const transaction = new web3.Transaction().add(...instructions);
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    
    const transactionSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: true }
    );

    console.log("transactionSignature", transactionSignature);
  
    await connection.confirmTransaction(transactionSignature);

    console.log("transfer complete");
  } catch (error) {
    console.log(error);
  }


}

/** uncomment code below to execute */
swap()
