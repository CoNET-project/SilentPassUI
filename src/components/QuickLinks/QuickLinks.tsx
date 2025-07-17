import {useState,useRef,useEffect} from 'react';
import { FloatingBubble,Popup,Grid,Button,Modal,Input,Toast,Ellipsis,ActionSheet,Dialog,Empty } from 'antd-mobile';
import { LinkOutline,AddOutline,DeleteOutline, EditSOutline,SetOutline } from 'antd-mobile-icons';
import styles from './quickLinks.module.scss';
import { useTranslation } from 'react-i18next';
import { Action } from 'antd-mobile/es/components/action-sheet';
import { useDaemonContext } from "../../providers/DaemonProvider";
import LinkAvatar from './LinkAvatar';
import {openWebLinkNative} from './../../api';

interface LinkItem {
    id: string;
    title: string;
    url: string;
}

const QuickLinks=({})=> {
    const { t, i18n } = useTranslation();
    const LOCAL_KEY = 'silentpass_shortcut_links';
    const [visible, setVisible] = useState(false);
    const { quickLinksShow, setQuickLinksShow, isIOS, isLocalProxy } = useDaemonContext();
    const [links, setLinks] = useState<LinkItem[]>(() => {
        try {
            const stored = localStorage.getItem(LOCAL_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    const [editVisible, setEditVisible] = useState(false);
    const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [manageVisible, setManageVisible] = useState(false);
    const [actionsheetLink, setActionsheetLink] = useState<LinkItem | null>(null);
    const actions: Action[] = [
        { key: 'edit', text: t('quick-links-manage-edit'), onClick:() => { if(actionsheetLink) handleEdit(actionsheetLink) }},
        { key: 'delete', text: t('quick-links-manage-delete'), onClick:() => { if(actionsheetLink) handleDelete(actionsheetLink?.id) }},
        { key: 'cancel', text: t('quick-links-manage-cancel')}
    ]

    useEffect(() => {
        const stored = localStorage.getItem(LOCAL_KEY);
        if (stored) {
          setLinks(JSON.parse(stored));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(links));
    }, [links]);

    const isValidUrl=(url: string)=> {
        try {
            new URL(url);
            return true;
        } catch (err) {
            return false;
        }
    }
    const handleAdd = () => {
        if (links.length >= 11) {
            Toast.show({ content: t('quick-links-manage-tips-1'), duration: 3000, maskStyle:{zIndex:'20005'} });
            return;
        }
        setEditingLink(null);
        setTitle('');
        setUrl('');
        setEditVisible(true);
    }
    const handleSave = () => {
        if (!title || !url) return;
        if (!isValidUrl(url)) {
            Toast.show({ content: t('quick-links-manage-tips-2'), duration: 3000, maskStyle:{zIndex:'20005'} });
            return;
        }
        if (editingLink) {
            setLinks(prev =>
                prev.map(item =>
                    item.id === editingLink.id ? { ...item, title, url } : item
                )
            );
        } else {
            setLinks(prev => [
                ...prev,
                { id: Date.now().toString(), title, url },
            ]);
        }
        setEditVisible(false);
    }
    const handleDelete = async(id: string) => {
        const result = await Dialog.confirm({
            className:styles.deleteDialog,
            content: t('quick-links-manage-confirm-delete'),
        })
        if (result) {
            setLinks(prev => prev.filter(item => item.id !== id));
        }
    }

    const handleEdit = (item: LinkItem) => {
        setEditingLink(item);
        setTitle(item.title);
        setUrl(item.url);
        setEditVisible(true);
    }
    const handleManage=(curlink:LinkItem)=>{
        setActionsheetLink(curlink);
        setManageVisible(true);
    }
    const goLink=(url:string)=>{
        openWebLinkNative(url,isIOS,isLocalProxy);
    }
    const convertToLowerCaseHTTPS=(url:string) =>{
        return url.replace(/^https?/i, 'https');
    }

    return (
        <>
            {quickLinksShow?<div className={styles.quickLinks}>
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
                    style={{zIndex:'1009'}}
                    bodyStyle={{
                        borderTopLeftRadius: '6vw',
                        borderTopRightRadius: '6vw',
                        minHeight: '40vh',
                    }}
                >
                    <div className={styles.linkModal} id="linkModal">
                        {links&&links.length?<Grid columns={4} gap={8}>
                            {links.map(link => {
                                return (
                                    <Grid.Item key={link.id}>
                                        <div className={styles.linkItem}>
                                            <a className={styles.link} onClick={()=>{goLink(convertToLowerCaseHTTPS(link.url))}} rel="noreferrer">
                                                <LinkAvatar link={link} />
                                                <div className={styles.name}><Ellipsis direction='end' content={link.title} /></div>
                                            </a>
                                            <div className={styles.operBar}>
                                                <Button onClick={()=>{handleManage(link)}} className={styles.moreOper} block>{t('quick-links-manage-btn')}<SetOutline className={styles.icon} /></Button>
                                            </div>
                                        </div>
                                    </Grid.Item>
                                )
                            })}
                            <Grid.Item>
                                <div className={styles.linkItem}>
                                    <Button className={styles.linkItemAddBtn} shape='rounded' color='primary' fill='none' onClick={handleAdd}>
                                        <AddOutline />
                                    </Button>
                                </div>
                            </Grid.Item>
                        </Grid>:<div className={styles.empty}>
                            <Empty description={t('quick-links-manage-empty')} />
                            <Button className={styles.linkItemAddBtn} shape='rounded' color='primary' fill='none' onClick={handleAdd}>
                                <AddOutline />
                            </Button>
                        </div>}
                    </div>
                </Popup>
                <ActionSheet
                    extra={t('quick-links-manage-tips-3', {name:(actionsheetLink?.title)})}
                    closeOnAction={true}
                    popupClassName={styles.managePopup}
                    visible={manageVisible}
                    actions={actions}
                    onClose={() => setManageVisible(false)}
                />
                <Modal
                    className={styles.editModal}
                    visible={editVisible}
                    showCloseButton={false}
                    style={{zIndex:'20002'}}
                    content={
                        <div className={styles.editModalCont}>
                            <Input
                                placeholder={t('quick-links-manage-edit-title')}
                                value={title}
                                onChange={val => setTitle(val)}
                                className={styles.input}
                            />
                            <Input
                                placeholder={t('quick-links-manage-edit-address')}
                                value={url}
                                onChange={val => setUrl(val)}
                                className={styles.input}
                            />
                        </div>
                    }
                    closeOnMaskClick
                    onClose={() => setEditVisible(false)}
                    actions={[
                        { key: 'save', className:styles.addBtn, disabled:(!title || !url), text: editingLink ? t('quick-links-manage-save') : t('quick-links-manage-add'), onClick: handleSave },
                        { key: 'cancel', className:styles.cancelBtn, text: t('quick-links-manage-cancel'), onClick:() => setEditVisible(false) },
                    ]}
                />
            </div>:''}
        </>
    );
}


export default QuickLinks;