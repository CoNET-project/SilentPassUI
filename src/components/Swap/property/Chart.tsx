import { useState, useRef, useEffect } from 'react';
import styles from './chart.module.scss';
import { Skeleton } from 'antd-mobile';

interface params {
  code: string; 
}

const Chart = ({code}:params) => {
    const PRICE_CHART_ID = 'price-chart-widget-container';
    const PAIR_CHAIN_ID = 'solana';
    const containerRef = useRef(null);

    useEffect(()=>{
        if (!document.getElementById('moralis-chart-widget')) {
            const script = document.createElement('script');
            script.id = 'moralis-chart-widget';
            script.src = 'https://moralis.com/static/embed/chart.js';
            script.type = 'text/javascript';
            script.async = true;
            script.onload = loadWidget;
            script.onerror = () => {
                console.error('Failed to load the chart widget script.');
            };
            document.body.appendChild(script);
        } else {
            loadWidget();
        }
    },[code])

    const loadWidget = () => {
        if (typeof (window as any).createMyWidget === 'function') {
            (window as any).createMyWidget(PRICE_CHART_ID, {
                width: '100%',
                height: '500px',
                autoSize: false,
                chainId: PAIR_CHAIN_ID,
                pairAddress: code,
                defaultInterval: '1D',
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Etc/UTC',
                theme: 'moralis',
                locale: 'en',
                backgroundColor: '#071321',
                gridColor: '#0d2035',
                textColor: '#68738D',
                candleUpColor: '#4CE666',
                candleDownColor: '#E64C4C',
                hideLeftToolbar: true,
                hideTopToolbar: true,
                hideBottomToolbar: true,
                visible: false,
                showHoldersChart: false,
            })
        }
    }

    return (
        <>
            <div
                id={PRICE_CHART_ID}
                ref={containerRef}
                className={styles.chartWrap}
            >
            </div>
        </>
    );
};

export default Chart;