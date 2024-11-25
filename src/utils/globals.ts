import { miningV2_Class } from "../services/vpn";

let CoNET_Data: encrypt_keys_object | null = null;
let miningClass: miningV2_Class | null = null;

const setCoNET_Data = (data: encrypt_keys_object | null) => {
  CoNET_Data = data;
};

const setMiningClass = (data: miningV2_Class | null) => {
  miningClass = data;
};

export { CoNET_Data, setCoNET_Data, miningClass, setMiningClass };
