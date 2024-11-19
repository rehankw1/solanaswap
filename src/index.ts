import RaydiumSwap from './RaydiumSwap';
import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig'; // Import the configuration

/**
 * Performs a token swap on the Raydium protocol.
 * Depending on the configuration, it can execute the swap or simulate it.
 */
const swap = async () => {
  /**
   * The RaydiumSwap instance for handling swaps.
   */
  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, process.env.WALLET_PRIVATE_KEY);
  console.log(`Raydium swap initialized`);
  console.log(`Swapping ${swapConfig.tokenAAmount} of ${swapConfig.tokenAAddress} for ${swapConfig.tokenBAddress}...`)

  /**
   * Load pool keys from the Raydium API to enable finding pool information.
   */
  await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  console.log(`Loaded pool keys`);

  /**
   * Find pool information for the given token pair.
   */
  const poolInfo = raydiumSwap.findPoolInfoForTokens(swapConfig.tokenAAddress, swapConfig.tokenBAddress);
  if (!poolInfo) {
    console.error('Pool info not found');
    return 'Pool info not found';
  } else {
    console.log('Found pool info');
  }

  /**
   * Prepare the swap transaction with the given parameters.
   */
  const tx = await raydiumSwap.getSwapTransaction(
    swapConfig.tokenBAddress,
    swapConfig.tokenAAmount,
    poolInfo,
    swapConfig.maxLamports, 
    swapConfig.useVersionedTransaction,
    swapConfig.direction
  );

  console.log(tx);

  /**
   * Depending on the configuration, execute or simulate the swap.
   */
  if (swapConfig.executeSwap) {
    /**
     * Send the transaction to the network and log the transaction ID.
     */
    const txid = swapConfig.useVersionedTransaction
      ? await raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
      : await raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);

    console.log(`https://solscan.io/tx/${txid}`);

    //after swap complete, transfer the recieved token to a new wallet
    // await transferTokensAfterSwap(raydiumSwap);

  } else {
    /**
     * Simulate the transaction and log the result.
     */
    const simRes = swapConfig.useVersionedTransaction
      ? await raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
      : await raydiumSwap.simulateLegacyTransaction(tx as Transaction);

    console.log(simRes);
  }
};

const transferTokensAfterSwap = async (raydiumSwap: RaydiumSwap) => {
  try {
    const connection = raydiumSwap.connection;
    const fromWallet = raydiumSwap.wallet.publicKey;
    const destinationWallet = new PublicKey(process.env.DESTINATION_WALLET);
    const tokenMintAddress = new PublicKey(swapConfig.tokenBAddress);

    // Get the token balance
    const tokenBalance = await raydiumSwap.getTokenBalance(
      connection,
      fromWallet,
      tokenMintAddress
    );

    if (tokenBalance > BigInt(0)) {
      // Create transfer transaction
      const transferTx = await raydiumSwap.createTokenTransferTransaction(
        connection,
        fromWallet,
        destinationWallet,
        tokenMintAddress,
        tokenBalance
      );

      // Sign the transaction using the wallet's secret key
      const signedTx = await raydiumSwap.wallet.signTransaction(transferTx);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);

      console.log(`Transferred ${tokenBalance} tokens. Tx: https://solscan.io/tx/${signature}`);
    } else {
      console.log('No tokens to transfer');
    }
  } catch (error) {
    console.error('Error transferring tokens:', error);
  }
};

swap();
