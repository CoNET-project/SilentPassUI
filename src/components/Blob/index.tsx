import { useState } from 'react';
import { useSpring, animated } from "react-spring";
import blobshape from "blobshape";
import "./index.css";


function getRandomPath() {
  return blobshape({
    growth: 8,
    edges: 20,
  }).path;
}

interface Props {
  text?: string;
  color: string;
  style: any;
  className?: string;    
}

export default function Blob({ color, style, className }: Props) {
  const [flip, set] = useState(false);

  const { path } = useSpring({
    to: { path: getRandomPath() },
    from: { path: getRandomPath() },
    reverse: flip,
    config: {
      duration: 2000,
    },
    onRest: (x: any) => {
      x.value.path = getRandomPath();
      set(!flip);
    }
  });

  return (
    <svg viewBox="0 0 400 400"  
    className={className}
    style={{
      zIndex: "2",
      ...style
    }}>
      <animated.path fill={color} d={path} />
    </svg>
  );
}