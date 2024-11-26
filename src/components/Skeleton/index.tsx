import React from 'react';
import './index.css';

interface SkeletonProps {
  width: string;
  height: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ width, height }) => {
  return (
    <div
      className="skeleton"
      style={{ width, height }}
    />
  );
};

export default Skeleton;
