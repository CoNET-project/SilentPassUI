import React from 'react';
import './index.css';

interface SkeletonProps {
  width: string;
  height: string;
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({ width, height, style }) => {
  return (
    <div
      className="skeleton"
      style={{ ...style, width, height }}
    />
  );
};

export default Skeleton;
