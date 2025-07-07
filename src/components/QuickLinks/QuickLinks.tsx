import {useState,useRef,useEffect} from 'react';
import { FloatingBubble,Popup,Grid,Button,Modal,Input,Toast,Ellipsis,Popover } from 'antd-mobile';
import { LinkOutline,AddCircleOutline,DeleteOutline, EditSOutline,DownFill } from 'antd-mobile-icons';
import styles from './quickLinks.module.css';
import { useTranslation } from 'react-i18next';
import { Action } from 'antd-mobile/es/components/popover';

interface LinkItem {
    id: string;
    title: string;
    url: string;
}

const QuickLinks=({})=> {
    const LOCAL_KEY = 'silentpass_shortcut_links';
    const [visible, setVisible] = useState(false);
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
    const actions: Action[] = [
        { key: 'edit', icon: <EditSOutline />, text: '修改' },
        { key: 'delete', icon: <DeleteOutline />, text: '删除' }
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

    const handleAdd = () => {
        if (links.length >= 10) {
            Toast.show({ content: '最多只能添加 10 个快捷链接', duration: 2000 });
            return;
        }
        setEditingLink(null);
        setTitle('');
        setUrl('');
        setEditVisible(true);
    }

    const handleSave = () => {
        if (!title || !url) return;
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
    const handleDelete = (id: string) => {
        setLinks(prev => prev.filter(item => item.id !== id));
    }

    const handleEdit = (item: LinkItem) => {
        setEditingLink(item);
        setTitle(item.title);
        setUrl(item.url);
        setEditVisible(true);
    }

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
                style={{zIndex:'1009'}}
                bodyStyle={{
                    borderTopLeftRadius: '6vw',
                    borderTopRightRadius: '6vw',
                    minHeight: '40vh',
                }}
            >
                <div className={styles.linkModal} id="linkModal">
                    <Grid columns={4} gap={8}>
                        {links.map(link => (
                            <Grid.Item key={link.id}>
                                <div className={styles.linkItem}>
                                    <a className={styles.link} href={link.url} target="_blank" rel="noreferrer">
                                        <div className={styles.avatar}><span>{link.title.charAt(0).toUpperCase()}</span></div>
                                        <div className={styles.name}><Ellipsis direction='end' content={link.title} /></div>
                                    </a>
                                    <div className={styles.operBar}>
                                        <Popover.Menu
                                            actions={actions}
                                            placement='top'
                                            trigger='click'
                                            getContainer={() => {
                                              return  document.body;
                                            }}
                                        >
                                            <Button className={styles.moreOper} block>管理<DownFill className={styles.icon} /></Button>
                                        </Popover.Menu>
                                        {/*<Button fill="none" onClick={() => handleEdit(link)}><EditSOutline /></Button>
                                        <Button fill="none" onClick={() => handleDelete(link.id)}><DeleteOutline /></Button>*/}
                                    </div>
                                </div>
                            </Grid.Item>
                        ))}
                        <Grid.Item>
                            <div className={styles.linkItem}>
                                <Button color='primary' fill='none' onClick={handleAdd}>
                                    <AddCircleOutline />
                                </Button>
                            </div>
                        </Grid.Item>
                    </Grid>
                </div>
            </Popup>
            <Modal
                visible={editVisible}
                showCloseButton
                style={{zIndex:'1010'}}
                content={
                    <div>
                        <Input
                            placeholder="标题"
                            value={title}
                            onChange={val => setTitle(val)}
                            clearable
                        />
                        <Input
                            placeholder="链接地址"
                            value={url}
                            onChange={val => setUrl(val)}
                            clearable
                            style={{ marginTop: 12 }}
                        />
                    </div>
                }
                closeOnMaskClick
                onClose={() => setEditVisible(false)}
                actions={[
                    { key: 'cancel', text: '取消' },
                    { key: 'save', text: editingLink ? '保存' : '添加', onClick: handleSave },
                ]}
            />
        </div>
    );
}


export default QuickLinks;