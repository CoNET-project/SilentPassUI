import "./index.css";

interface SwitchProps {
  state: boolean;
  icon?: string;
}

export default function Switch({ state, icon }: SwitchProps) {
  return (
    <div className={`wrapper ${icon ? 'icon' : ''} ${state ? 'true' : 'false'}`}>
      <div className="ball">
        <img src={icon} alt="switch icon" />
      </div>
    </div>
  )
}