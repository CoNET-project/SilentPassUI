import { useState } from 'react';
import { useSpring, animated } from "react-spring";
import blobshape from "blobshape";

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
}

export default function Blob(props: Props) {
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
    <svg viewBox="0 0 500 500" width="100%" style={{
      zIndex: "2",
      ...props.style
    }}>
      <animated.path fill={props.color} d={path} />
    </svg>
  );
}