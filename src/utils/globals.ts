let CoNET_Data: encrypt_keys_object | null = null;

const setCoNET_Data = (data: encrypt_keys_object | null) => {
  CoNET_Data = data;
};

export { CoNET_Data, setCoNET_Data };
