import { useState, useRef, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from '@/components/Home/NewVersion/newVersion.module.scss';
import { useTranslation } from 'react-i18next';
import { Space,Toast } from 'antd-mobile';
import { startSilentPass, stopSilentPass, getLocalServerVersion } from "@/api";
import { useDaemonContext } from "@/providers/DaemonProvider";

const NewVersion = ({}) => {
    const { t, i18n } = useTranslation();
    const {power,version, hasNewVersion, setHasNewVersion} = useDaemonContext();

    useEffect(() => {
        compairVersionNew();
    }, [])

	const compairVersionNew = async () => {
		let remoteVer = await getLocalServerVersion();
		if (isNewerVersion(version, remoteVer)) {
			return setHasNewVersion(remoteVer)
		}

		setTimeout(() => {
			compairVersionNew()
		}, 1000 * 60)
	}

    /**
     * 比较两个语义化版本号。
     * @param oldVer 旧版本号，如 "0.18.0"
     * @param newVer 新版本号，如 "0.18.1"
     * @returns 如果 newVer 比 oldVer 新，则返回 true；否则返回 false。
     */
    const isNewerVersion = (oldVer: string, newVer: string): boolean => {
        if (!oldVer||!newVer) {
            return false
        }
        const oldParts = oldVer.split('.').map(Number)
        const newParts = newVer.split('.').map(Number)

        for (let i = 0; i < oldParts.length; i++) {
            if (newParts[i] > oldParts[i]) {
                return true
            }
            if (newParts[i] < oldParts[i]) {
                return false
            }
        }
        return false // 如果版本号完全相同，则不是更新的版本
    }
	
    return (
        <></>  
    );
};

export default NewVersion;