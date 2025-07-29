import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'spHistoryRecords';

export type HistoryItem = {
    operation: 'swap' | 'send';
    status: 'success' | 'loading' | 'failed';
    fromType: 'SOL' | 'SP' | 'USDT' | string;
    toType: 'SOL' | 'SP' | 'USDT' | string;
    fromVal: string;
    toVal: string;
    fromAddress: string;
    toAddress: string;
    hash: string;
    key: string;
};

const getRecords = (): HistoryItem[] => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
};

const saveRecords = (records: HistoryItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event('local-history-updated'));
};

export const useHistoryManager = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // 初始化加载 + 监听变化
    useEffect(() => {
        const update = () => setHistory(getRecords());

        window.addEventListener('local-history-updated', update);
        window.addEventListener('storage', update);
        update(); // 初始加载

        return () => {
            window.removeEventListener('local-history-updated', update);
            window.removeEventListener('storage', update);
        };
  }, []);

  // 添加记录（最多10条）
  const addRecord = useCallback((record: HistoryItem) => {
        let records = getRecords();
        records = records.filter(r => r.key !== record.key);
        records.unshift(record);
        if (records.length > 10) {
            records = records.slice(0, 10);
        }
        saveRecords(records);
  }, []);

  // 编辑记录
  const editRecord = useCallback((key: string, patch: Partial<HistoryItem>) => {
        const records = getRecords();
        const index = records.findIndex(r => r.key === key);
        if (index === -1) return;
        records[index] = { ...records[index], ...patch };
        saveRecords(records);
  }, []);

  // 删除记录
  const deleteRecord = useCallback((key: string) => {
        const records = getRecords().filter(r => r.key !== key);
        saveRecords(records);
  }, []);

  // 清空所有
  const clearRecords = useCallback(() => {
        saveRecords([]);
  }, []);

  return {
        history,
        addRecord,
        editRecord,
        deleteRecord,
        clearRecords,
    };
};
