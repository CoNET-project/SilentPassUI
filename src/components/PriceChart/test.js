import React, { useEffect, useRef } from 'react';

const PRICE_CHART_ID = 'price-chart-widget-container';

export const PriceChartWidget = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadWidget = () => {
      if (typeof window.createMyWidget === 'function') {
        window.createMyWidget(PRICE_CHART_ID, {
          autoSize: true,
          chainId: 'solana',
          pairAddress: '9AGSjaHxuTm4sLHAyRvn1eb4UT6rvuBwkb3Y6wP26BPu',
          showHoldersChart: false,
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
          hideBottomToolbar: true
        });
      } else {
        console.error('createMyWidget function is not defined.');
      }
    };

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
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        id={PRICE_CHART_ID}
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};