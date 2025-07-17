import {useState,useRef,useEffect} from 'react';
import styles from './quickLinks.module.scss';

interface Link {
    id: string;
    title: string;
    url: string;
}
interface LinkAvatarParams {
    link:Link;
}

const LinkAvatar=({link}:LinkAvatarParams)=> {
    const [loaded, setLoaded] = useState(false);
    const DEFAULT_ICON_BASE64 = 'data:text/plain;base64,TmV0d29yayBlcnJvciBoYXBwZW5lZA==';
    const COLORS = [
      '#F6C6EA', // 柔粉紫
      '#B5EAD7', // 绿薄荷
      '#C7CEEA', // 淡蓝紫
      '#FFDAC1', // 奶油橘
      '#E2F0CB', // 淡豆绿
      '#D5AAFF', // 柔紫
      '#FFE0AC', // 奶茶色
      '#A0E7E5', // 蓝绿色调
      '#FFB5A7', // 珊瑚粉
      '#C3FBD8', // 绿豆沙
      '#F7D9C4'  // 浅桃奶
    ];

    const getAvatarColor=(title: string)=> {
        let sum = 0;
        for (let i = 0; i < title.length; i++) {
            sum += title.charCodeAt(i);
        }
        return COLORS[sum % COLORS.length];
    }
    const getFaviconFromDuckDuckGo=(websiteUrl: string)=> {
        try {
            const url = new URL(websiteUrl);
            const resUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
            return resUrl;
        } catch (e) {
            return '';
        }
    }  

    return (
        <div className={styles.avatar} style={{ backgroundColor: getAvatarColor(link.title) }}>
            {!loaded && (
                <span>{link.title.charAt(0).toUpperCase()}</span>
            )}
            <img
                src={getFaviconFromDuckDuckGo(link.url)}
                alt="favicon"
                width={16}
                height={16}
                style={{ display: loaded ? 'inline' : 'none' }}
                onLoad={() => {
                    setLoaded(true)
                }}
                onError={() => {setLoaded(false)}}
            />
        </div>
    );
}


export default LinkAvatar;