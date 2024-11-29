import { ApiV3PoolInfoStandardItem, AmmV4Keys, AmmRpcData } from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from '../config'
import BN from 'bn.js'
import { isValidAmm } from './utils'
import Decimal from 'decimal.js'
import { NATIVE_MINT } from '@solana/spl-token'
import { printSimulateInfo } from '../util'
import { Connection, Keypair, clusterApiUrl, Signer } from '@solana/web3.js'
import bs58 from 'bs58'
import * as splToken from "@solana/spl-token";
import { web3, Wallet } from "@project-serum/anchor";
import 'dotenv/config'

const connection = new Connection('https://api.mainnet-beta.solana.com', "confirmed")

const owner = Keypair.fromSecretKey(bs58.decode((process.env.PRIVATE_KEY as string)))

const wallet = new Wallet(owner)

transfer("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", wallet, "8RrKCuR8CkoBorq6zvRAX9Q9EYqqUtQcgbkbamSJV8NN", connection, 1000)



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

      const sign: Signer[] = [wallet.payer];

      transaction.feePayer = wallet.publicKey;
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


