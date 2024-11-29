import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData, CurveCalculator } from '@raydium-io/raydium-sdk-v2'
import { initSdk } from '../v2config'
import BN from 'bn.js'
import { isValidCpmm } from './utils'
import { NATIVE_MINT } from '@solana/spl-token'
import { printSimulateInfo } from '../util'
import { Connection, Keypair, clusterApiUrl, Signer, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { web3, Wallet } from "@project-serum/anchor";
import bs58 from 'bs58'
import * as splToken from "@solana/spl-token";
import fs from 'fs';
import solanaWeb3 from '@solana/web3.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

var connection = new Connection('https://api.mainnet-beta.solana.com', "confirmed");

const masterWalletPrivKey = process.env.PRIVATE_KEY as string;



export const swapNARAtoSOL = async (input: string, privKey: string) => {
    try {
        const raydium = await initSdk(privKey)

        // SOL - NARA pool
        const poolId = 'BkTTZ5K2QJUtDyRhFfbTHMQ5B9XK5tm4dvEcJf9HZAK4'
        // const inputAmount = new BN('2000000000000000')
        const inputAmount = new BN(input)
        const inputMint = "2u9ZQVaSTVxCBVoyw75QioxivBnhLkCsJzvFTR8oGjAH" //NARA
      
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
                units: 710000,
                microLamports: 5859150,
            },
        })
      
        // printSimulateInfo()
        const { txId } = await execute({ sendAndConfirm: true })
        console.log(`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`, {
            txId: `https://explorer.solana.com/tx/${txId}`,
        })

        return swapResult.destinationAmountSwapped.toString();

    } catch (error) {
        console.error(error)
    }
}

async function swapSOLtoNARA(input: string, privKey: string) {
    try {
        const raydium = await initSdk(privKey)

        // SOL - NARA pool
        const poolId = 'BkTTZ5K2QJUtDyRhFfbTHMQ5B9XK5tm4dvEcJf9HZAK4'
        // const inputAmount = new BN('100000') // 0.0001 SOL
        const inputAmount = new BN(input)
        const inputMint = NATIVE_MINT.toBase58()
      
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
      
        const { execute } = await raydium.cpmm.swap({
            poolInfo,
            poolKeys,
            inputAmount,
            swapResult,
            slippage: 0.001,
            baseIn,
            computeBudgetConfig: {
                units: 700000,
                microLamports: 5759150,
            },
        })
      
        // printSimulateInfo()
        const { txId } = await execute({ sendAndConfirm: true })
        console.log(`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`, {
            txId: `https://explorer.solana.com/tx/${txId}`,
        })

        return swapResult.destinationAmountSwapped.toString();

    } catch (error) {
        console.error(error)
    }
}

async function transferSOL(fromPrivKey: string, to: string, amount: number){
    try {
        console.log("Transferring SOL to", to, "Amount:", amount);

        // const connection = new Connection('https://api.mainnet-beta.solana.com', "confirmed")
        const owner = Keypair.fromSecretKey(bs58.decode((fromPrivKey as string)))  
        const fromWallet = new Wallet(owner)

        const destPublicKey = new PublicKey(to);
        
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromWallet.publicKey,
                toPubkey: destPublicKey,
                lamports: amount,
            })
        );

        transaction.feePayer = fromWallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        await transaction.sign(fromWallet.payer);

        const txId = await connection.sendTransaction(transaction, [fromWallet.payer], { skipPreflight: false });
        console.log("Transaction Signature:", txId);        

        await connection.confirmTransaction(txId);

        console.log("Transfer complete");
    } catch (error) {
        console.log(error);
    }
}

async function transferNARA(NARAMintAddress: string, fromPrivKey: string, toAddress: string, amount: any){
    try {
        console.log("transfering token");
        const mintPublicKey = new web3.PublicKey(NARAMintAddress);  
        const {TOKEN_PROGRAM_ID} = splToken

        // const connection = new Connection('https://api.mainnet-beta.solana.com', "confirmed")
        const owner = Keypair.fromSecretKey(bs58.decode((fromPrivKey as string)))  
        const fromWallet = new Wallet(owner)
      
        const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
          connection,
          fromWallet.payer,
          mintPublicKey,
          fromWallet.publicKey
        );
      
        const destPublicKey = new web3.PublicKey(toAddress);  
        const associatedDestinationTokenAddr = await splToken.getOrCreateAssociatedTokenAccount(
          connection,
          fromWallet.payer,
          mintPublicKey,
          destPublicKey
        );
      
        const receiverAccount = await connection.getAccountInfo(associatedDestinationTokenAddr.address); 
        
        const instructions: web3.TransactionInstruction[] = [];   
        
        instructions.push(
          splToken.createTransferInstruction(
            fromTokenAccount.address,
            associatedDestinationTokenAddr.address,
            fromWallet.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      
        const transaction = new web3.Transaction().add(...instructions); 
  
        const sign: Signer[] = [fromWallet.payer];
  
        transaction.feePayer = fromWallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        transaction.sign(...sign);
        
        const txId = await connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: false }
        );
    
        console.log("transactionSignature", txId);
      
        await connection.confirmTransaction(txId);
    
        console.log("transfer complete");
      } catch (error) {
        console.log(error);
      }    
}

function generateWallet() {
    const keypair = solanaWeb3.Keypair.generate();

    const publicKey = keypair.publicKey.toString();
    const secretKey = Array.from(keypair.secretKey);
    
    const secretKeyBase58 = bs58.encode(keypair.secretKey);

    const walletData = {
        publicKey,
        secretKey: {
            uint8: secretKey,
            base58: secretKeyBase58,
        },
    };

    let existingData = [];
    const filePath = 'wallet_keys.json';

    if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf-8');
        existingData = JSON.parse(fileContents);
    }

    existingData.push(walletData);
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    return walletData;
}

async function generateRandomWallets(count: number): Promise<string[]> {
    const wallets = [];
    for (let i = 0; i < count; i++) {
        const wallet = generateWallet();
        wallets.push(wallet);
    }
    //@ts-ignore
    return wallets;
}

async function distributeTokens(
    privateKey: string, 
    amount: string, 
    maxDepth: number, 
    currentDepth: number = 0, 
    isNaraToSol: boolean = true
): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
        const swapResult = isNaraToSol 
            ? await swapNARAtoSOL(amount, privateKey) 
            : await swapSOLtoNARA(amount, privateKey);

        if (!swapResult) throw new Error(`Failed to swap ${isNaraToSol ? 'NARA to SOL' : 'SOL to NARA'}`);

        const swappedAmount = parseFloat(swapResult);

        console.log(`Distributing ${swappedAmount} tokens at depth ${currentDepth}...`);

        const keepPercentage = Math.random() * 0.02 + 0.01; // 1-3%
        const keepAmount = swappedAmount * keepPercentage;
        const distributeAmount = swappedAmount - keepAmount;

        const newWallets = await generateRandomWallets(3);

        const distributionShares = [
            Math.random(), 
            Math.random(), 
            Math.random()
        ];
        const totalShare = distributionShares.reduce((a, b) => a + b, 0);

        console.log(`Distributing ${distributeAmount} tokens to 3 wallets...`);
        console.log("Distribution shares:", distributionShares);

        for (let i = 0; i < newWallets.length; i++) {
            const wallet = newWallets[i];
            const walletShare = distributionShares[i] / totalShare;
            const walletAmount = Math.floor(distributeAmount * walletShare);

            await delay(30000);

            if (isNaraToSol) {
                //@ts-ignore
                await transferSOL(privateKey, wallet.publicKey, walletAmount);
            } else {
                 // Transfer SOL to new wallet for gas
                 //@ts-ignore
                await transferSOL(privateKey, wallet.publicKey, 6000000);

                await transferNARA(
                    "2u9ZQVaSTVxCBVoyw75QioxivBnhLkCsJzvFTR8oGjAH", 
                    privateKey, 
                    //@ts-ignore
                    wallet.publicKey, 
                    walletAmount
                );
            }

            // need to optimize more, recursive calling not good for many cycles
            await distributeTokens(
            //@ts-ignore
                wallet.secretKey.base58, 
                walletAmount.toString(), 
                maxDepth, 
                currentDepth + 1, 
                !isNaraToSol
            );

            await delay(30000);
        }
    } catch (error) {
        console.error(`Distribution error at depth ${currentDepth}:`, error);
    }
}

const initialPrivateKey = masterWalletPrivKey;
const initialAmount = "10000000000000"; // initial amount NARA
const depth = 2; // Number of cycles

distributeTokens(initialPrivateKey, initialAmount, depth, 0, true).then(() => {
    console.log("Token distribution completed.");
}).catch((error) => {
    console.error("An error occurred during distribution:", error);
});


// swapNARAtoSOL("5000000000000000", masterWalletPrivKey)
// swapSOLtoNARA("100000", masterWalletPrivKey)
// transferSOL(masterWalletPrivKey, "4g8aJK5JjCozPv4GwF43Dp2bLW8c6yzK8xjs2XqRKyoY", 100000)
// transferNARA("2u9ZQVaSTVxCBVoyw75QioxivBnhLkCsJzvFTR8oGjAH", masterWalletPrivKey, "4g8aJK5JjCozPv4GwF43Dp2bLW8c6yzK8xjs2XqRKyoY", 100000000000)