import {useState,useRef,useEffect,useCallback,CSSProperties} from 'react';
import { Popup,NavBar,List,SearchBar,Ellipsis,Checkbox,SpinLoading } from 'antd-mobile';
import styles from './ruleButton.module.css';
import { SetOutline,RightOutline,EditSOutline,DeleteOutline,CheckCircleOutline,LoopOutline } from 'antd-mobile-icons';
import { List as VirtualizedList, AutoSizer } from 'react-virtualized'
import _,{ debounce } from 'lodash';
import axios from 'axios';

interface ProxySet {
  [key: string]: any[]; 
}

const RuleButton=({})=> {
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const [filterVal, setFilterVal] = useState('');
    const [checkboxValue, setCheckboxValue] = useState<string[]>([]);
    const [allCheckboxValue, setAllCheckboxValue] = useState<string[]>([]);
    const [proxySet, setProxySet] = useState<ProxySet>({});
    const [classify, setClassify] = useState('all');
    const [classifyList, setClassifyList] = useState<Array<{ name: string;value: string | string[];valueTag:string;}>>([]);
    const [specialList, setSpecialList] = useState<Array<{ name: string;value: string | string[];valueTag:string;}>>([]);
    const [officialList, setOfficialList] = useState<Array<{ name: string;value: string | string[];valueTag:string;}>>([]);
    const [regionList, setRegionList] = useState<Array<{ name: string;value: string | string[];valueTag:string;}>>([]);

    useEffect(()=>{
        getSetting();
    },[]);

    const rowList: Record<string, Array<{ name: string;value: string | string[];valueTag:string;}>>={
        'all':classifyList,
        'special':specialList,
        'official':officialList,
        'region':regionList
    }

    const rowRenderer=({index,key,style}: {index: number;key: string;style: CSSProperties}) =>{
        const item = searchByKeyword(filterVal)[index];
        if(classify=='all' && !filterVal){
            return (
                <List.Item
                    key={key}
                    style={style}
                    clickable={false}
                    onClick={()=>{
                        setClassify(item.valueTag)
                    }}
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
                    {/*<Ellipsis direction='end' content={item.name} />
                    <div className={styles.operation}>
                        <a className={styles.itemBtn}><EditSOutline /></a>
                        <a className={styles.itemBtn}><DeleteOutline /></a>
                    </div>*/}
                    <Checkbox value={item.valueTag}><Ellipsis direction='end' content={item.name} /></Checkbox>
                </List.Item>
            )
        }
    }
    const handleBack=()=>{
        if(classify=='all'){setVisible(false)}else{setClassify('all')}
    }
    const handleSearchChange=(val:string)=>{
        setSearchVal(val); 
        handleSearch(val);
    }
    const handleSearch = useCallback(
        debounce((value) => {
            setFilterVal(value);
        }, 500),
        []
    );
    const searchByKeyword=(keyword:string)=> {
        if(classify=='all' && keyword){
            // return _.filter([
            //     ...rowList.special, 
            //     ...rowList.official, 
            //     ...rowList.region
            // ], item => item.name.includes(keyword) || item.value.includes(keyword));
            return _.filter([
                ...rowList.special, 
                ...rowList.official, 
                ...rowList.region
            ], item => {
                // 检查 name 是否包含关键字
                const nameMatches = _.includes(_.toLower(item.name), _.toLower(keyword));
                
                // 检查 value 是否是数组并包含关键字
                const valueMatches = _.isArray(item.value) 
                    ? _.some(item.value, value => _.includes(_.toLower(value), _.toLower(keyword))) 
                    : _.includes(_.toLower(item.value), _.toLower(keyword));

                return nameMatches || valueMatches;
            });
        }
        // return _.filter(rowList[classify], item => item.name.includes(keyword) || item.value.includes(keyword));
        return _.filter(rowList[classify], item => {
            // 检查 name 是否包含关键字
            const nameMatches = _.includes(_.toLower(item.name), _.toLower(keyword));
            
            // 检查 value 是否是数组并包含关键字
            const valueMatches = _.isArray(item.value) 
                ? _.some(item.value, value => _.includes(_.toLower(value), _.toLower(keyword))) 
                : _.includes(_.toLower(item.value), _.toLower(keyword));

            return nameMatches || valueMatches;
        });
    }
    const handleCheckboxChange=(val:any)=>{
        let storage = window.localStorage;
        setCheckboxValue(val as string[]);
        const differenceArray = _.difference(allCheckboxValue,val);
        storage.slientpassProxyNotSet=JSON.stringify(differenceArray);
        //传递初始化数据
        console.log(convertValuetagToValueArray(val),'val')
    }
    const convertValuetagToValueArray=(tags: string[])=>{
        if(JSON.stringify(proxySet)!=='{}'){
            const result: string[] = [];
            const ipResult: string[] = [];
            const keysToExtract = Object.keys(proxySet).filter(key => key !== 'classifyList');
            keysToExtract.forEach((keyName) => {
                const list = proxySet[keyName];
                if (list) {
                    const matches = _.filter(list, item => _.includes(tags, item.valueTag));
                    _.forEach(matches, (item: { valueTag: string; value: string | string[] }) => {
                        if(_.isArray(item.value) ){
                            item.value.forEach((value: string) => {
                                if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value)){
                                    ipResult.push(value);
                                }else{
                                    result.push(value);
                                }
                            });
                        }else{
                            if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(item.value)){
                                ipResult.push(item.value);
                            }else{
                                result.push(item.value);
                            }
                        }
                    });
                }
            });
            return {DOMAIN:result,IP:ipResult};
        }
    }
    const getSetting=async()=>{
        let storage = window.localStorage;
        setLoading(true);
        const res = await axios.get('http://localhost/proxySet.json', {});
        if(res.status==200){
            const result=res.data;
            setProxySet(result);
            setClassifyList(result.classifyList);
            setSpecialList(result.specialList);
            setOfficialList(result.officialList);
            setRegionList(result.regionList);

            // 获取所有列表的键，排除 classifyList
            const keysToExtract = Object.keys(result).filter(key => key !== 'classifyList');
            // 使用 flatMap 提取所有 valueTag，并使用 uniq 去重
            const extractValues= _.uniq(_.flatMap(keysToExtract, key => _.map(result[key], 'valueTag')));
            setAllCheckboxValue(extractValues);

            if(storage.slientpassProxyNotSet){
                const existExclude=JSON.parse(storage.slientpassProxyNotSet);
                // 从结果中删除 excludeArray 中的项
                const filteredValues = _.difference(extractValues, existExclude);
                setCheckboxValue(filteredValues);
                //传递初始化数据
                //convertValuetagToValueArray(filteredValues)
            }else{
                setCheckboxValue(extractValues);
                storage.slientpassProxyNotSet=JSON.stringify([]);
                //传递初始化数据
                //convertValuetagToValueArray(extractValues)
            }
        }
        setLoading(false);
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
                {loading?<div className={styles.ruleLoading}>
                    <SpinLoading style={{ '--size': '32px' }} />
                </div>:<div className={styles.ruleCont}>
                    <NavBar back='Back' onBack={handleBack} style={{'--height': '70px'}}></NavBar>
                    {classify!='all'?<div className={styles.hd}>{classify}</div>:''}
                    <div className={styles.searchBar}><SearchBar value={searchVal} onChange={handleSearchChange} placeholder='Please enter search content' style={{'--height': '40px'}} /></div>
                    <div className={styles.list}>
                        <Checkbox.Group value={checkboxValue} onChange={handleCheckboxChange}>
                            <List header=''>
                                <AutoSizer>
                                    {({ width,height }: { width: number,height: number }) => (
                                        <VirtualizedList
                                            rowCount={searchByKeyword(filterVal).length}
                                            rowRenderer={rowRenderer}
                                            width={width}
                                            height={height}
                                            rowHeight={46}
                                            overscanRowCount={10}
                                        />
                                    )}
                                </AutoSizer>
                            </List>
                        </Checkbox.Group>
                    </div>

                </div>}
            </Popup>
        </>
    );
}


export default RuleButton;