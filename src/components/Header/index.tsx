import MiningStatus from '../MiningStatus';

export default function Header() {
  return (
    <div className="header">
      <div className="header-content">
        <MiningStatus />
      </div>
    </div>
  )
}