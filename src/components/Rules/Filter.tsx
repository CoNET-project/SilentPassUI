import {useState,useRef,useEffect,useCallback,CSSProperties} from 'react';
import { Popup,NavBar,List,SearchBar,Ellipsis,Checkbox,SpinLoading,ErrorBlock,Dialog,Toast,Input,Switch } from 'antd-mobile';
import styles from './ruleButton.module.css';
import { RightOutline,EditSOutline,DeleteOutline,CheckOutline } from 'antd-mobile-icons';
import { List as VirtualizedList, AutoSizer } from 'react-virtualized'
import _,{ debounce } from 'lodash';
import AddItem from './AddItem';
import response from './proxySet.json'
import { useTranslation } from 'react-i18next'
import { useDaemonContext } from "../../providers/DaemonProvider";
import { sendRule } from "../../api"
import { refreshSolanaBalances, storeSystemData } from '../../services/wallets';
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "../../utils/globals"


interface ProxySet {
  [key: string]: any[]; 
}
interface ListItem {
    checked: string;
    valueTag: any; 
    name:string;
    value: string | string[];
}
type ProxyData = {
  classifyList: { name: string; nameCn: string; value: string; valueTag: string }[];
  officialList: { name: string; value: string[]; valueTag: string; checked: string }[];
  regionList: { name: string; value: string; valueTag: string; checked: string }[];
  specialList?: { name: string; value: string | string[]; valueTag: string; checked: string }[]; // 补上这一行
};
interface FilterProps {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const SpecialItem=({item,index,key,style,getCustomSetting}: {item:any;index: number;key: string;style: CSSProperties;getCustomSetting:() => void;})=>{
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.valueTag);
    const { t, i18n } = useTranslation();

    const changeStatus=()=>{
        setIsEditing(!isEditing);
    }
    const modifySpecialArrayByValue=(arr:any[], valueToModify:string, valueEdited:string) =>{
        return _.map(arr, (child) => {
            if (child.value === valueToModify) {
                return {
                    name: valueEdited,
                    value: valueEdited,
                    valueTag: valueEdited,
                    checked:child.checked
                };
            }
            return child;
        });
    }

    const saveItem=()=>{
        let storage = window.localStorage;
        //检查是否合规
        // 匹配 IPv4 地址，支持 CIDR（如 192.168.1.1/32）
        const ipWithCidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/(?:\d|[12]\d|3[0-2]))?$/;

        // 校验每段是否在 0~255
        const isValidIp = (ip: any) => {
            const [address] = ip.split('/');
            return address.split('.').every((segment: any) => {
                const n = Number(segment);
                return n >= 0 && n <= 255;
            });
        };

        // 匹配域名（支持 abc.com、abc.io、abc.dd.ys、abc.yr 等）
        const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

        if((ipWithCidrRegex.test(editValue) && isValidIp(editValue)) || domainRegex.test(editValue)){
            if(storage.specialList){
                let specialList=JSON.parse(storage.specialList);
                if(_.some(specialList, child => _.isEqual(child.valueTag, editValue)) && editValue!==item.valueTag){
                    Toast.show({
                        icon: 'fail',
                        content: 'Current value already exists',
                    });
                    return ;
                }else{
                    //更新 原来的值修改成新的值（specialList）
                    if(storage.specialList){
                        let specialList=JSON.parse(storage.specialList);
                        storage.specialList = JSON.stringify(modifySpecialArrayByValue(specialList,item.valueTag,editValue));
                    }

                    getCustomSetting();

                    setIsEditing(!isEditing);
                }
            }else{
                Toast.show({
                    icon: 'fail',
                    content: t('filter-tip-2'),
                });
            }
        }else{
            Toast.show({
                icon: 'fail',
                content: t('filter-tip-1'),
            })
        }
    }
    const removeItem=()=>{
        Dialog.confirm({
            content: t('filter-tip-4'),
            onConfirm: () => {
                let storage = window.localStorage;
                //更新storage
                if(storage.specialList){
                    let specialList=JSON.parse(storage.specialList);
                    storage.specialList = JSON.stringify(_.reject(specialList, (child:any) => child.valueTag === item.valueTag));
                }
                getCustomSetting();

                Toast.show({
                    icon: 'success',
                    content: t('success'),
                })
            },
        })
    }

    return (
        <List.Item
            key={key}
            style={style}
            clickable={false}
        >
            {isEditing?<Input placeholder='Please enter' value={editValue} onChange={(val:any) => {setEditValue(val)}} />:<Checkbox value={item.valueTag}>
                <Ellipsis direction='end' content={item.name} />
            </Checkbox>}
            <div className={styles.operation}>
                {isEditing?<span className={styles.itemBtn} onClick={saveItem}><CheckOutline /></span>:<span className={styles.itemBtn} onClick={changeStatus}><EditSOutline /></span>}
                {isEditing?'':<span className={styles.itemBtn} onClick={removeItem}><DeleteOutline /></span>}
            </div>
        </List.Item>
    )
}


const Filter=({visible, setVisible}:FilterProps)=> {
    const [loading, setLoading] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const [filterVal, setFilterVal] = useState('');
    const [checkboxValue, setCheckboxValue] = useState<string[]>([]);
    const [allCheckboxValue, setAllCheckboxValue] = useState<string[]>([]);
    const [proxySet, setProxySet] = useState<ProxySet>({});
    const proxySetRef= useRef<ProxySet>({});
    const [classify, setClassify] = useState('all');
    const [classifyList, setClassifyList] = useState<Array<{ name: string;nameCn: string;value: string | string[];valueTag:string}>>([]);
    const [specialList, setSpecialList] = useState<Array<{ name: string;value: string | string[];valueTag:string;checked:string;}>>([]);
    const [officialList, setOfficialList] = useState<Array<{ name: string;value: string | string[];valueTag:string;checked:string;}>>([]);
    const [regionList, setRegionList] = useState<Array<{ name: string;value: string | string[];valueTag:string;checked:string;}>>([]);
	const { t, i18n } = useTranslation();
	const { isLocalProxy, getWebFilter, setGetWebFilter, webFilterRef} = useDaemonContext()

    useEffect(()=>{
        getSetting()
    },[getWebFilter]);

    const rowList: Record<string, Array<{ name: string;nameCn?: string;value: string | string[];valueTag:string;checked?:string;}>>={
        'all':classifyList,
        'special':(specialList?specialList:[]),
        'official':(officialList?officialList:[]),
        'region':(regionList?regionList:[])
    }

    const rowRenderer=({index,key,style}: {index: number;key: string;style: CSSProperties}) =>{
        const item = searchByKeyword(filterVal)[index];
        if(classify==='all' && !filterVal){
            return (
                <List.Item
                    key={key}
                    style={style}
                    clickable={false}
                    onClick={()=>{
                        setClassify(item.valueTag)
                    }}
                >
                    {i18n.language==='en'?item.name:item.nameCn}<RightOutline />
                </List.Item>
            )
        }else if(classify==='special'){
            return <SpecialItem index={index} key={key} style={style} item={item} getCustomSetting={getCustomSetting} />
        }else{
            return (
                <List.Item
                    key={key}
                    style={style}
                    clickable={false}
                >
                    <Checkbox value={item.valueTag}><Ellipsis direction='end' content={item.name} /></Checkbox>
                </List.Item>
            )
        }
    }
    const handleBack=()=>{
        if(classify==='all'){setVisible(false)}else{setClassify('all')}
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
        if(classify==='all' && keyword){
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
        const existSpecialSet=(storage&&storage.specialList?JSON.parse(storage.specialList):[]);
        const existSet=JSON.parse(storage.slientpassProxyLocalSet);
        const valueTagSet = new Set(val);

        _.forEach(existSet, (list, key) => {
            if (key !== 'classifyList') { // 排除 classifyList
                _.forEach(list, (item) => {
                    item.checked = valueTagSet.has(item.valueTag) ? "true" : "false";
                });
            }
        });
        storage.slientpassProxyLocalSet = JSON.stringify(existSet);

        _.forEach(existSpecialSet, (item) => {
            item.checked = valueTagSet.has(item.valueTag) ? "true" : "false";
        });
        storage.specialList = JSON.stringify(existSpecialSet);

        setCheckboxValue(val as string[]);
        //传递数据
        convertValuetagToValueArray(val);
    }
    const convertValuetagToValueArray= async (tags: string[])=>{
        if(JSON.stringify(proxySetRef.current)!=='{}'){
            const result: string[] = [];
            const ipResult: string[] = [];
            const keysToExtract = Object.keys(proxySetRef.current).filter(key => key !== 'classifyList');
            keysToExtract.forEach((keyName) => {
                const list = proxySetRef.current[keyName];
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
            //****************************************需要添加传递设置的代码 START****************************************
			const stringifiedVPNMessageObject = webFilterRef.current?JSON.stringify({DOMAIN:result,IP:ipResult}):JSON.stringify({DOMAIN:[],IP:[]})

            console.log(stringifiedVPNMessageObject,'stringifiedVPNMessageObjectstringifiedVPNMessageObjectstringifiedVPNMessageObject')
			const base64VPNMessage = btoa(stringifiedVPNMessageObject)
            // console.log(stringifiedVPNMessageObject,'stringifiedVPNMessageObject'); 
				
				
				//			Desktop
			if (isLocalProxy) {
				await sendRule(stringifiedVPNMessageObject)
			}
			
			
		
			if (window?.webkit) {
				//window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
			
			}
			//	@ts-ignore		Android
			if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
				
				const base = btoa(JSON.stringify({cmd: 'stopVPN', data: ""}))
				//	@ts-ignore
				// AndroidBridge.receiveMessageFromJS(base)
				
			}
				
				
            //****************************************需要添加传递设置的代码 END****************************************
        }
    }
    const getSetting=async()=>{
        let storage = window.localStorage;
        setLoading(true);

        //****************************************需要更换成真实的配置地址 START****************************************
        const res: { data: ProxyData } = _.cloneDeep(response);
        //****************************************需要更换成真实的配置地址 END****************************************
        if(storage.specialList){
            res.data['specialList']=(JSON.parse(storage.specialList));
        }

        const result=res.data;
        setProxySet(result);
        proxySetRef.current=result;
        setClassifyList(result.classifyList);
        setOfficialList(result.officialList);
        setRegionList(result.regionList);
        setSpecialList(result.specialList || []);

        initCheckbox(result);
        setLoading(false);
		setGetWebFilter(CoNET_Data?.webFilter !== undefined ? CoNET_Data.webFilter: true)
		
    }
    
    const updateLocalSet=(A:any, B:any) =>{
        const keysToCompare = _.difference(_.keys(A), ['classifyList']);
        keysToCompare.forEach(key => {
            if (B[key]) {
                _.forEach(B[key], (bItem:any) => {
                    const aItem = _.find(A[key], { valueTag: bItem.valueTag });
                    if (!aItem) {
                        A[key].push(bItem);
                    }
                });
                _.remove(A[key], (aItem:any) => {
                    return !_.find(B[key], { valueTag: aItem.valueTag });
                });
                _.forEach(A[key], (aItem:any) => {
                    const bItem = _.find(B[key], { valueTag: aItem.valueTag });
                    if (bItem && !_.isEqual(aItem.value, bItem.value)) {
                        aItem.value = bItem.value;
                    }
                });
            }
        });
        return A;
    }
    const calcCheckedArr=(result:any)=>{
        const combinedLists: ListItem[] = Object.keys(result).filter(key => key !== 'classifyList').reduce((acc, key) => acc.concat(result[key]), []); 
        const checkedValueTags = _.chain(combinedLists).filter({ checked: "true" }).map('valueTag').value(); 
        return checkedValueTags;
    }
    const initCheckbox=(result:any)=>{
        let storage = window.localStorage;
        // 获取所有列表的键，排除 classifyList
        const keysToExtract = Object.keys(result).filter(key => key !== 'classifyList');
        // 使用 flatMap 提取所有 valueTag，并使用 uniq 去重
        const extractValues= _.uniq(_.flatMap(keysToExtract, key => _.map(result[key], 'valueTag')));
        setAllCheckboxValue(extractValues);

        if(storage.slientpassProxyLocalSet){
            const existSet=JSON.parse(storage.slientpassProxyLocalSet);
            const newExistSet=updateLocalSet(existSet,result);
            const checkboxVal=calcCheckedArr(result&&result.specialList?{...newExistSet,...result.specialList}:newExistSet);
            storage.slientpassProxyLocalSet = JSON.stringify(newExistSet);

            setCheckboxValue(checkboxVal);
            //传递初始化数据
            convertValuetagToValueArray(checkboxVal);
        }else{
            storage.slientpassProxyLocalSet=JSON.stringify(result);
            const checkboxVal=calcCheckedArr(result);
            setCheckboxValue(checkboxVal);
            //传递初始化数据
            convertValuetagToValueArray(checkboxVal);
        }
    }
	
    const getCustomSetting=()=>{
        let storage = window.localStorage;
        if(storage.specialList){
            setSpecialList(JSON.parse(storage.specialList));
            setProxySet({officialList:officialList,regionList:regionList,specialList:JSON.parse(storage.specialList)});
            proxySetRef.current={officialList:officialList,regionList:regionList,specialList:JSON.parse(storage.specialList)};
            initCheckbox({officialList:officialList,regionList:regionList,specialList:JSON.parse(storage.specialList)});
        }else{
            storage.specialList=JSON.stringify([]);
        }
    }
    const getClassifyName=(val:string)=>{
		return t(`Settings_Passcode_WebsiteFilter-title-${val}`)
        // if(val==='special'){
		// 	t('Special')
        //     return i18n.language==='en'?'Special':'定制'
        // }
        // if(val==='official'){
        //     return i18n.language==='en'?'Official':'官网'
        // }
        // if(val==='region'){
        //     return i18n.language==='en'?'Region':'地区'
        // }
    }
    const handleChangeSwitch=async (val:boolean)=>{
        webFilterRef.current=val;

        setGetWebFilter(val);
		if (CoNET_Data) {
			CoNET_Data.webFilter = val
			storeSystemData()
		}		
    }

    return (
        <>
            <Popup
                visible={visible}
                onMaskClick={() => {
                    setVisible(false)
                }}
                position='right'
                bodyStyle={{ width: '100%',backgroundColor:'#0d0d0d' }}
                className={styles.ruleBtnPopup}
            >
                {loading?<div className={styles.ruleLoading}>
                    <SpinLoading style={{ '--size': '32px' }} />
                </div>:<div className={styles.ruleCont}>
                    <NavBar back={t('back')} onBack={handleBack} right={<div className={styles.ruleSwitch}><label>{t('filter')}</label><Switch checked={getWebFilter} onChange={handleChangeSwitch} style={{'--height': '18px','--width': '38px'}} /></div>} style={{'--height': '70px'}}></NavBar>
                    {classify!=='all'?<div className={styles.hd}>
                        {getClassifyName(classify)}{classify==='special'?<AddItem getCustomSetting={getCustomSetting} />:''}
                    </div>:''}
                    <div className={styles.searchBar}><SearchBar value={searchVal} onChange={handleSearchChange} placeholder={t('comp-Rules-RuleButton-input-placeholder')} style={{'--height': '40px'}} /></div>
                    <div className={styles.list}>
                        <Checkbox.Group value={checkboxValue} onChange={handleCheckboxChange}>
                            <List header=''>
                                {searchByKeyword(filterVal).length?<AutoSizer>
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
                                </AutoSizer>:<ErrorBlock status='empty' />}
                            </List>
                        </Checkbox.Group>
                    </div>
                </div>}
            </Popup>

        </>
    );
}


export default Filter;