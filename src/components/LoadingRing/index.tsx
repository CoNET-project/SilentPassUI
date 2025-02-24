import './index.css';

export default function LoadingRing() {
  return (
    <div className="loading-ring">
      <img src="/assets/dentro.svg" className="rotationClock" />
      <img src="/assets/fora.svg" className="rotation" />
    </div>
  )
}