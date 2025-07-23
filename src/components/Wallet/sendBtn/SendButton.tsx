import {useState,useRef,useEffect,forwardRef,useImperativeHandle} from 'react';
import { Popup,NavBar,Input,Button,SpinLoading,Modal,Result,Ellipsis,Toast,Dialog } from 'antd-mobile';
import { LocationOutline,LeftOutline } from 'antd-mobile-icons';
import styles from './sendButton.module.scss';
import { ReactComponent as SolanaToken } from './../assets/solana-token.svg';
import { ReactComponent as ConetToken } from './../assets/sp-token.svg';
import { ReactComponent as UsdtToken } from './../assets/usdt-token.svg';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, ComputeBudgetProgram, sendAndConfirmRawTransaction } from "@solana/web3.js";
import { createTransferInstruction,getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import Bs58 from "bs58";
import { ethers } from 'ethers';
import {globalAllNodes} from "../../../utils/globals";
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import {openWebLinkNative} from './../../../api';
import { useDaemonContext } from './../../../providers/DaemonProvider';
import {Solana_SOL, Solana_SP, Solana_USDT} from "../../../utils/constants";
import {  getPriceFromUp2Down } from './../../../services/subscription';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  getMint,
} from "@solana/spl-token"

interface SendParams {
    type: string; 
    balance: number|string;
    handleRefreshSolanaBalances:()=>Promise<void>;
    usd?:number;
    wallet:any;
    isEthers:boolean;
    extendref?:any;
}


const SendButton=({ type,wallet,balance,handleRefreshSolanaBalances,usd=0,isEthers,extendref=null }: SendParams)=> {
    const { isIOS, isLocalProxy } = useDaemonContext();
    const [visible, setVisible] = useState(false);
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState<string | undefined>();
    const [subLoading, setSubLoading] = useState(false);
    const [calcPrice, setCalcPrice] = useState('0.00');
    const { t, i18n } = useTranslation();
    const [sp2usdRatio, setSp2usdRatio] = useState(0);
    const [sol2usdRatio, setSol2usdRatio] = useState(0);

    useImperativeHandle(extendref, () => ({
        setExternalAddress: (val: string) => {
            setAddress(val);
        },
        setExternalVisible: (val: boolean) => {
            setVisible(val);
        },
        setExternalAmount: (val: string) => {
            if(Number(val) > convertStringToNumber(balance)){
                Dialog.alert({content: t('wallet-send-useless-tip'),style:{zIndex:1006}})
                setAmount(String(balance));
                return ;
            }
            setAmount(val);
        },
    }));

    useEffect(()=>{
        if(!visible){
            setAddress('');
            setAmount('');
        }
    },[visible])

    useEffect(()=>{
        getRatio();
    },[])

    const removeDollarPrefix = (str:string) => str.startsWith('$') ? str.slice(1) : str;
    const getMintAddr=(type:string)=>{
        switch(type) {
            case 'SP':
                return 'Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump';
                break;
            case 'SOL':
                return 'So11111111111111111111111111111111111111112';
                break;
            case 'USDT':
                return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
                break;
            case 'USDC':
                return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
                break;
            default:
                return '';
        }
    }
    const getRatio=async()=>{
        const SPRatio = await getPriceFromUp2Down(getMintAddr('USDT'),getMintAddr('SP'),100);
        const SOLRatio = await getPriceFromUp2Down(getMintAddr('USDT'),getMintAddr('SOL'),100);
        setSp2usdRatio(SPRatio?(BigNumber(100).dividedBy(BigNumber(SPRatio)).toNumber()):0);
        setSol2usdRatio(SOLRatio?(BigNumber(100).dividedBy(BigNumber(SOLRatio)).toNumber()):0);
    }
    const usdRatio=()=>{
        switch(removeDollarPrefix(type)) {
            case 'SP':
                return sp2usdRatio;
                break;
            case 'SOL':
                return sol2usdRatio;
                break;
            case 'USDT':
                return new BigNumber(1).dividedBy(1);
                break;
            default:
                return '0';
        }
    }
    const renderTag=(type:string)=>{
        switch(type) {
            case 'SP':
                return <ConetToken />;
                break;
            case 'SOL':
                return <SolanaToken />;
                break;
            case 'USDT':
                return <UsdtToken />;
                break;
            default:
                return <ConetToken />;
        }
    }

    const gettNumeric = (token: string) => {
        switch (token) {
            case Solana_USDT:
            case Solana_SP: {
                return 6
            }
            case Solana_SOL: {
                return 9
            }

            default: {
                return 0
            }
        }
    }

    const getTypeToAddr = (type: string) => {
        switch (type) {
            case '$USDT': {
                return Solana_USDT
            }
            case '$SP': {
                return Solana_SP
            }
            default: {
                return ''
            }
            
        }
    }

    const useMax=()=>{
        let valBig=BigNumber(convertStringToNumber(balance));
        let ratio=usdRatio();
        setAmount(convertStringToNumber(balance)+'');
        if(convertStringToNumber(balance)){
            setCalcPrice(BigNumber(ratio).multipliedBy(valBig).toFixed(2));
        }else{
            setCalcPrice('0.00');
        }
    }
    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'Unknown error';
    };
    const convertStringToNumber=(str:string|number): number => {
        const multiplier: Record<'K'|'M'|'B'|'T', number> = {
            'K': 1e3,   // 千
            'M': 1e6,   // 百万
            'B': 1e9,   // 十亿
            'T': 1e12   // 万亿
        };

        // 提取数字部分和单位
        const match = (str+'').match(/^([\d.]+)([KMBT]?)$/i);
        if (!match) return NaN;

        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase() as keyof typeof multiplier;

        return unit ? num * multiplier[unit] : num;
    }
    /**
         * 向 Solana 钱包转账 SOL
         * 
         * @param fromBase58PrivateKey - 发起人钱包的 Base58 私钥
         * @param toPublicKeyString - 收款人地址（base58 格式）
         * @param amountSol - 转账金额（单位为 SOL）
         * @param rpcUrl - Solana 网络 RPC URL（如：https://api.mainnet-beta.solana.com）
    */
    const transferSolanaSOL=async(fromBase58PrivateKey: string, toPublicKeyString: string, amountSol: number, rpcUrl: string)=> {
        try {
            setSubLoading(true);
            // 解码私钥并创建 Keypair
            const fromKeypair = Keypair.fromSecretKey(Bs58.decode(fromBase58PrivateKey));
            
            // 创建连接
            const connection = new Connection(rpcUrl, "confirmed");

            // 构建交易
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: new PublicKey(toPublicKeyString),
                lamports: amountSol * 10 ** 9, // 转换为 lamports 
              })
            );

            const latestBlockHash = await connection.getLatestBlockhash('confirmed')
            transaction.recentBlockhash = latestBlockHash.blockhash
            // 发送并确认交易
            const signature =await connection.sendTransaction(transaction, [fromKeypair])

            setSubLoading(false);
            Modal.alert({
                bodyClassName:styles.successModalWrap,
                content: <div className={styles.successModal}>
                    <Result
                        status='success'
                        title='Send successful'
                    />
                    <div className={styles.description}>{amount} {type} <br/>has been successfully sent to <Ellipsis direction='middle' content={address} /></div>
                    <div className={styles.link}><a onClick={()=>{openWebLinkNative('https://solscan.io/tx/'+signature,isIOS,isLocalProxy)}}>View transactions</a></div>
                </div>,
                confirmText:'Close',
                onConfirm:()=>{setVisible(false)}
            })

            setTimeout(()=>{handleRefreshSolanaBalances()},20000)
        } catch (error) {
            setSubLoading(false);
            Modal.alert({
                bodyClassName:styles.failModalWrap,
                content: <div className={styles.failModal}>
                    <Result
                        status='error'
                        title='Send failed'
                    />
                    <div className={styles.description}>{getErrorMessage(error)}</div>
                </div>,
                confirmText:'Close',
            })
        }
    }




    const transferSolanaNotSOL = async (
    currencyType: string,
    fromBase58PrivateKey: string,
    toPublicKeyString: string,
    amountSol: number,
    rpcUrl: string
    ) => {
    try {
        setSubLoading(true);

        // —— 1. 初始化 Keypair 和 Connection ——
        const fromKeypair = Keypair.fromSecretKey(
        Bs58.decode(fromBase58PrivateKey)
        );
        const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
        wsEndpoint: "", // 禁用 websocket
        });

        // —— 2. 组装 SPL Token 转账交易 ——
        const SP_address = getTypeToAddr(currencyType);
        const mintAddress = new PublicKey(SP_address);
        const recipient = new PublicKey(toPublicKeyString);

        // 2a. 计算 ATA
        const fromATA = await getAssociatedTokenAddress(
        mintAddress,
        fromKeypair.publicKey
        );
        const toATA = await getAssociatedTokenAddress(mintAddress, recipient);

        const tx = new Transaction();

        // 2b. 如果接收方 ATA 不存在，就先创建
        if (!(await connection.getAccountInfo(toATA))) {
        tx.add(
            createAssociatedTokenAccountInstruction(
            fromKeypair.publicKey,
            toATA,
            recipient,
            mintAddress
            )
        );
        }

        // 2c. 取 mint decimals 并添加 transfer 指令
        const mintInfo = await getMint(connection, mintAddress);
        const decimals = mintInfo.decimals;
        const rawAmount = BigInt(amountSol * 10 ** decimals);

        tx.add(
        createTransferCheckedInstruction(
            fromATA,
            mintAddress,
            toATA,
            fromKeypair.publicKey,
            rawAmount,
            decimals
        )
        );

        // —— 3. 获取最新 blockhash/height 并签名 —— 
        const latest = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = latest.blockhash;
        // v1.14+ 交易还需要 lastValidBlockHeight
        // @ts-ignore
        tx.lastValidBlockHeight = latest.lastValidBlockHeight;
        tx.feePayer = fromKeypair.publicKey;
        tx.sign(fromKeypair);

        // —— 4. sendRawTransaction —— 
        const rawTx = tx.serialize();
        const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        });
        console.log("发送 tx signature:", signature);

        // —— 5. 轮询确认 —— 
        const timeout = 30_000;    // 最长等 30s
        const interval = 2_000;    // 每 2s 查一次
        const start = Date.now();

        const handleCheck = async () => {
        const resp = await connection.getSignatureStatuses([signature]);
        const status = resp.value[0];
        if (
            status &&
            (status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized")
        ) {
            clearInterval(timer);
            console.log("✅ 交易已确认", status);
            // 这里可以做后续 UI 更新
            handleRefreshSolanaBalances();
        } else if (Date.now() - start > timeout) {
            clearInterval(timer);
            console.warn("⚠️ 签名确认超时，当前状态：", status);
        }
        };

        const timer = setInterval(handleCheck, interval);
        // 也可以立刻检查一次
        handleCheck();

        // —— 6. 弹窗提示用户 tx 已发出 —— 
        Modal.alert({
        bodyClassName: styles.successModalWrap,
        content: (
            <div className={styles.successModal}>
            <Result status="success" title="Transaction sent" />
            <div className={styles.description}>
                {amountSol} {currencyType}
                <br />
                has been sent to{" "}
                <Ellipsis direction="middle" content={toPublicKeyString} />
            </div>
            <div className={styles.link}>
                <a
                onClick={() => {
                    openWebLinkNative(
                    "https://solscan.io/tx/" + signature,
                    isIOS,
                    isLocalProxy
                    );
                }}
                >
                View on Solscan
                </a>
            </div>
            </div>
        ),
        confirmText: "Close",
        onConfirm: () => {
            setVisible(false);
            setSubLoading(false);
        },
        });
    } catch (error) {
        setSubLoading(false);
        Modal.alert({
        bodyClassName: styles.failModalWrap,
        content: (
            <div className={styles.failModal}>
            <Result status="error" title="Send failed" />
            <div className={styles.description}>
                {getErrorMessage(error)}
            </div>
            </div>
        ),
        confirmText: "Close",
        });
    }
    };

    const handleSend=()=>{
        const _node1 = globalAllNodes[Math.floor(Math.random() * (globalAllNodes.length - 1))]
        const randomSolanaRPC = `http://${_node1.ip_addr}:80/solana-rpc`
        if(type=='$SOL'){
            transferSolanaSOL(wallet?.privateKeyArmor,address,(amount?Number(amount):0),randomSolanaRPC);
            return ;
        }
        transferSolanaNotSOL(type,wallet?.privateKeyArmor,address,(amount?Number(amount):0),randomSolanaRPC)
        
    }

    return (
        <>
            <div className={styles.sendBtn} onClick={() => {setVisible(true)}}>
                <LocationOutline className={styles.sendIcon} />
                <span className={styles.text}>{t('comp-comm-Send')} </span>
            </div>
            <Popup
                visible={visible}
                onMaskClick={() => {setVisible(false)}}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.sendBtnPopup}
                closeOnMaskClick={true}
            >
                <div className={styles.modalWrap}>
                    <NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('comp-accountlist-SendButton')} {type}</NavBar>
                    <div className={styles.logo}>{renderTag(removeDollarPrefix(type))}</div>
                    <div className={styles.form}>
                        <div className={styles.addressInput}>
                            <Input
                                placeholder={t('comp-accountlist-SendButton-placeholder')}
                                value={address}
                                onChange={val => {setAddress(val)}}
                            />
                        </div>
                        <div className={styles.amountInput}>
                            <Input
                                type="number"
                                min={0}
                                max={convertStringToNumber(balance)}
                                placeholder={t('comp-accountlist-SendButton-Amount')}
                                value={amount}
                                onChange={val => {
                                    let valBig=BigNumber(val?val:0);
                                    let ratio=usdRatio();
                                    
                                    if (/^\d*\.?\d{0,6}$/.test(val)) {
                                        setAmount(val);
                                    }
                                    if(valBig){
                                        setCalcPrice(BigNumber(ratio).multipliedBy(valBig).toFixed(2));
                                    }else{
                                        setCalcPrice('0.00');
                                    }
                                }}
                            />
                            <div className={styles.unit}>{type}</div>
                            <div className={styles.max} onClick={useMax}>{t('comp-SwapInput-Max')}</div>
                        </div>
                        <div className={styles.extraInfo}>
                            <div className={styles.usval}>${calcPrice}</div>
                            <div className={styles.available}>{t('comp-accountlist-SendButton-Available')} {balance} </div>
                        </div>
                        <div className={styles.oper}><Button block loading={subLoading} color='primary' size='large' disabled={!(address&&amount)} onClick={handleSend}>{t('comp-comm-Confirm')}</Button></div>
                    </div>
                    {subLoading?<div className={styles.loadingWrap}>
                        <SpinLoading style={{ '--size': '48px' }} />
                        <div className={styles.text}>{t('comp-comm-LoadingRing')}</div>
                    </div>:''}
                </div>
            </Popup>
        </>
    );
}


export default SendButton;