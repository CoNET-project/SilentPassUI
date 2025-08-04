import { useState, useRef, useEffect } from 'react';
import styles from '@/components/Home/SignalIndicator/signalIndicator.module.scss';

interface params {
    level: number;
}

const SignalIndicator = ({level}:params) => {

    return (
        <div className={styles.signalIndicator}>
            {[1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className={`${styles.bar} ${i <= level ? styles.active : ''}`}
                    style={{ height: `${i * 6}px` }}
                />
            ))}
        </div>
    );
};

export default SignalIndicator;