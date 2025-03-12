let CoNET_Data: encrypt_keys_object | null = null;
let processingBlock: boolean = false;
let currentPageInvitees: number = 0;

const setCoNET_Data = (data: encrypt_keys_object | null) => {
  CoNET_Data = data;
};

const setProcessingBlock = (value: boolean) => {
  processingBlock = value;
};

const setCurrentPageInvitees = (value: number) => {
  currentPageInvitees = value;
};

export {
  CoNET_Data,
  setCoNET_Data,
  processingBlock,
  setProcessingBlock,
  currentPageInvitees,
  setCurrentPageInvitees,
};
