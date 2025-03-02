let CoNET_Data: encrypt_keys_object | null = null;
let processingBlock: boolean = false;
let lastProceeeTime = 0;
const setCoNET_Data = (data: encrypt_keys_object | null) => {
  CoNET_Data = data;
};

const setProcessingBlock = (value: boolean) => {
  processingBlock = value;
};

const setLastProceeeTime = (value: number) => {
	lastProceeeTime = value
}

export { CoNET_Data, setCoNET_Data, processingBlock, setProcessingBlock,setLastProceeeTime, lastProceeeTime};
