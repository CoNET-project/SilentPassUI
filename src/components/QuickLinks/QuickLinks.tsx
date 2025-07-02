import {useState,useRef,useEffect} from 'react';
import { FloatingBubble,Popup,Grid,Button } from 'antd-mobile';
import { LinkOutline,AddCircleOutline } from 'antd-mobile-icons';
import styles from './quickLinks.module.css';
import { useTranslation } from 'react-i18next';

const QuickLinks=({})=> {
    const [visible, setVisible] = useState(false);

    return (
        <div className={styles.quickLinks}>
            <FloatingBubble
                onClick={() => {setVisible(!visible)}}
                axis='xy'
                magnetic='x'
                style={{
                  '--initial-position-bottom': '124px',
                  '--initial-position-right': '24px',
                  '--edge-distance': '24px 24px 80px 24px',
                }}
            >
                <LinkOutline fontSize={32} />
            </FloatingBubble>
            <Popup
                className={styles.quickLinksPopup}
                visible={visible}
                showCloseButton={true}
                onMaskClick={() => {setVisible(false)}}
                onClose={() => {setVisible(false)}}
                bodyStyle={{
                    borderTopLeftRadius: '6vw',
                    borderTopRightRadius: '6vw',
                    minHeight: '40vh',
                }}
            >
                <div className={styles.linkModal}>
                    <Grid columns={4} gap={8}>
                        <Grid.Item>
                            <div className={styles.linkItem}>
                                <a target="_blank">
                                    百度
                                </a>
                            </div>
                        </Grid.Item>
                        <Grid.Item>
                            <div className={styles.linkItem}>A</div>
                        </Grid.Item>
                        <Grid.Item>
                            <div className={styles.linkItem}>A</div>
                        </Grid.Item>
                        <Grid.Item>
                            <div className={styles.linkItem}>A</div>
                        </Grid.Item>
                        <Grid.Item>
                            <div className={styles.linkItem}>
                                <Button color='primary' fill='none'><AddCircleOutline /></Button>
                            </div>
                        </Grid.Item>
                    </Grid>
                </div>
            </Popup>
        </div>
    );
}


export default QuickLinks;