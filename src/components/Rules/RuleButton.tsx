import {useState,useRef,useEffect,CSSProperties} from 'react';
import { Popup,NavBar,List,SearchBar,Ellipsis } from 'antd-mobile';
import styles from './ruleButton.module.css';
import { SetOutline,RightOutline,EditSOutline,DeleteOutline,CheckCircleOutline,LoopOutline } from 'antd-mobile-icons';
import { List as VirtualizedList, AutoSizer } from 'react-virtualized'

const RuleButton=({})=> {
    const [visible, setVisible] = useState(false);
    const [classify, setClassify] = useState('all');
    const [classifyList, setClassifyList] = useState<Array<{ name: string,value: string }>>([
        {name:'Special',value:'special'},
        {name:'Official Website',value:'official'},
        {name:'Region',value:'region'},
    ]);
    const [specialList, setSpecialList] = useState<Array<{ name: string,value: string }>>([
        {name:'ekahau.comekahau.comekahau.comekahau.comekahau.comekahau.comekahau.comekahau.comekahau.com',value:'ekahau.com'},
        {name:'ekahau.com2',value:'ekahau.com2'},
        {name:'ekahau.com3',value:'ekahau.com3'},
        {name:'ekahau.com4',value:'ekahau.com4'},
        {name:'ekahau.com5',value:'ekahau.com5'},
    ]);
    const rowList: Record<string, Array<{ name: string,value: string }>>={
        'all':classifyList,
        'special':specialList
    }

    const rowRenderer=({index,key,style}: {index: number;key: string;style: CSSProperties}) =>{
        const item = rowList[classify][index];
        if(classify=='all'){
            return (
                <List.Item
                    key={key}
                    style={style}
                    clickable={false}
                    onClick={()=>{setClassify(item.value)}}
                >
                    {item.name}<RightOutline />
                </List.Item>
            )
        }else{
            return (
                <List.Item
                    key={key}
                    style={style}
                    clickable={false}
                >
                    <Ellipsis direction='end' content={item.name} />
                    <div className={styles.operation}>
                        <a className={styles.itemBtn}><EditSOutline /></a>
                        <a className={styles.itemBtn}><DeleteOutline /></a>
                    </div>
                </List.Item>
            )
        }
    }
    

    return (
        <>
            <div className={styles.ruleBtn} onClick={(e) => {e.preventDefault();e.stopPropagation();setVisible(true)}}>
                <SetOutline />
            </div>
            <Popup
                visible={visible}
                onMaskClick={() => {
                    setVisible(false)
                }}
                position='right'
                bodyStyle={{ width: '100vw',backgroundColor:'#0d0d0d' }}
            >
                <div className={styles.ruleCont}>
                    <NavBar back='Back' onBack={() => {setVisible(false)}} style={{'--height': '70px'}}></NavBar>
                    {classify!='all'?<div className={styles.hd}>{classify}</div>:''}
                    <div className={styles.searchBar}><SearchBar placeholder='Please enter search content' style={{'--height': '40px'}} /></div>
                    <div className={styles.list}>
                        <List header=''>
                            <AutoSizer>
                                {({ width,height }: { width: number,height: number }) => (
                                    <VirtualizedList
                                        rowCount={rowList[classify].length}
                                        rowRenderer={rowRenderer}
                                        width={width}
                                        height={height}
                                        rowHeight={46}
                                        overscanRowCount={10}
                                    />
                                )}
                            </AutoSizer>
                        </List>
                    </div>
                </div>
            </Popup>
        </>
    );
}


export default RuleButton;