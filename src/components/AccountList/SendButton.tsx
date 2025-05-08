import {useState,useRef,useEffect} from 'react';
import { Popup,NavBar,Input,Button } from 'antd-mobile';
import { LocationOutline,LeftOutline } from 'antd-mobile-icons';
import styles from './sendButton.module.css';
import { ReactComponent as SpToken } from './assets/sp-token.svg';
// import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
// import Bs58 from "bs58";
// import { ethers } from 'ethers';

interface SendParams {
    type: string; 
    balance: number;
    usd:number;
    wallet:any;
    isEthers:boolean;
}


const SendButton=({ type,wallet,balance,usd,isEthers }: SendParams)=> {
    const [visible, setVisible] = useState(false);
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState<string | undefined>();

    const useMax=()=>{
        setAmount(balance+'');
    }
    // const getAddress = (wallet: any) => {
    //     if (isEthers) {
    //       return ethers.getAddress(wallet?.keyID);
    //     }
    //     return wallet?.keyID;
    // }
    /**
         * 向 Solana 钱包转账 SOL
         * 
         * @param fromBase58PrivateKey - 发起人钱包的 Base58 私钥
         * @param toPublicKeyString - 收款人地址（base58 格式）
         * @param amountSol - 转账金额（单位为 SOL）
         * @param rpcUrl - Solana 网络 RPC URL（如：https://api.mainnet-beta.solana.com）
    */
    // const transferSolanaSOL=async(fromBase58PrivateKey: string, toPublicKeyString: string, amountSol: number, rpcUrl: string)=> {
    //       try {
    //         // 解码私钥并创建 Keypair
    //         const fromKeypair = Keypair.fromSecretKey(Bs58.decode(fromBase58PrivateKey));
            
    //         // 创建连接
    //         const connection = new Connection(rpcUrl, "confirmed");

    //         // 构建交易
    //         const transaction = new Transaction().add(
    //           SystemProgram.transfer({
    //             fromPubkey: fromKeypair.publicKey,
    //             toPubkey: new PublicKey(toPublicKeyString),
    //             lamports: amountSol * LAMPORTS_PER_SOL, // 转换为 lamports
    //           })
    //         );

    //         // 发送并确认交易
    //         const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);

    //         console.log("✅ 交易成功，签名:", signature);
    //         return signature;
    //       } catch (error) {
    //         console.error("❌ 转账失败:", error);
    //         throw error;
    //       }
    // }
    const handleSend=()=>{
        // let toPublicKeyString = getAddress(wallet);
        // console.log(randomSolanaRPC,'randomSolanaRPC')
        //transferSolanaSOL(wallet?.privateKeyArmor,toPublicKeyString,(amount?amount-0:0),randomSolanaRPC)
    }



    return (
        <>
            <div className={styles.sendBtn} onClick={() => {setVisible(true)}}>
                <LocationOutline className={styles.sendIcon} />
                <span className={styles.text}>Send</span>
            </div>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100vw',backgroundColor:'#0d0d0d' }}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>Send {type}</NavBar>
                    <div className={styles.logo}><SpToken width={100} height={100}/></div>
                    <div className={styles.form}>
                        <div className={styles.addressInput}>
                            <Input
                                placeholder="Recipient's Solana address"
                                value={address}
                                onChange={val => {setAddress(val)}}
                            />
                        </div>
                        <div className={styles.amountInput}>
                            <Input
                                type="number"
                                min={0}
                                max={balance}
                                placeholder="Amount"
                                value={amount}
                                onChange={val => {setAmount(val)}}
                            />
                            <div className={styles.unit}>{type}</div>
                            <div className={styles.max} onClick={useMax}>Max</div>
                        </div>
                        <div className={styles.extraInfo}>
                            <div className={styles.usval}>${usd}</div>
                            <div className={styles.available}>Available {balance}</div>
                        </div>
                        <div className={styles.oper}><Button block color='primary' size='large' disabled={!(address&&amount)} onClick={handleSend}>Confirm</Button></div>
                    </div>
                </div>
            </Popup>
        </>
    );
}


export default SendButton;